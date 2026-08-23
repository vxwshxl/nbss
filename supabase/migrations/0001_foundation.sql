-- ===========================================================================
-- NBSS Guard Operations — Phase 1: foundation
--
-- Roles, sites with geofences, the roster, and the attendance ledger that
-- payroll and client billing are both derived from.
--
-- Two rules run through the whole file:
--
--   1. THE SERVER DECIDES. Distance from a site, worked minutes and overtime
--      are computed in Postgres from stored coordinates and server clocks —
--      never sent up from a phone and trusted. A device's own timestamp is
--      recorded for forensics and otherwise ignored.
--   2. EVERY PUNCH KEEPS ITS EVIDENCE. Accuracy, distance, IP and method are
--      written alongside each check-in, so a dispute six months later has
--      something to read rather than an unexplained row.
--
-- Applied against the `nbss` project over the session pooler.
-- ===========================================================================

-- btree_gist backs the exclusion constraint that stops a guard being rostered
-- to two places at once. The others ship with Supabase already.
create extension if not exists btree_gist;

-- --------------------------------------------------------------------- enums
create type user_role as enum ('admin', 'supervisor', 'guard', 'client');

create type shift_status as enum ('scheduled', 'in_progress', 'completed', 'missed', 'cancelled');

-- 'present' and 'late' are both worked days; the difference is only whether the
-- grace period was met. 'pending_review' is where an override or an auto-close
-- lands, so nothing silently reaches payroll unexamined.
create type attendance_status as enum ('present', 'late', 'absent', 'pending_review', 'rejected');

-- How a punch was allowed. Anything other than 'geofence' means a human or a
-- safety net intervened, and that is worth being able to filter on.
create type punch_method as enum ('geofence', 'supervisor_override', 'auto_close');

-- ------------------------------------------------------------------ profiles
-- One row per person, keyed to the Supabase auth user. Guards sign in with an
-- employee code, not an email — the code lives here and is the only identifier
-- anyone in the field ever types.
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  employee_code   text not null unique,
  role            user_role not null default 'guard',
  full_name       text not null,
  phone           text,
  photo_key       text,
  active          boolean not null default true,
  joined_at       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint employee_code_format check (employee_code ~ '^[A-Z0-9-]{3,20}$')
);

comment on column profiles.photo_key is 'Object key in the nbss R2 bucket, not a URL — links are presigned per request.';

create index profiles_role_idx on profiles (role) where active;

