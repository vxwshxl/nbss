-- ===========================================================================
-- Client self-registration, and the service requests it exists to carry.
--
-- Guards never register themselves — an administrator issues their code and PIN,
-- and that stays true. This migration opens one door only: a prospective or
-- existing customer creating their own account, from the website or the app, in
-- order to ask for guards and then to watch the ones they get.
--
-- The security question this raises was answered in 0004: a client reads only the
-- sites whose `client_id` is theirs, and a brand-new account owns none. Signing
-- up therefore grants a login and nothing else, which is what makes it safe to
-- offer to strangers.
--
-- Also corrects a mislabel in 0006, below.
-- ===========================================================================

-- --------------------------------------------------------- client codes
-- Every profile needs an employee_code matching '^[A-Z0-9-]{3,20}$' — it is the
-- username, and the constraint predates clients having accounts. A self-registered
-- client gets a generated one so the column keeps its meaning and an operator has
-- something short to quote on the phone.
create sequence if not exists client_code_seq start 1001;

create or replace function next_client_code() returns text
language sql volatile security definer set search_path = public
as $$ select 'CL-' || lpad(nextval('client_code_seq')::text, 6, '0') $$;

-- ===========================================================================
-- The signup trigger.
--
-- A profile is created by the database when an auth user appears, rather than by
-- the client after signing up. Two reasons, and the second is the important one:
--
--   The app and the website would otherwise each need their own
--   "now insert the profile" step, and a signup that succeeded halfway — an auth
--   user with no profile — is an account that can sign in and then hit a wall.
--
--   THE ROLE IS NOT AN INPUT. It is the literal 'client' below. A signup request
--   can put anything it likes in user metadata, including role: 'admin', and it
--   will be ignored, because this function never reads it. That is the whole
--   reason the role is assigned here and not by whatever code called signUp.
-- ===========================================================================
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Only self-registration. `createStaffAccount` and scripts/create-user.mjs
  -- create the auth user and then insert the profile themselves, with a role an
  -- administrator chose; this must not race them.
  if coalesce(new.raw_user_meta_data ->> 'signup', '') <> 'client' then
    return new;
  end if;

  insert into profiles (id, employee_code, role, full_name, phone)
  values (
    new.id,
    next_client_code(),
    'client',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  -- Belt and braces against a retried signup or a race with an admin-created
  -- account for the same id.
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ===========================================================================
-- Service requests
--
-- Distinct from `submissions`, which stays as it is: a flat record of the three
-- public forms, written once and read by whoever picks up the phone. A service
-- request is a thing with a life — it is quoted, accepted, and eventually becomes
-- a site — so it gets a status, an owner and a reference the customer can quote.
-- ===========================================================================
do $$ begin
  create type service_request_status as enum
    ('new', 'reviewing', 'quoted', 'accepted', 'declined', 'withdrawn', 'converted');
exception when duplicate_object then null; end $$;

create table if not exists service_requests (
  id                  uuid primary key default gen_random_uuid(),

  -- Short, unique, and safe to read out over a bad phone line: SR-2609-0042.
  reference           text not null unique,

  -- Null for an enquiry that came in before the person had an account, which is
  -- the normal case from the landing page. Filled in when they register, or by an
  -- operator linking the two.
  client_id           uuid references profiles (id) on delete set null,

  -- Contact details are stored on the row rather than only on the profile, so an
  -- anonymous request is complete on its own and a later account change cannot
  -- rewrite what was actually asked for.
  contact_name        text not null,
  organisation        text,
  email               text,
  phone               text not null,

  -- What they want. `service_type` carries the slug from src/content/services.ts.
  service_type        text not null,
  site_type           text,
  district            text,
  address             text,
  lat                 double precision check (lat between -90 and 90),
  lng                 double precision check (lng between -180 and 180),

  guards_required     integer check (guards_required between 1 and 2000),
  armed               boolean not null default false,
  shift_pattern       text check (shift_pattern in ('24x7', 'day', 'night', 'custom')),
  start_date          date,
  duration_months     integer check (duration_months between 1 and 120),
  notes               text,

  status              service_request_status not null default 'new',

  -- Stored in paise, like everything else money in this codebase.
  quoted_amount_paise bigint check (quoted_amount_paise >= 0),
  quote_note          text,

  handled_by          uuid references profiles (id) on delete set null,
  handled_at          timestamptz,

  -- Set when the request becomes a real deployment, which is what closes the loop
  -- between "this customer asked" and "this customer can now see their guards".
  site_id             uuid references sites (id) on delete set null,

  source              text not null default 'web' check (source in ('web', 'app', 'phone', 'walk_in')),
  user_agent          text,
  ip                  inet,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists service_requests_status_idx on service_requests (status, created_at desc);
create index if not exists service_requests_client_idx on service_requests (client_id, created_at desc)
  where client_id is not null;

create trigger service_requests_touch before update on service_requests
  for each row execute function touch_updated_at();

-- A per-month sequence would need a table; a count is enough at this volume and
-- keeps the reference readable. The unique constraint is the real guarantee — a
-- collision retries rather than being silently accepted.
create sequence if not exists service_request_seq start 1;

create or replace function next_service_reference() returns text
language sql volatile security definer set search_path = public
as $$
  select 'SR-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('service_request_seq')::text, 4, '0')
$$;

-- ===========================================================================
-- submit_service_request
--
-- For a signed-in client, from either the app or the browser. Anonymous
-- submissions from the landing page go through the web app's own route instead,
-- where they can be rate-limited and spam-checked before anything reaches the
-- database — an RPC granted to `anon` is an open write endpoint, and this table is
-- the company's sales pipeline.
-- ===========================================================================
create or replace function submit_service_request(
  p_service_type    text,
  p_contact_name    text,
  p_phone           text,
  p_email           text    default null,
  p_organisation    text    default null,
  p_site_type       text    default null,
  p_district        text    default null,
  p_address         text    default null,
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_guards_required integer default null,
  p_armed           boolean default false,
  p_shift_pattern   text    default null,
  p_start_date      date    default null,
  p_duration_months integer default null,
  p_notes           text    default null,
  p_source          text    default 'app'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_ref text := next_service_reference();
  v_id  uuid;
  v_open integer;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  if coalesce(trim(p_service_type), '') = '' then
    raise exception 'Which service is this for?' using errcode = '22023';
  end if;
  if coalesce(trim(p_contact_name), '') = '' then
    raise exception 'A contact name is required.' using errcode = '22023';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'A phone number is required — this is how the deployment desk replies.'
      using errcode = '22023';
  end if;

  -- A soft ceiling, not a security control: it stops an accidental double-submit
  -- from a flaky connection becoming six identical rows for someone to triage.
  select count(*) into v_open
  from service_requests
  where client_id = v_me and created_at > now() - interval '1 hour';

  if v_open >= 5 then
    raise exception 'That is five requests in an hour. Ring the deployment desk instead — someone will pick up.'
      using errcode = 'P0001';
  end if;

  insert into service_requests (
    reference, client_id, contact_name, organisation, email, phone,
    service_type, site_type, district, address, lat, lng,
    guards_required, armed, shift_pattern, start_date, duration_months, notes, source
  ) values (
    v_ref, v_me, trim(p_contact_name), nullif(trim(p_organisation), ''),
    nullif(trim(p_email), ''), trim(p_phone),
    trim(p_service_type), nullif(trim(p_site_type), ''), nullif(trim(p_district), ''),
    nullif(trim(p_address), ''), p_lat, p_lng,
    p_guards_required, coalesce(p_armed, false), p_shift_pattern, p_start_date,
    p_duration_months, nullif(trim(p_notes), ''),
    case when p_source in ('web', 'app') then p_source else 'app' end
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'reference', v_ref, 'status', 'new');
end;
$$;

revoke all on function submit_service_request(text, text, text, text, text, text, text, text,
  double precision, double precision, integer, boolean, text, date, integer, text, text) from anon;
grant execute on function submit_service_request(text, text, text, text, text, text, text, text,
  double precision, double precision, integer, boolean, text, date, integer, text, text) to authenticated;

-- A client withdrawing their own request. Not a delete: the pipeline should record
-- that somebody asked and then changed their mind.
create or replace function withdraw_service_request(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_me uuid := auth.uid(); v_n integer;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  update service_requests
  set status = 'withdrawn'
  where id = p_id and client_id = v_me and status in ('new', 'reviewing', 'quoted');
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'That request is not yours, or has moved too far along to withdraw.'
      using errcode = '42501';
  end if;
  return jsonb_build_object('id', p_id, 'status', 'withdrawn');
end;
$$;

grant execute on function withdraw_service_request(uuid) to authenticated;

-- ------------------------------------------------------------------ policies
alter table service_requests enable row level security;

create policy service_requests_staff_read on service_requests
  for select using (is_staff());

create policy service_requests_staff_write on service_requests
  for all using (is_staff()) with check (is_staff());

-- A client sees their own requests and the quote against them. No insert or update
-- policy: both go through the functions above, so the client_id can be taken from
-- the JWT rather than trusted from a payload.
create policy service_requests_client_read on service_requests
  for select using (client_id = auth.uid());

-- ===========================================================================
-- Correction to 0006_sos.sql
--
-- `close_sos` marked every undelivered push as 'alert closed before delivery',
-- including the ones already handed to Expo and waiting on a reply. Those had in
-- fact been delivered, so the outbox was recording a failure that did not happen
-- and `collect_push_responses` then had nothing left to reconcile them against.
--
-- Only rows not yet dispatched — request_id still null — are cancelled now.
-- Anything in flight is left for the collector to resolve honestly.
-- ===========================================================================
create or replace function close_sos(
  p_alert_id uuid,
  p_status   sos_status default 'resolved',
  p_note     text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_alert sos_alerts%rowtype;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  if p_status not in ('resolved', 'false_alarm') then
    raise exception 'An alert is closed as resolved or as a false alarm.' using errcode = '22023';
  end if;

  select * into v_alert from sos_alerts where id = p_alert_id;
  if not found then raise exception 'No such alert.' using errcode = 'no_data_found'; end if;

  if v_alert.raised_by <> v_me and not is_staff() then
    raise exception 'Only the guard who raised this alert or a supervisor may close it.'
      using errcode = '42501';
  end if;

  update sos_alerts
  set status = p_status, closed_at = now(), closed_by = v_me, closing_note = p_note
  where id = p_alert_id
  returning * into v_alert;

  -- Queued but not yet sent: dropped, because a phone that has been off should not
  -- light up about an emergency that ended an hour ago. Already dispatched: left
  -- alone, because it was.
  update push_outbox
  set failed_at = now(), error = 'alert closed before delivery'
  where alert_id = p_alert_id
    and sent_at is null and failed_at is null and request_id is null;

  perform realtime.send(
    jsonb_build_object('id', p_alert_id, 'site_id', v_alert.site_id, 'status', p_status,
                       'closed_by', v_me, 'note', p_note),
    'sos', 'site:' || v_alert.site_id, true
  );
  perform realtime.send(
    jsonb_build_object('id', p_alert_id, 'site_id', v_alert.site_id, 'status', p_status,
                       'closed_by', v_me),
    'sos', 'live-map', true
  );

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_me, 'sos.close', 'sos_alerts', p_alert_id::text,
          jsonb_build_object('status', p_status, 'note', p_note));

  return jsonb_build_object('alert_id', p_alert_id, 'status', p_status);
end;
$$;
