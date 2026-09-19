-- ===========================================================================
-- Phase 0: give a client something to be scoped to, and scope them to it.
--
-- This migration closes a hole that public client self-registration would turn
-- into a disclosure. As shipped, 0001_foundation.sql says:
--
--     create policy sites_read on sites
--       for select using (auth.uid() is not null);
--
-- — any signed-in account reads every site in the register. That was defensible
-- while the only accounts were ones an administrator created by hand. The moment
-- anyone can sign up from the landing page, it means a stranger with an email
-- address can enumerate every premises NBSS guards, with coordinates and fence
-- radii. Nothing links a client to a site, so it could not have been narrower.
--
-- There is a second, quieter hole underneath it. `attendance` has no client
-- policy at all, so the client panel's "on duty now" table has always returned
-- zero rows — the page has been shipping an empty state that reads as "nobody is
-- checked in" rather than "you are not allowed to see this".
--
-- Both are fixed here, and the fix for the second one is deliberately not "add a
-- select policy on attendance". Row level security filters rows, not columns, and
-- an attendance row carries the guard's coordinates, their accuracy readings and
-- the object key of their check-in selfie. A client is entitled to know their site
-- is staffed and what they are billed for; they are not entitled to track the
-- person. So the client reads a view with only the columns they may have, and
-- `attendance` itself stays closed to them.
-- ===========================================================================

-- ------------------------------------------------------------- the missing link
alter table sites
  add column if not exists client_id uuid references profiles (id) on delete set null;

comment on column sites.client_id is
  'The client account that may see this site. Null means no client portal access — '
  'most sites, since a client login is something the customer asks for.';

create index if not exists sites_client_idx on sites (client_id) where client_id is not null;

-- Whether an SOS at this site also reaches the client.
--
-- Defaults to true because that is what was asked for, but it is a column rather
-- than a constant for a reason: a panic button produces false alarms — a phone in
-- a pocket, a misread screen at 3am — and the first time one wakes a customer at
-- 3am, somebody will want it turned off for that site without waiting for a
-- deploy.
alter table sites
  add column if not exists notify_client_on_sos boolean not null default true;

-- --------------------------------------------------- no accidental role grants
-- `role` defaulted to 'guard'. Every existing caller passes it explicitly, so the
-- default was never doing any work — but a client self-registration path that
-- forgot the column would have silently minted a guard account, and a guard reads
-- the whole site register. Removing the default turns that mistake from a silent
-- privilege grant into a failed insert.
alter table profiles alter column role drop default;

-- ===========================================================================
-- Helpers
--
-- Security definer so they can consult `sites` and `attendance` without the
-- caller's own policies on those tables applying — a policy that reads a table
-- which has a policy that reads this table is how recursion starts.
--
-- Both are scoped to auth.uid() internally, so although PostgREST publishes every
-- function in `public` as an RPC, calling one tells you only about your own sites.
-- ===========================================================================

create or replace function client_owns_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from sites
    where id = p_site_id and client_id = auth.uid()
  )
$$;

comment on function client_owns_site is
  'True when the signed-in account is the client contact for this site.';

-- The sites a guard is expected at. Used by the location and SOS migrations that
-- follow, so that a guard writing a position can only write it against a site they
-- are actually rostered to.
create or replace function guard_rostered_to_site(p_guard_id uuid, p_site_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shifts
    where guard_id = p_guard_id
      and site_id  = p_site_id
      and status <> 'cancelled'
      -- A window either side of the shift, so a guard arriving early or handing
      -- over late is not refused. Not unbounded: a shift last March should not
      -- still authorise a position today.
      and starts_at - interval '4 hours' <= now()
      and ends_at   + interval '4 hours' >= now()
  )
$$;

-- ===========================================================================
-- Row level security, rewritten for sites
-- ===========================================================================

drop policy if exists sites_read on sites;

-- NBSS's own people keep the whole register. A guard has to know where the gate
-- is, and may be sent somewhere at short notice without a roster entry existing
-- yet — narrowing this to rostered sites would break an ad-hoc deployment, which
-- is a real thing that happens and not a breach. The list of premises a security
-- company guards is not secret from its own staff.
create policy sites_worker_read on sites
  for select using (is_staff() or my_role() = 'guard');

-- A client sees exactly the sites that are theirs. This is the line that makes
-- public signup safe: a newly registered account owns nothing and therefore reads
-- nothing.
create policy sites_client_read on sites
  for select using (client_id = auth.uid());

-- ===========================================================================
-- What a client may read
--
-- A view rather than a policy, because the restriction that matters here is
-- which COLUMNS reach them, and RLS cannot express that.
--
-- `security_invoker = false` — the view runs as its owner and so is not filtered
-- by the reader's policies on `attendance`. That is the point: `attendance` stays
-- completely closed to clients, and the WHERE clause below is the only way in.
-- The filter is `s.client_id = auth.uid()`, evaluated per request from the JWT, so
-- a client cannot widen it. Supabase's linter flags this shape; it is deliberate,
-- and this comment is the answer to it.
-- ===========================================================================

create or replace view client_attendance
with (security_invoker = false) as
  select
    a.id,
    a.site_id,
    s.name          as site_name,
    a.guard_id,
    p.full_name     as guard_name,
    a.check_in_at,
    a.check_out_at,
    a.worked_minutes,
    a.overtime_minutes,
    a.status
  from attendance a
  join sites    s on s.id = a.site_id
  join profiles p on p.id = a.guard_id
  where s.client_id = auth.uid();

comment on view client_attendance is
  'Presence and man-hours for a client''s own sites. Deliberately omits every '
  'coordinate, accuracy reading, photo key, IP and review note on the underlying row.';

-- Not granted to anon. An unauthenticated request has no auth.uid(), so the
-- filter would already return nothing, but a table an anonymous caller cannot
-- reach at all is one fewer thing to reason about.
revoke all on client_attendance from anon;
grant select on client_attendance to authenticated;

-- The roster for a client's own sites. Who is due tonight is a fair question from
-- the person paying for tonight, and `shifts` carries nothing a client should not
-- see — a guard id, a site id and two timestamps.
create policy shifts_client_read on shifts
  for select using (client_owns_site(site_id));

-- ===========================================================================
-- Backfill note
--
-- Nothing is backfilled. Every existing site gets client_id = null, which means
-- no client portal access — the correct default, and the same thing those clients
-- could actually see before this migration, since the attendance table they were
-- pointed at returned nothing. Linking a site to a client account is an
-- administrative act and belongs in the console, not in a migration.
-- ===========================================================================