-- --------------------------------------------------------------------- sites
-- A client site with the fence a guard has to be standing inside to punch in.
-- A radius covers almost every case; `polygon` is there for the compound whose
-- shape a circle cannot describe, and takes precedence when present.
create table sites (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  client_name            text,
  address                text,
  district               text,

  lat                    double precision not null check (lat between -90 and 90),
  lng                    double precision not null check (lng between -180 and 180),
  geofence_radius_m      integer not null default 150 check (geofence_radius_m between 25 and 5000),
  polygon                jsonb,

  -- Shift defaults. A roster entry may override them; these are what the
  -- scheduler pre-fills and what overtime is measured against.
  shift_start            time,
  shift_end              time,
  grace_minutes          integer not null default 10 check (grace_minutes between 0 and 120),
  standard_shift_minutes integer not null default 480 check (standard_shift_minutes between 60 and 1440),

  -- A fix looser than this is refused rather than accepted as close enough.
  -- 100 m is a reasonable urban default; a rural site may need loosening.
  max_accuracy_m         integer not null default 100 check (max_accuracy_m between 10 and 1000),

  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index sites_active_idx on sites (active);

-- -------------------------------------------------------------------- shifts
-- The roster. One row is one guard owing one site one window of time.
create table shifts (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites (id) on delete cascade,
  guard_id    uuid not null references profiles (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      shift_status not null default 'scheduled',
  notes       text,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint shift_window check (ends_at > starts_at)
);

-- Double-booking is a scheduling mistake that only shows up when a guard fails
-- to appear somewhere. Cancelled shifts are excluded so a replacement can be
-- rostered over one that was called off.
alter table shifts add constraint shifts_no_overlap
  exclude using gist (
    guard_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled');

create index shifts_site_time_idx  on shifts (site_id, starts_at desc);
create index shifts_guard_time_idx on shifts (guard_id, starts_at desc);

-- ---------------------------------------------------------------- attendance
-- The ledger. Everything payroll and client billing rest on.
create table attendance (
  id                   uuid primary key default gen_random_uuid(),
  shift_id             uuid references shifts (id) on delete set null,
  guard_id             uuid not null references profiles (id) on delete cascade,
  site_id              uuid not null references sites (id) on delete cascade,

  check_in_at          timestamptz,
  check_in_lat         double precision,
  check_in_lng         double precision,
  check_in_accuracy_m  double precision,
  check_in_distance_m  double precision,
  check_in_photo_key   text,
  check_in_method      punch_method not null default 'geofence',

  check_out_at         timestamptz,
  check_out_lat        double precision,
  check_out_lng        double precision,
  check_out_accuracy_m double precision,
  check_out_distance_m double precision,
  check_out_photo_key  text,
  check_out_method     punch_method,

  worked_minutes       integer,
  overtime_minutes     integer,
  status               attendance_status not null default 'present',

  -- Recorded, never trusted. A device clock that disagrees with the server is
  -- itself a signal worth keeping.
  device_reported_at   timestamptz,
  ip                   inet,
  user_agent           text,

  reviewed_by          uuid references profiles (id) on delete set null,
  review_note          text,
  reviewed_at          timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint punch_order check (check_out_at is null or check_in_at is null or check_out_at > check_in_at)
);

-- One open punch per guard: you cannot check in twice without checking out.
create unique index attendance_one_open_per_guard
  on attendance (guard_id) where (check_out_at is null);

create index attendance_guard_day_idx on attendance (guard_id, check_in_at desc);
create index attendance_site_day_idx  on attendance (site_id, check_in_at desc);
create index attendance_review_idx    on attendance (status) where status = 'pending_review';

-- --------------------------------------------------------------- submissions
-- The three public forms, moved off data/submissions.json. A serverless
-- filesystem is wiped on every redeploy, so the file was quietly losing
-- enquiries; this is the same shape, durable.
create table submissions (
  id            text primary key,
  kind          text not null check (kind in ('enquiry', 'quote', 'application')),
  status        text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at    timestamptz not null default now(),

  name          text not null,
  email         text,
  phone         text not null,
  company       text,
  subject       text,
  message       text,

  service       text,
  site_type     text,
  district      text,
  headcount     text,
  start_when    text,

  vacancy_id    text,
  vacancy_title text,
  age           text,
  education     text,
  experience    text,

  user_agent    text,
  remote_ip     text
);

create index submissions_created_idx on submissions (created_at desc);
create index submissions_status_idx  on submissions (status) where status = 'new';

-- ----------------------------------------------------------------- audit log
-- Every privileged action. Append-only by policy: no update or delete grant is
-- ever written for this table.
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles (id) on delete set null,
  actor_code  text,
  action      text not null,
  entity      text,
  entity_id   text,
  detail      jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_actor_idx   on audit_log (actor_id, created_at desc);

-- ===========================================================================
-- Functions
-- ===========================================================================

-- Great-circle distance in metres. Postgres has PostGIS for this, but the whole
-- need here is "how far is this phone from that gate" — one formula against two
-- pairs of floats. Adding a spatial extension to answer it would be a lot of
-- machinery for a scalar.
create or replace function geo_distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

comment on function geo_distance_m is 'Haversine metres between two WGS84 points.';

-- Is a point inside a site's fence? Polygon wins when one is drawn, otherwise
-- the radius. Returns the verdict and the distance, because the caller wants to
-- store the distance whether the punch was allowed or refused.
create or replace function site_fence_check(
  p_site_id uuid, p_lat double precision, p_lng double precision
) returns table (inside boolean, distance_m double precision)
language plpgsql stable
as $$
declare
  s sites%rowtype;
  d double precision;
begin
  select * into s from sites where id = p_site_id;
  if not found then
    raise exception 'unknown site %', p_site_id using errcode = 'no_data_found';
  end if;

  d := geo_distance_m(s.lat, s.lng, p_lat, p_lng);

  -- A drawn polygon replaces the radius entirely rather than intersecting it,
  -- so an operator who traces a compound gets exactly the shape they drew.
  if s.polygon is not null then
    return query select point_in_ring(s.polygon, p_lat, p_lng), d;
  else
    return query select d <= s.geofence_radius_m, d;
  end if;
end;
$$;

-- Ray casting over a GeoJSON linear ring, stored as [[lng,lat], ...].
create or replace function point_in_ring(
  ring jsonb, p_lat double precision, p_lng double precision
) returns boolean
language plpgsql immutable
as $$
declare
  n     integer := jsonb_array_length(ring);
  hit   boolean := false;
  i     integer := 0;
  j     integer;
  xi    double precision; yi double precision;
  xj    double precision; yj double precision;
begin
  if n is null or n < 3 then return false; end if;
  j := n - 1;
  while i < n loop
    xi := (ring -> i ->> 0)::double precision;
    yi := (ring -> i ->> 1)::double precision;
    xj := (ring -> j ->> 0)::double precision;
    yj := (ring -> j ->> 1)::double precision;

    if ((yi > p_lat) <> (yj > p_lat))
       and (p_lng < (xj - xi) * (p_lat - yi) / nullif(yj - yi, 0) + xi) then
      hit := not hit;
    end if;

    j := i;
    i := i + 1;
  end loop;
  return hit;
end;
$$;

-- The signed-in user's role, read without tripping the policies on `profiles`
-- itself. Security definer is what breaks that recursion.
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() in ('admin', 'supervisor'), false) $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() = 'admin', false) $$;

-- Keeps updated_at honest without every writer having to remember it.
create or replace function touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch   before update on profiles   for each row execute function touch_updated_at();
create trigger sites_touch      before update on sites      for each row execute function touch_updated_at();
create trigger shifts_touch     before update on shifts     for each row execute function touch_updated_at();
create trigger attendance_touch before update on attendance for each row execute function touch_updated_at();

-- Worked and overtime minutes, recomputed whenever a punch pair closes. Doing
-- this in a trigger rather than in application code means a manual correction
-- made in the Supabase table editor still produces correct payroll numbers.
create or replace function compute_worked_minutes() returns trigger
language plpgsql
as $$
declare
  standard integer;
begin
  if new.check_in_at is null or new.check_out_at is null then
    new.worked_minutes := null;
    new.overtime_minutes := null;
    return new;
  end if;

  new.worked_minutes := greatest(0, (extract(epoch from (new.check_out_at - new.check_in_at)) / 60)::integer);

  select coalesce(s.standard_shift_minutes, 480) into standard from sites s where s.id = new.site_id;
  new.overtime_minutes := greatest(0, new.worked_minutes - standard);

  return new;
end;
$$;

create trigger attendance_compute
  before insert or update of check_in_at, check_out_at, site_id on attendance
  for each row execute function compute_worked_minutes();

-- ===========================================================================
-- Row Level Security
--
-- Server actions run through the secret key and bypass all of this. These
-- policies are the second wall: if the publishable key is ever used from a
-- browser, a guard still cannot read another guard's row.
-- ===========================================================================

alter table profiles    enable row level security;
alter table sites       enable row level security;
alter table shifts      enable row level security;
alter table attendance  enable row level security;
alter table submissions enable row level security;
alter table audit_log   enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

create policy profiles_staff_read on profiles
  for select using (is_staff());

create policy profiles_self_update on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role() and active = true);

create policy profiles_admin_write on profiles
  for all using (is_admin()) with check (is_admin());

-- sites ---------------------------------------------------------------------
-- Any signed-in worker may read the site list; they have to know where the
-- gate is. Only an admin may move a fence.
create policy sites_read on sites
  for select using (auth.uid() is not null);

create policy sites_admin_write on sites
  for all using (is_admin()) with check (is_admin());

-- shifts --------------------------------------------------------------------
create policy shifts_own_read on shifts
  for select using (guard_id = auth.uid());

create policy shifts_staff_read on shifts
  for select using (is_staff());

create policy shifts_staff_write on shifts
  for all using (is_staff()) with check (is_staff());

-- attendance ----------------------------------------------------------------
create policy attendance_own_read on attendance
  for select using (guard_id = auth.uid());

create policy attendance_staff_read on attendance
  for select using (is_staff());

-- Deliberately no client-side insert or update policy. Every punch goes
-- through a server action that checks the fence first; letting a browser write
-- straight to this table would make the geofence advisory.
create policy attendance_staff_write on attendance
  for all using (is_staff()) with check (is_staff());

-- submissions ---------------------------------------------------------------
create policy submissions_staff_read on submissions
  for select using (is_staff());

create policy submissions_staff_write on submissions
  for all using (is_staff()) with check (is_staff());

-- audit_log -----------------------------------------------------------------
-- Readable by admins, writable by nobody holding a publishable key. Inserts
-- come from server actions on the secret key, which bypasses RLS.
create policy audit_admin_read on audit_log
  for select using (is_admin());
