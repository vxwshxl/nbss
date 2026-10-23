-- ===========================================================================
-- Field operations: shift types, replacements, the guard's phone, the full
-- path from check-in to check-out, handover notes, bookings by days, an SOS
-- that works off duty, and the email outbox.
--
-- What the agency asked for, in their words, and where each lands:
--
--   "Morning / Evening / Night / 24 Hours"     shift_types, shifts.shift_type
--   "Replacement — if someone is busy we       assign_replacement(), shifts.replaces_shift /
--    assign some guard, the flow should          replaced_by_shift, replacement_requests;
--    not break"                                  roster_fill_guard no longer re-creates a
--                                                shift that was replaced or cancelled
--   "Device specifications, so they don't      guard_devices, register_handset(); a punch from
--    sign in on someone else's"                  a phone not approved for the guard is allowed
--                                                but held for review (attendance.device_flag)
--   "Location tracking all the time wise —     record_positions(): a batch with the phone's own
--    the whole path, not only the road"          timestamps, so a spell without signal is filled
--                                                in afterwards instead of becoming a gap;
--                                                guard_trail() returns the raw path
--   "No. of days of guard required"            service_requests.days_required, shift_types
--   "Proper SOS"                               raise_sos() no longer needs an open punch;
--                                                SOS is also emailed to staff
--   "Including email"                          email_outbox, sent by the push worker
--
-- Two rules from 0001 still hold: the server decides (fence verdicts, times
-- and approvals are computed here), and every exception keeps its evidence
-- (a flagged punch says why it was flagged).
-- ===========================================================================

-- ================================================================ shift types
create table if not exists shift_types (
  code   text primary key check (code in ('morning', 'evening', 'night', 'full_day')),
  label  text not null,
  -- Wall-clock IST. An end at or before the start runs past midnight; equal
  -- start and end is the 24-hour shift.
  starts time not null,
  ends   time not null,
  sort   smallint not null
);

insert into shift_types (code, label, starts, ends, sort) values
  ('morning',  'Morning',  '06:00', '14:00', 1),
  ('evening',  'Evening',  '14:00', '22:00', 2),
  ('night',    'Night',    '22:00', '06:00', 3),
  ('full_day', '24 Hours', '06:00', '06:00', 4)
on conflict (code) do nothing;

alter table shift_types enable row level security;
drop policy if exists shift_types_read on shift_types;
create policy shift_types_read on shift_types for select using (auth.uid() is not null);
drop policy if exists shift_types_admin on shift_types;
create policy shift_types_admin on shift_types for all using (is_admin()) with check (is_admin());

alter table site_postings add column if not exists shift_type text references shift_types (code);
alter table shifts        add column if not exists shift_type text references shift_types (code);

-- ================================================================ replacements
alter table shifts add column if not exists replaces_shift    uuid references shifts (id) on delete set null;
alter table shifts add column if not exists replaced_by_shift uuid references shifts (id) on delete set null;
alter table shifts add column if not exists cancel_reason     text;

comment on column shifts.replaced_by_shift is
  'Set on the original when another guard takes it over. The original is cancelled (so the '
  'overlap rule frees its guard) and the nightly roster fill never writes it again.';

create index if not exists shifts_replaces_idx on shifts (replaces_shift) where replaces_shift is not null;

/**
 * Writes the shifts a guard's postings imply. Changed from 0018 in two ways:
 *
 *   · a window is skipped when the guard already has a live shift there OR when
 *     this posting's own shift there was cancelled or handed to a replacement —
 *     before, the nightly run wrote a replaced shift straight back, which is
 *     the "flow breaks" the desk saw;
 *   · the posting's shift type is copied onto the shift.
 */
create or replace function roster_fill_guard(p_guard uuid, p_days integer default 7)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_post  site_postings%rowtype;
  v_day   date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_start timestamptz;
  v_end   timestamptz;
  v_made  integer := 0;
begin
  for v_post in select * from site_postings where guard_id = p_guard and active loop
    for v_day in
      select d from (
        select unnest(v_post.dates) as d where v_post.dates is not null
        union all
        select g::date from generate_series(v_today - 1, v_today + p_days, interval '1 day') g
        where v_post.dates is null
      ) x
      where d >= v_today - 1
      order by d
    loop
      continue when v_post.dates is null
        and not (extract(isodow from v_day)::smallint = any (v_post.days));

      v_start := (v_day + v_post.starts) at time zone 'Asia/Kolkata';
      v_end   := (v_day + v_post.ends + case when v_post.ends <= v_post.starts then interval '1 day' else interval '0' end)
                 at time zone 'Asia/Kolkata';
      continue when v_end < now();

      if not exists (
        select 1 from shifts
        where guard_id = p_guard
          and tstzrange(starts_at, ends_at) && tstzrange(v_start, v_end)
          and (status <> 'cancelled' or posting_id = v_post.id)
      ) then
        insert into shifts (site_id, guard_id, starts_at, ends_at, posting_id, created_by, shift_type)
        values (v_post.site_id, p_guard, v_start, v_end, v_post.id, v_post.created_by, v_post.shift_type);
        v_made := v_made + 1;
      end if;
    end loop;
  end loop;

  return v_made;
end;
$$;

-- A posting edit withdraws and rewrites the future *scheduled* shifts it made.
-- Cancelled and replaced ones are left alone, so the edit does not resurrect a
-- shift somebody else is now covering.
create or replace function roster_on_posting_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_guard uuid := coalesce(new.guard_id, old.guard_id);
begin
  delete from shifts
  where guard_id = v_guard and posting_id is not null and status = 'scheduled'
    and starts_at > now() and replaced_by_shift is null;
  perform roster_fill_guard(v_guard);
  if tg_op = 'UPDATE' and old.guard_id <> new.guard_id then
    delete from shifts
    where guard_id = old.guard_id and posting_id is not null and status = 'scheduled'
      and starts_at > now() and replaced_by_shift is null;
    perform roster_fill_guard(old.guard_id);
  end if;
  return null;
end;
$$;

-- -------------------------------------------------- replacement requests
-- A guard saying "I can't make this one". It does not move anyone: it puts the
-- shift in front of a supervisor, who picks the replacement.
create table if not exists replacement_requests (
  id                uuid primary key default gen_random_uuid(),
  shift_id          uuid not null references shifts (id) on delete cascade,
  guard_id          uuid not null references profiles (id) on delete cascade,
  reason            text check (reason is null or length(reason) <= 500),
  status            text not null default 'open' check (status in ('open', 'assigned', 'declined', 'withdrawn')),
  replacement_guard uuid references profiles (id) on delete set null,
  handled_by        uuid references profiles (id) on delete set null,
  handled_at        timestamptz,
  created_at        timestamptz not null default now()
);

create unique index if not exists replacement_requests_one_open
  on replacement_requests (shift_id) where status = 'open';
create index if not exists replacement_requests_status_idx on replacement_requests (status, created_at desc);

alter table replacement_requests enable row level security;
drop policy if exists rr_staff on replacement_requests;
create policy rr_staff on replacement_requests for all using (is_staff()) with check (is_staff());
drop policy if exists rr_own_read on replacement_requests;
create policy rr_own_read on replacement_requests for select using (guard_id = auth.uid());

-- ================================================================ email outbox
-- Mail goes out the same way push does: a row here, sent by the worker
-- (apps/web/scripts/push-worker.mjs) through ZeptoMail. The template is named,
-- not rendered, so the HTML lives in one place beside the sign-in email.
create table if not exists email_outbox (
  id         bigserial primary key,
  to_email   text not null,
  to_name    text,
  template   text not null,
  subject    text not null,
  data       jsonb not null default '{}'::jsonb,
  attempts   smallint not null default 0,
  claimed_at timestamptz,
  queued_at  timestamptz not null default now(),
  sent_at    timestamptz,
  failed_at  timestamptz,
  error      text
);

create index if not exists email_outbox_pending_idx on email_outbox (queued_at)
  where sent_at is null and failed_at is null;

alter table email_outbox enable row level security;
drop policy if exists email_outbox_admin_read on email_outbox;
create policy email_outbox_admin_read on email_outbox for select using (is_admin());

/** Queues one email. Addresses that cannot receive mail are skipped quietly. */
create or replace function enqueue_email(
  p_to text, p_name text, p_template text, p_subject text, p_data jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_to is null or p_to !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or p_to ilike '%@staff.nbss.co.in' or p_to ilike '%@example.com' then
    return;
  end if;
  insert into email_outbox (to_email, to_name, template, subject, data)
  values (lower(p_to), p_name, p_template, p_subject, coalesce(p_data, '{}'::jsonb));
  perform pg_notify('nbss_push', '');
end;
$$;

/** Every active admin and supervisor, emailed the same thing. */
create or replace function enqueue_staff_email(p_template text, p_subject text, p_data jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_p record; v_n integer := 0;
begin
  for v_p in
    select full_name, email from profiles
    where active and role in ('developer', 'admin', 'supervisor') and email is not null
  loop
    perform enqueue_email(v_p.email, v_p.full_name, p_template, p_subject, p_data);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

/** A plain push to everyone holding a live token for these people. */
create or replace function enqueue_push(
  p_profiles uuid[], p_title text, p_body text, p_data jsonb, p_channel text default 'default'
) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  insert into push_outbox (token, profile_id, title, body, data, priority, channel_id, sound, ttl_seconds)
  select d.token, d.profile_id, p_title, p_body, p_data, 'high', p_channel, 'default', 86400
  from device_tokens d
  where d.profile_id = any (p_profiles) and d.disabled_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then perform pg_notify('nbss_push', ''); end if;
  return v_n;
end;
$$;

-- Claimed and answered by the worker, as push is.
create or replace function claim_email_batch(p_limit integer default 20)
returns setof email_outbox
language plpgsql security definer set search_path = public
as $$
begin
  update email_outbox set claimed_at = null
  where sent_at is null and failed_at is null and claimed_at < now() - interval '2 minutes';
  update email_outbox set failed_at = now(), error = coalesce(error, 'gave up after 3 attempts')
  where sent_at is null and failed_at is null and claimed_at is null and attempts >= 3;

  return query
  with batch as (
    select id from email_outbox
    where sent_at is null and failed_at is null and claimed_at is null and attempts < 3
    order by queued_at limit p_limit
    for update skip locked
  )
  update email_outbox o set claimed_at = now(), attempts = o.attempts + 1
  from batch where o.id = batch.id
  returning o.*;
end;
$$;

create or replace function record_email_result(p_id bigint, p_ok boolean, p_error text default null)
returns void
language sql security definer set search_path = public
as $$
  update email_outbox
  set sent_at   = case when p_ok then now() end,
      failed_at = case when not p_ok and attempts >= 3 then now() end,
      claimed_at = case when p_ok then claimed_at end,
      error     = case when p_ok then null else left(p_error, 500) end
  where id = p_id
$$;

-- ================================================================ the phone
create table if not exists guard_devices (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles (id) on delete cascade,
  -- A per-installation id the app generates once and keeps in its secure store
  -- (or the browser, in localStorage). Not the IMEI: no app is given that.
  device_id     text not null check (length(device_id) between 8 and 128),
  platform      text,
  brand         text,
  model         text,
  os_version    text,
  app_version   text,
  device_name   text,
  -- approved: this person's phone. pending: seen, not yet approved — punches
  -- from it are held for review. blocked: a supervisor said no.
  status        text not null default 'pending' check (status in ('approved', 'pending', 'blocked')),
  battery       smallint check (battery between 0 and 100),
  charging      boolean,
  location_permission text,
  gps_enabled   boolean,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  approved_by   uuid references profiles (id) on delete set null,
  approved_at   timestamptz,
  unique (profile_id, device_id)
);

create index if not exists guard_devices_device_idx on guard_devices (device_id);

alter table guard_devices enable row level security;
drop policy if exists guard_devices_staff on guard_devices;
create policy guard_devices_staff on guard_devices for all using (is_staff()) with check (is_staff());
drop policy if exists guard_devices_own_read on guard_devices;
create policy guard_devices_own_read on guard_devices for select using (profile_id = auth.uid());

/**
 * Which phone is this, and is it this guard's? Called by the app on every launch
 * and by the console's duty page with a browser id.
 *
 * A guard's first device is approved on the spot. Any later one — or a phone
 * that is already another guard's — is recorded as pending, staff are told, and
 * punches from it are held for review rather than refused (the agency's choice:
 * a guard whose phone broke must still be able to work tonight).
 */
create or replace function register_handset(
  p_device_id   text,
  p_platform    text default null,
  p_brand       text default null,
  p_model       text default null,
  p_os_version  text default null,
  p_app_version text default null,
  p_device_name text default null,
  p_battery     smallint default null,
  p_charging    boolean default null,
  p_location_permission text default null,
  p_gps_enabled boolean default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_profile profiles%rowtype;
  v_row     guard_devices%rowtype;
  v_owner   profiles%rowtype;
  v_status  text;
  v_new     boolean := false;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  if p_device_id is null or length(p_device_id) not between 8 and 128 then
    raise exception 'A device id is required.' using errcode = '22023';
  end if;

  select * into v_profile from profiles where id = v_me and active;
  if not found then raise exception 'This account is not active.' using errcode = '42501'; end if;

  select * into v_row from guard_devices where profile_id = v_me and device_id = p_device_id;

  if not found then
    v_new := true;
    -- Another guard already holds this phone?
    select p.* into v_owner from guard_devices d join profiles p on p.id = d.profile_id
    where d.device_id = p_device_id and d.profile_id <> v_me and d.status = 'approved'
      and p.active and p.role = 'guard'
    limit 1;

    v_status := case
      when v_profile.role <> 'guard' then 'approved'
      when v_owner.id is not null then 'pending'
      when not exists (select 1 from guard_devices where profile_id = v_me and status = 'approved') then 'approved'
      else 'pending'
    end;

    insert into guard_devices (profile_id, device_id, platform, brand, model, os_version, app_version,
                               device_name, status, battery, charging, location_permission, gps_enabled,
                               approved_at)
    values (v_me, p_device_id, p_platform, p_brand, p_model, p_os_version, p_app_version,
            p_device_name, v_status, p_battery, p_charging, p_location_permission, p_gps_enabled,
            case when v_status = 'approved' then now() end)
    returning * into v_row;

    if v_status = 'pending' then
      insert into audit_log (actor_id, actor_code, action, entity, entity_id, detail)
      values (v_me, v_profile.employee_code, 'device_pending', 'guard_devices', v_row.id::text,
              jsonb_build_object('model', p_model, 'brand', p_brand, 'shared_with', v_owner.employee_code));
      perform enqueue_staff_email('device', 'New phone for ' || v_profile.full_name,
        jsonb_build_object('guard', v_profile.full_name, 'code', v_profile.employee_code,
                           'device', trim(coalesce(p_brand, '') || ' ' || coalesce(p_model, 'Unknown phone')),
                           'platform', p_platform, 'os', p_os_version,
                           'shared_with', v_owner.full_name, 'shared_code', v_owner.employee_code));
      perform enqueue_push(
        array(select id from profiles where active and role in ('developer', 'admin', 'supervisor')),
        'New phone · ' || v_profile.full_name,
        coalesce('Already registered to ' || v_owner.full_name || '. ', '')
          || 'Approve it in Devices, or their check-ins stay held for review.',
        jsonb_build_object('type', 'device', 'device_id', v_row.id));
    end if;
  else
    update guard_devices set
      platform = coalesce(p_platform, platform), brand = coalesce(p_brand, brand),
      model = coalesce(p_model, model), os_version = coalesce(p_os_version, os_version),
      app_version = coalesce(p_app_version, app_version), device_name = coalesce(p_device_name, device_name),
      battery = coalesce(p_battery, battery), charging = coalesce(p_charging, charging),
      location_permission = coalesce(p_location_permission, location_permission),
      gps_enabled = coalesce(p_gps_enabled, gps_enabled),
      last_seen_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object('device', v_row.id, 'status', v_row.status, 'new', v_new,
                            'shared_with', v_owner.full_name);
end;
$$;

/**
 * Why a punch from this phone needs a second look, or null when it does not.
 * Only guards are checked.
 */
create or replace function device_flag_for(p_guard uuid, p_device_id text) returns text
language plpgsql stable security definer set search_path = public
as $$
declare v_status text;
begin
  if p_device_id is null then return 'unknown_device'; end if;
  if exists (
    select 1 from guard_devices d join profiles p on p.id = d.profile_id
    where d.device_id = p_device_id and d.profile_id <> p_guard and d.status = 'approved'
      and p.active and p.role = 'guard'
  ) then return 'shared_device'; end if;
  select status into v_status from guard_devices where profile_id = p_guard and device_id = p_device_id;
  if v_status is null or v_status <> 'approved' then return 'new_device'; end if;
  return null;
end;
$$;

-- ================================================================ attendance
alter table attendance add column if not exists device_id     text;
alter table attendance add column if not exists device_flag   text
  check (device_flag is null or device_flag in ('new_device', 'shared_device', 'unknown_device'));
alter table attendance add column if not exists check_in_battery smallint;

-- Overtime against the planned shift when there is one (a 24-hour shift is not
-- sixteen hours of overtime), else against the site's standard as before.
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

  select (extract(epoch from (ends_at - starts_at)) / 60)::integer into standard
  from shifts where id = new.shift_id;
  if standard is null then
    select coalesce(s.standard_shift_minutes, 480) into standard from sites s where s.id = new.site_id;
  end if;
  new.overtime_minutes := greatest(0, new.worked_minutes - standard);

  return new;
end;
$$;

drop trigger if exists attendance_compute on attendance;
create trigger attendance_compute
  before insert or update of check_in_at, check_out_at, site_id, shift_id on attendance
  for each row execute function compute_worked_minutes();

-- --------------------------------------------------------------- punch in
-- 0012's version plus the phone: the device id is recorded on the punch and a
-- phone that is not approved for this guard holds it for review.
drop function if exists punch_in(uuid, double precision, double precision, double precision, timestamptz, text, inet, text);

create or replace function punch_in(
  p_site_id            uuid,
  p_lat                double precision,
  p_lng                double precision,
  p_accuracy_m         double precision,
  p_device_reported_at timestamptz default null,
  p_photo_key          text        default null,
  p_ip                 inet        default null,
  p_user_agent         text        default null,
  p_device_id          text        default null,
  p_battery            smallint    default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me       uuid := auth.uid();
  v_role     user_role;
  v_site     sites%rowtype;
  v_fence    record;
  v_status   attendance_status := 'present';
  v_due      timestamptz;
  v_id       uuid;
  v_shift    shifts%rowtype;
  v_rostered boolean;
  v_off      boolean := false;
  v_flag     text;
  v_notes    text[] := '{}';
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select role into v_role from profiles where id = v_me and active;
  if v_role is null then
    raise exception 'This account is not active.' using errcode = '42501';
  end if;
  if v_role <> 'guard' then
    raise exception 'Only a guard checks in. Supervisors record attendance for others.'
      using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null or p_accuracy_m is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_accuracy_m < 0 then
    raise exception 'Your location could not be read. Try again with GPS switched on.'
      using errcode = '22023';
  end if;

  select * into v_site from sites where id = p_site_id;
  if not found then raise exception 'That site is not on the register.' using errcode = 'no_data_found'; end if;
  if not v_site.active then
    raise exception '% is not in service.', v_site.name using errcode = 'P0001';
  end if;

  if p_accuracy_m > v_site.max_accuracy_m then
    raise exception 'Your position is only accurate to ±% m, and % needs ±% m or better. Step into the open and wait a moment for a stronger fix.',
      round(p_accuracy_m), v_site.name, v_site.max_accuracy_m using errcode = 'P0001';
  end if;

  select inside, distance_m into v_fence from site_fence_check(p_site_id, p_lat, p_lng);

  if not v_fence.inside then
    insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
    values (v_me, 'check_in_refused', 'sites', p_site_id::text,
            jsonb_build_object('distance_m', round(v_fence.distance_m),
                               'accuracy_m', round(p_accuracy_m)), p_ip);
    raise exception 'You are % m from %, outside its % m boundary. Check in once you are at the gate.',
      round(v_fence.distance_m), v_site.name, v_site.geofence_radius_m using errcode = 'P0001';
  end if;

  select * into v_shift from shifts
  where guard_id = v_me and site_id = p_site_id and status <> 'cancelled'
    and starts_at - interval '4 hours' <= now()
    and ends_at   + interval '4 hours' >= now()
  order by abs(extract(epoch from starts_at - now())) limit 1;

  v_rostered := exists (select 1 from site_postings where active and (guard_id = v_me or site_id = p_site_id))
             or exists (select 1 from shifts where status <> 'cancelled'
                          and (guard_id = v_me or site_id = p_site_id)
                          and starts_at - interval '4 hours' <= now()
                          and ends_at + interval '4 hours' >= now());

  if v_shift.id is not null then
    if now() > v_shift.starts_at + make_interval(mins => v_site.grace_minutes) then v_status := 'late'; end if;
  else
    if v_rostered then
      v_off := true;
      v_status := 'pending_review';
      v_notes := array_append(v_notes, 'Checked in at a site this guard was not rostered to.');
    elsif v_site.shift_start is not null then
      v_due := date_trunc('day', now() at time zone 'Asia/Kolkata')
               + v_site.shift_start
               + make_interval(mins => v_site.grace_minutes);
      if (now() at time zone 'Asia/Kolkata') > v_due then v_status := 'late'; end if;
    end if;
  end if;

  v_flag := device_flag_for(v_me, p_device_id);
  if v_flag is not null then
    v_status := 'pending_review';
    v_notes := array_append(v_notes, case v_flag
      when 'shared_device' then 'Checked in from a phone registered to another guard.'
      when 'new_device'    then 'Checked in from a phone not yet approved for this guard.'
      else 'Checked in without a device id.'
    end);
  end if;

  begin
    insert into attendance (
      guard_id, site_id, check_in_at, check_in_lat, check_in_lng,
      check_in_accuracy_m, check_in_distance_m, check_in_photo_key, check_in_method,
      status, device_reported_at, ip, user_agent, shift_id, off_roster, review_note,
      device_id, device_flag, check_in_battery
    ) values (
      v_me, p_site_id, now(), p_lat, p_lng,
      p_accuracy_m, v_fence.distance_m, p_photo_key, 'geofence',
      v_status, p_device_reported_at, p_ip, p_user_agent, v_shift.id, v_off,
      nullif(array_to_string(v_notes, ' '), ''),
      p_device_id, v_flag, p_battery
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You are already checked in. Check out before starting a new shift.'
      using errcode = 'P0001';
  end;

  if v_shift.id is not null then
    update shifts set status = 'in_progress' where id = v_shift.id and status = 'scheduled';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
  values (v_me, 'check_in', 'sites', p_site_id::text,
          jsonb_build_object('distance_m', round(v_fence.distance_m),
                             'accuracy_m', round(p_accuracy_m),
                             'status', v_status,
                             'off_roster', v_off,
                             'device_flag', v_flag), p_ip);

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_id,
    'site_id', p_site_id,
    'site_name', v_site.name,
    'status', v_status,
    'off_roster', v_off,
    'device_flag', v_flag,
    'distance_m', round(v_fence.distance_m),
    'checked_in_at', now(),
    'mode', tracking_mode_for(p_site_id)
  );
end;
$$;

revoke all on function punch_in(uuid, double precision, double precision, double precision,
  timestamptz, text, inet, text, text, smallint) from public, anon;
grant execute on function punch_in(uuid, double precision, double precision, double precision,
  timestamptz, text, inet, text, text, smallint) to authenticated;

-- --------------------------------------------------------------- handover
create table if not exists handover_notes (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites (id) on delete cascade,
  attendance_id uuid references attendance (id) on delete set null,
  author_id     uuid not null references profiles (id) on delete cascade,
  body          text not null check (length(trim(body)) between 1 and 2000),
  created_at    timestamptz not null default now()
);

create index if not exists handover_site_idx on handover_notes (site_id, created_at desc);

alter table handover_notes enable row level security;
drop policy if exists handover_staff on handover_notes;
create policy handover_staff on handover_notes for all using (is_staff()) with check (is_staff());
-- A guard reads the notes for a site they are on or rostered to around now,
-- and their own.
drop policy if exists handover_guard_read on handover_notes;
create policy handover_guard_read on handover_notes for select using (
  author_id = auth.uid()
  or exists (select 1 from attendance a where a.guard_id = auth.uid() and a.site_id = handover_notes.site_id and a.check_out_at is null)
  or exists (select 1 from shifts s where s.guard_id = auth.uid() and s.site_id = handover_notes.site_id
               and s.status <> 'cancelled'
               and s.starts_at - interval '12 hours' <= now() and s.ends_at + interval '4 hours' >= now())
);

drop function if exists punch_out(double precision, double precision, double precision, timestamptz, text, inet);

create or replace function punch_out(
  p_lat                double precision,
  p_lng                double precision,
  p_accuracy_m         double precision,
  p_device_reported_at timestamptz default null,
  p_photo_key          text        default null,
  p_ip                 inet        default null,
  p_handover           text        default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_role  user_role;
  v_open  attendance%rowtype;
  v_site  sites%rowtype;
  v_fence record;
  v_out   attendance%rowtype;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select role into v_role from profiles where id = v_me and active;
  if v_role is distinct from 'guard' then raise exception 'Only a guard checks out.' using errcode = '42501'; end if;

  if p_lat is null or p_lng is null then
    raise exception 'Your location could not be read. Try again with GPS switched on.'
      using errcode = '22023';
  end if;

  select * into v_open from attendance
  where guard_id = v_me and check_out_at is null
  order by check_in_at desc nulls last limit 1;

  if not found then raise exception 'You are not checked in.' using errcode = 'P0001'; end if;

  select * into v_site from sites where id = v_open.site_id;
  select inside, distance_m into v_fence from site_fence_check(v_open.site_id, p_lat, p_lng);

  update attendance set
    check_out_at = now(),
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    check_out_accuracy_m = p_accuracy_m,
    check_out_distance_m = v_fence.distance_m,
    check_out_photo_key = p_photo_key,
    check_out_method = 'geofence'
  where id = v_open.id
  returning * into v_out;

  update shifts set status = 'completed'
  where id = v_open.shift_id and status = 'in_progress';

  -- The last position joins the trail, so the path ends where the guard checked out.
  insert into guard_location_history (guard_id, site_id, attendance_id, lat, lng, accuracy_m,
                                      inside_fence, distance_m, recorded_at, ping_reason)
  values (v_me, v_open.site_id, v_open.id, p_lat, p_lng, coalesce(p_accuracy_m, 0),
          v_fence.inside, v_fence.distance_m, now(), 'check_out');

  delete from guard_positions where guard_id = v_me;

  update sos_alerts
  set status = 'resolved', closed_at = now(), closed_by = v_me,
      closing_note = coalesce(closing_note, 'Closed automatically when the guard checked out.')
  where raised_by = v_me and status in ('active', 'acknowledged');

  if nullif(trim(p_handover), '') is not null then
    insert into handover_notes (site_id, attendance_id, author_id, body)
    values (v_open.site_id, v_open.id, v_me, left(trim(p_handover), 2000));
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
  values (v_me, 'check_out', 'sites', v_open.site_id::text,
          jsonb_build_object('worked_minutes', v_out.worked_minutes,
                             'overtime_minutes', v_out.overtime_minutes,
                             'distance_m', round(v_fence.distance_m)), p_ip);

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_out.id,
    'site_name', v_site.name,
    'worked_minutes', coalesce(v_out.worked_minutes, 0),
    'overtime_minutes', coalesce(v_out.overtime_minutes, 0),
    'distance_m', round(v_fence.distance_m),
    'checked_out_at', v_out.check_out_at
  );
end;
$$;

revoke all on function punch_out(double precision, double precision, double precision,
  timestamptz, text, inet, text) from public, anon;
grant execute on function punch_out(double precision, double precision, double precision,
  timestamptz, text, inet, text) to authenticated;

-- The check-in point starts the trail, as the check-out point ends it.
create or replace function attendance_trail_start() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.check_in_lat is not null and new.check_in_lng is not null then
    insert into guard_location_history (guard_id, site_id, attendance_id, lat, lng, accuracy_m,
                                        inside_fence, distance_m, recorded_at, ping_reason, device_id, battery)
    values (new.guard_id, new.site_id, new.id, new.check_in_lat, new.check_in_lng,
            coalesce(new.check_in_accuracy_m, 0), true, new.check_in_distance_m,
            coalesce(new.check_in_at, now()), 'check_in', new.device_id, new.check_in_battery);
  end if;
  return new;
end;
$$;

-- ================================================================ the path
alter table guard_positions        add column if not exists charging    boolean;
alter table guard_positions        add column if not exists device_id   text;
alter table guard_positions        add column if not exists received_at timestamptz;
alter table guard_location_history add column if not exists charging    boolean;
alter table guard_location_history add column if not exists device_id   text;
alter table guard_location_history add column if not exists received_at timestamptz default now();

create index if not exists glh_attendance_time_idx on guard_location_history (attendance_id, recorded_at);

drop trigger if exists attendance_trail_start on attendance;
create trigger attendance_trail_start after insert on attendance
  for each row execute function attendance_trail_start();

/**
 * Writes a batch of positions for the signed-in guard.
 *
 * p_points: [{ "lat", "lng", "accuracy_m", "heading"?, "speed_mps"?, "at" (epoch ms,
 * the phone's clock), "battery"?, "charging"? }]
 *
 * The phone keeps what it could not send and sends it later, so the trail has
 * the real shape of a walk through a spell without signal. Its timestamps are
 * used for the trail only within the shift (clamped between check-in and now) —
 * a phone cannot write a position into yesterday. Points closer together than
 * the cadence floor are dropped, and only the newest moves the live dot.
 */
create or replace function record_positions(
  p_points    jsonb,
  p_device_id text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_guard   uuid := auth.uid();
  v_role    user_role;
  v_open    attendance%rowtype;
  v_mode    tracking_mode;
  v_floor   interval;
  v_last    timestamptz;
  v_pt      record;
  v_at      timestamptz;
  v_fence   record;
  v_stored  integer := 0;
  v_newest  record;
  v_newest_at timestamptz;
  v_newest_fence record;
begin
  if v_guard is null then
    return jsonb_build_object('tracked', false, 'reason', 'not_signed_in');
  end if;

  select role into v_role from profiles where id = v_guard and active;
  if v_role is null or v_role <> 'guard' then
    return jsonb_build_object('tracked', false, 'reason', 'not_a_guard');
  end if;

  select * into v_open from attendance
  where guard_id = v_guard and check_out_at is null
  order by check_in_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('tracked', false, 'reason', 'not_on_duty');
  end if;

  if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) = 0 then
    return jsonb_build_object('tracked', true, 'stored', 0, 'reason', 'empty');
  end if;

  v_mode  := tracking_mode_for(v_open.site_id);
  v_floor := case when v_mode = 'emergency' then interval '2 seconds' else interval '5 seconds' end;

  select max(recorded_at) into v_last from guard_location_history
  where guard_id = v_guard and attendance_id = v_open.id;

  for v_pt in
    select (p ->> 'lat')::double precision        as lat,
           (p ->> 'lng')::double precision        as lng,
           coalesce((p ->> 'accuracy_m')::double precision, 9999) as acc,
           (p ->> 'heading')::double precision    as heading,
           (p ->> 'speed_mps')::double precision  as speed,
           (p ->> 'battery')::smallint            as battery,
           (p ->> 'charging')::boolean            as charging,
           (p ->> 'at')::double precision         as at_ms
    from jsonb_array_elements(p_points) p
    order by (p ->> 'at')::double precision nulls last
    limit 500
  loop
    continue when v_pt.lat is null or v_pt.lng is null
      or v_pt.lat not between -90 and 90 or v_pt.lng not between -180 and 180
      or v_pt.acc > 1000;

    v_at := least(now(), greatest(v_open.check_in_at,
              coalesce(to_timestamp(v_pt.at_ms / 1000.0), now())));
    continue when v_last is not null and v_at < v_last + v_floor;

    select inside, distance_m into v_fence from site_fence_check(v_open.site_id, v_pt.lat, v_pt.lng);

    insert into guard_location_history (
      guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps,
      battery, charging, inside_fence, distance_m, mode, recorded_at, device_reported_at,
      ping_reason, device_id, received_at
    ) values (
      v_guard, v_open.site_id, v_open.id, v_pt.lat, v_pt.lng, v_pt.acc,
      case when v_pt.heading between 0 and 360 then v_pt.heading end,
      case when v_pt.speed >= 0 then v_pt.speed end,
      case when v_pt.battery between 0 and 100 then v_pt.battery end, v_pt.charging,
      v_fence.inside, v_fence.distance_m, v_mode, v_at,
      to_timestamp(v_pt.at_ms / 1000.0), 'batch', p_device_id, now()
    );

    v_last := v_at;
    v_stored := v_stored + 1;
    v_newest := v_pt;
    v_newest_at := v_at;
    v_newest_fence := v_fence;
  end loop;

  if v_stored > 0 then
    insert into guard_positions as gp (
      guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps,
      battery, charging, inside_fence, distance_m, mode, recorded_at, device_reported_at,
      ping_reason, device_id, received_at
    ) values (
      v_guard, v_open.site_id, v_open.id, v_newest.lat, v_newest.lng, v_newest.acc,
      case when v_newest.heading between 0 and 360 then v_newest.heading end,
      case when v_newest.speed >= 0 then v_newest.speed end,
      case when v_newest.battery between 0 and 100 then v_newest.battery end, v_newest.charging,
      v_newest_fence.inside, v_newest_fence.distance_m, v_mode, v_newest_at,
      to_timestamp(v_newest.at_ms / 1000.0), 'batch', p_device_id, now()
    )
    on conflict (guard_id) do update set
      site_id = excluded.site_id, attendance_id = excluded.attendance_id,
      lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
      heading = excluded.heading, speed_mps = excluded.speed_mps,
      battery = coalesce(excluded.battery, gp.battery), charging = coalesce(excluded.charging, gp.charging),
      inside_fence = excluded.inside_fence, distance_m = excluded.distance_m,
      mode = excluded.mode, recorded_at = excluded.recorded_at,
      device_reported_at = excluded.device_reported_at, ping_reason = excluded.ping_reason,
      device_id = excluded.device_id, received_at = excluded.received_at
    where gp.recorded_at <= excluded.recorded_at or gp.attendance_id is distinct from excluded.attendance_id;
  else
    -- Nothing new for the trail, but the phone is alive: that is worth knowing.
    update guard_positions set received_at = now() where guard_id = v_guard;
  end if;

  update profiles set last_seen_at = now() where id = v_guard;
  if p_device_id is not null then
    update guard_devices set last_seen_at = now() where profile_id = v_guard and device_id = p_device_id;
    if v_stored > 0 then
      update guard_devices set battery = coalesce(v_newest.battery, battery), charging = coalesce(v_newest.charging, charging)
      where profile_id = v_guard and device_id = p_device_id;
    end if;
  end if;

  return jsonb_build_object(
    'tracked', true,
    'stored', v_stored,
    'mode', v_mode,
    'site_id', v_open.site_id,
    'inside_fence', case when v_stored > 0 then v_newest_fence.inside end,
    'server_time', now()
  );
end;
$$;

revoke all on function record_positions(jsonb, text) from public, anon;
grant execute on function record_positions(jsonb, text) to authenticated;

-- The fifteen-second broadcast carries the new fields.
create or replace function broadcast_positions() returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_all   jsonb;
  v_site  record;
begin
  select coalesce(jsonb_agg(row), '[]'::jsonb) into v_all
  from (
    select jsonb_build_object(
      'guard_id',    gp.guard_id,
      'site_id',     gp.site_id,
      'attendance_id', gp.attendance_id,
      'lat',         gp.lat,
      'lng',         gp.lng,
      'accuracy_m',  gp.accuracy_m,
      'heading',     gp.heading,
      'speed_mps',   gp.speed_mps,
      'battery',     gp.battery,
      'charging',    gp.charging,
      'inside_fence', gp.inside_fence,
      'distance_m',  round(gp.distance_m::numeric, 1),
      'mode',        gp.mode,
      'recorded_at', gp.recorded_at,
      'received_at', coalesce(gp.received_at, gp.recorded_at)
    ) as row
    from guard_positions gp
    where coalesce(gp.received_at, gp.recorded_at) > now() - interval '20 minutes'
  ) s;

  if v_all = '[]'::jsonb then return; end if;

  perform realtime.send(jsonb_build_object('at', now(), 'positions', v_all), 'positions', 'live-map', true);

  for v_site in
    select distinct site_id from guard_positions
    where site_id is not null and coalesce(received_at, recorded_at) > now() - interval '20 minutes'
  loop
    perform realtime.send(
      jsonb_build_object(
        'at', now(),
        'positions', (
          select coalesce(jsonb_agg(p), '[]'::jsonb)
          from jsonb_array_elements(v_all) p
          where (p ->> 'site_id')::uuid = v_site.site_id
        )
      ),
      'positions', 'site:' || v_site.site_id, true
    );
  end loop;
end;
$$;

/**
 * One shift's path, for the route history screen: every stored point in order,
 * compact, plus what the screen summarises. Staff, or the guard themself.
 */
create or replace function guard_trail(p_attendance_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_att    attendance%rowtype;
  v_points jsonb;
begin
  select * into v_att from attendance where id = p_attendance_id;
  if not found then return null; end if;
  if not (is_staff() or v_att.guard_id = auth.uid()) then
    raise exception 'Not yours to see.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
           round(h.lat::numeric, 6), round(h.lng::numeric, 6),
           extract(epoch from h.recorded_at)::bigint,
           round(h.accuracy_m::numeric), h.inside_fence, h.battery,
           round(coalesce(h.speed_mps, 0)::numeric, 1), h.ping_reason
         ) order by h.recorded_at), '[]'::jsonb)
  into v_points
  from guard_location_history h
  where h.attendance_id = p_attendance_id;

  return jsonb_build_object(
    'attendance_id', v_att.id,
    'guard_id', v_att.guard_id,
    'site_id', v_att.site_id,
    'check_in_at', v_att.check_in_at,
    'check_out_at', v_att.check_out_at,
    -- [lat, lng, epoch seconds, accuracy m, inside fence, battery %, speed m/s, reason]
    'points', v_points
  );
end;
$$;

revoke all on function guard_trail(uuid) from public, anon;
grant execute on function guard_trail(uuid) to authenticated;

-- ================================================================ replacements
/**
 * Hands one or more shifts to another guard.
 *
 * The originals are cancelled (so the overlap rule frees their guard) and point
 * at the new shifts; the new shifts point back. A shift already running is cut
 * at now — the outgoing guard checks out, the incoming one checks in for the
 * rest. The replacement guard is told by push and email.
 */
create or replace function assign_replacement(
  p_shift_ids  uuid[],
  p_guard      uuid,
  p_reason     text default null,
  p_request_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_guard profiles%rowtype;
  v_old   shifts%rowtype;
  v_site  sites%rowtype;
  v_orig  profiles%rowtype;
  v_new   uuid;
  v_start timestamptz;
  v_made  integer := 0;
  v_lines text[] := '{}';
  v_sites text[] := '{}';
begin
  if v_me is null or not is_staff() then
    raise exception 'Only a supervisor assigns a replacement.' using errcode = '42501';
  end if;

  select * into v_guard from profiles where id = p_guard;
  if not found or v_guard.role <> 'guard' or not v_guard.active then
    raise exception 'Choose an active guard as the replacement.' using errcode = '22023';
  end if;

  for v_old in
    select * from shifts where id = any (p_shift_ids) order by starts_at for update
  loop
    if v_old.guard_id = p_guard then
      raise exception '% is already the guard on that shift.', v_guard.full_name using errcode = 'P0001';
    end if;
    if v_old.status not in ('scheduled', 'in_progress', 'missed') or v_old.replaced_by_shift is not null then
      raise exception 'A shift that is % cannot be handed over.', v_old.status using errcode = 'P0001';
    end if;
    if v_old.ends_at <= now() then
      raise exception 'That shift has already ended.' using errcode = 'P0001';
    end if;

    select * into v_site from sites where id = v_old.site_id;
    select * into v_orig from profiles where id = v_old.guard_id;
    v_start := greatest(v_old.starts_at, case when v_old.status = 'in_progress' then now() else v_old.starts_at end);

    -- The original first, so the overlap rule does not see two guards' shifts as one.
    update shifts set
      status = case when v_old.status = 'in_progress' then 'in_progress'::shift_status else 'cancelled'::shift_status end,
      ends_at = case when v_old.status = 'in_progress' then greatest(now(), starts_at + interval '1 minute') else ends_at end,
      cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Replaced')
    where id = v_old.id;

    begin
      insert into shifts (site_id, guard_id, starts_at, ends_at, status, notes, created_by,
                          shift_type, replaces_shift)
      values (v_old.site_id, p_guard, v_start, v_old.ends_at, 'scheduled',
              'Replacing ' || v_orig.full_name, v_me, v_old.shift_type, v_old.id)
      returning id into v_new;
    exception when exclusion_violation then
      raise exception '% already has a shift overlapping % on %.',
        v_guard.full_name, v_site.name,
        to_char(v_old.starts_at at time zone 'Asia/Kolkata', 'DD Mon, HH24:MI')
        using errcode = 'P0001';
    end;

    update shifts set replaced_by_shift = v_new where id = v_old.id;

    v_made := v_made + 1;
    v_lines := v_lines || (to_char(v_start at time zone 'Asia/Kolkata', 'Dy DD Mon, HH24:MI') || '–'
                          || to_char(v_old.ends_at at time zone 'Asia/Kolkata', 'HH24:MI') || ' at ' || v_site.name);
    v_sites := v_sites || v_site.name;
  end loop;

  if v_made = 0 then
    raise exception 'Choose at least one shift to hand over.' using errcode = '22023';
  end if;

  if p_request_id is not null then
    update replacement_requests
    set status = 'assigned', replacement_guard = p_guard, handled_by = v_me, handled_at = now()
    where id = p_request_id and status = 'open';
  end if;
  -- Any other open request for these shifts is answered by the same act.
  update replacement_requests
  set status = 'assigned', replacement_guard = p_guard, handled_by = v_me, handled_at = now()
  where shift_id = any (p_shift_ids) and status = 'open';

  perform enqueue_push(array[p_guard],
    'New duty · ' || v_sites[1],
    case when v_made = 1 then 'You are replacing ' || v_orig.full_name || ': ' || v_lines[1]
         else 'You have ' || v_made || ' replacement duties. Open the app to see them.' end,
    jsonb_build_object('type', 'duty'));

  perform enqueue_email(v_guard.email, v_guard.full_name, 'duty',
    case when v_made = 1 then 'New duty: ' || v_lines[1] else v_made || ' new duties assigned to you' end,
    jsonb_build_object('guard', v_guard.full_name, 'replacing', v_orig.full_name,
                       'lines', to_jsonb(v_lines), 'reason', nullif(trim(p_reason), '')));

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_me, 'replacement_assigned', 'profiles', p_guard::text,
          jsonb_build_object('shifts', to_jsonb(p_shift_ids), 'reason', p_reason, 'count', v_made));

  return jsonb_build_object('ok', true, 'count', v_made);
end;
$$;

revoke all on function assign_replacement(uuid[], uuid, text, uuid) from public, anon;
grant execute on function assign_replacement(uuid[], uuid, text, uuid) to authenticated;

/** A guard asking to be replaced on one of their shifts. */
create or replace function request_replacement(p_shift_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_me_p  profiles%rowtype;
  v_shift shifts%rowtype;
  v_site  sites%rowtype;
  v_id    uuid;
  v_when  text;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  select * into v_me_p from profiles where id = v_me and active;

  select * into v_shift from shifts where id = p_shift_id and guard_id = v_me;
  if not found then raise exception 'That duty is not yours.' using errcode = '42501'; end if;
  if v_shift.status not in ('scheduled', 'in_progress') or v_shift.ends_at <= now() then
    raise exception 'That duty can no longer be changed.' using errcode = 'P0001';
  end if;

  select * into v_site from sites where id = v_shift.site_id;
  v_when := to_char(v_shift.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH24:MI');

  begin
    insert into replacement_requests (shift_id, guard_id, reason)
    values (p_shift_id, v_me, nullif(trim(p_reason), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You have already asked for this duty to be covered.' using errcode = 'P0001';
  end;

  perform enqueue_push(
    array(select id from profiles where active and role in ('developer', 'admin', 'supervisor')),
    'Replacement needed · ' || v_site.name,
    v_me_p.full_name || ' cannot make ' || v_when || coalesce(': ' || nullif(trim(p_reason), ''), '.'),
    jsonb_build_object('type', 'replacement', 'request_id', v_id));

  perform enqueue_staff_email('replacement_request', 'Replacement needed: ' || v_site.name || ', ' || v_when,
    jsonb_build_object('guard', v_me_p.full_name, 'code', v_me_p.employee_code, 'site', v_site.name,
                       'when', v_when, 'reason', nullif(trim(p_reason), '')));

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_me, 'replacement_requested', 'shifts', p_shift_id::text, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'request_id', v_id);
end;
$$;

create or replace function withdraw_replacement_request(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  update replacement_requests set status = 'withdrawn', handled_at = now()
  where id = p_request_id and guard_id = auth.uid() and status = 'open';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'That request is no longer open.' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function request_replacement(uuid, text) from public, anon;
grant execute on function request_replacement(uuid, text) to authenticated;
revoke all on function withdraw_replacement_request(uuid) from public, anon;
grant execute on function withdraw_replacement_request(uuid) to authenticated;

/**
 * A guard's duties, for the app's home screen: everything from `p_days_back`
 * days ago to `p_days_ahead` ahead, with the site, the punch against it, and who
 * replaced whom — names a guard cannot read from `profiles` directly.
 */
create or replace function my_duties(p_days_back integer default 7, p_days_ahead integer default 14)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(d order by (d ->> 'starts_at')), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', s.id,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'status', s.status,
      'shift_type', s.shift_type,
      'cancel_reason', s.cancel_reason,
      'site', jsonb_build_object('id', st.id, 'name', st.name, 'address', st.address,
                                 'district', st.district, 'lat', st.lat, 'lng', st.lng,
                                 'geofence_radius_m', st.geofence_radius_m, 'polygon', st.polygon,
                                 'max_accuracy_m', st.max_accuracy_m),
      'replaced_by', (select p.full_name from shifts r join profiles p on p.id = r.guard_id where r.id = s.replaced_by_shift),
      'replacing', (select p.full_name from shifts o join profiles p on p.id = o.guard_id where o.id = s.replaces_shift),
      'request', (select jsonb_build_object('id', rr.id, 'status', rr.status, 'reason', rr.reason)
                  from replacement_requests rr where rr.shift_id = s.id and rr.guard_id = auth.uid()
                  order by rr.created_at desc limit 1),
      'attendance', (select jsonb_build_object('id', a.id, 'check_in_at', a.check_in_at,
                                               'check_out_at', a.check_out_at, 'worked_minutes', a.worked_minutes,
                                               'status', a.status)
                     from attendance a where a.shift_id = s.id and a.guard_id = auth.uid()
                     order by a.check_in_at desc limit 1)
    ) as d
    from shifts s
    join sites st on st.id = s.site_id
    where s.guard_id = auth.uid()
      and s.ends_at >= now() - make_interval(days => p_days_back)
      and s.starts_at <= now() + make_interval(days => p_days_ahead)
      and (s.status <> 'cancelled' or s.replaced_by_shift is not null)
  ) x
$$;

revoke all on function my_duties(integer, integer) from public, anon;
grant execute on function my_duties(integer, integer) to authenticated;

-- ================================================================ bookings
alter table service_requests add column if not exists days_required   integer check (days_required between 1 and 3650);
alter table service_requests add column if not exists shift_types     text[];
alter table service_requests add column if not exists end_date        date;

drop function if exists submit_service_request(text, text, text, text, text, text, text, text,
  double precision, double precision, integer, boolean, text, date, integer, text, text);

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
  p_source          text    default 'app',
  p_days_required   integer default null,
  p_shift_types     text[]  default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_ref   text := next_service_reference();
  v_id    uuid;
  v_open  integer;
  v_types text[];
  v_email text;
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
  if p_days_required is not null and p_days_required not between 1 and 3650 then
    raise exception 'Number of days must be between 1 and 3650.' using errcode = '22023';
  end if;

  v_types := array(select distinct t from unnest(coalesce(p_shift_types, '{}')) t
                   where t in ('morning', 'evening', 'night', 'full_day'));

  select count(*) into v_open from service_requests
  where client_id = v_me and created_at > now() - interval '1 hour';
  if v_open >= 5 then
    raise exception 'That is five requests in an hour. Ring the deployment desk instead — someone will pick up.'
      using errcode = 'P0001';
  end if;

  insert into service_requests (
    reference, client_id, contact_name, organisation, email, phone,
    service_type, site_type, district, address, lat, lng,
    guards_required, armed, shift_pattern, start_date, duration_months, notes, source,
    days_required, shift_types, end_date
  ) values (
    v_ref, v_me, trim(p_contact_name), nullif(trim(p_organisation), ''),
    nullif(trim(p_email), ''), trim(p_phone),
    trim(p_service_type), nullif(trim(p_site_type), ''), nullif(trim(p_district), ''),
    nullif(trim(p_address), ''), p_lat, p_lng,
    p_guards_required, coalesce(p_armed, false),
    case when p_shift_pattern in ('24x7', 'day', 'night', 'custom') then p_shift_pattern
         when 'full_day' = any (v_types) then '24x7'
         when cardinality(v_types) > 0 then 'custom' end,
    p_start_date, p_duration_months, nullif(trim(p_notes), ''),
    case when p_source in ('web', 'app') then p_source else 'app' end,
    p_days_required, nullif(v_types, '{}'),
    case when p_start_date is not null and p_days_required is not null then p_start_date + (p_days_required - 1) end
  )
  returning id into v_id;

  select coalesce(nullif(trim(p_email), ''), email) into v_email from profiles where id = v_me;
  perform enqueue_email(v_email, trim(p_contact_name), 'booking',
    'Booking received · ' || v_ref,
    jsonb_build_object('reference', v_ref, 'status', 'new', 'name', trim(p_contact_name),
                       'guards', p_guards_required, 'days', p_days_required,
                       'shifts', to_jsonb(v_types), 'start', p_start_date, 'district', p_district));
  perform enqueue_staff_email('booking_staff', 'New booking ' || v_ref || ' · ' || trim(p_contact_name),
    jsonb_build_object('reference', v_ref, 'name', trim(p_contact_name), 'organisation', p_organisation,
                       'phone', p_phone, 'guards', p_guards_required, 'days', p_days_required,
                       'shifts', to_jsonb(v_types), 'start', p_start_date, 'district', p_district));

  return jsonb_build_object('id', v_id, 'reference', v_ref, 'status', 'new');
end;
$$;

revoke all on function submit_service_request(text, text, text, text, text, text, text, text,
  double precision, double precision, integer, boolean, text, date, integer, text, text, integer, text[]) from public, anon;
grant execute on function submit_service_request(text, text, text, text, text, text, text, text,
  double precision, double precision, integer, boolean, text, date, integer, text, text, integer, text[]) to authenticated;

-- The client hears when their booking moves.
create or replace function notify_booking_status() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  if new.status is not distinct from old.status
     or new.status not in ('quoted', 'accepted', 'declined', 'converted') then
    return new;
  end if;
  select coalesce(new.email, p.email) into v_email from profiles p where p.id = new.client_id;
  v_email := coalesce(v_email, new.email);
  perform enqueue_email(v_email, new.contact_name, 'booking',
    'Booking ' || new.reference || ' · ' || initcap(new.status::text),
    jsonb_build_object('reference', new.reference, 'status', new.status, 'name', new.contact_name,
                       'guards', new.guards_required, 'days', new.days_required,
                       'shifts', to_jsonb(new.shift_types), 'start', new.start_date,
                       'quote_paise', new.quoted_amount_paise, 'quote_note', new.quote_note));
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists service_requests_notify on service_requests;
create trigger service_requests_notify after update of status on service_requests
  for each row execute function notify_booking_status();

-- ================================================================ SOS
/**
 * raise_sos, now reachable off duty. A guard walking to the gate, or one whose
 * check-in failed, still has a site to raise it against: the shift they are due
 * at, else the nearest site to where they are. Staff are emailed as well as
 * pushed, so an alert reaches someone even before any phone has registered.
 */
create or replace function raise_sos(
  p_kind       sos_kind          default 'other',
  p_lat        double precision  default null,
  p_lng        double precision  default null,
  p_accuracy_m double precision  default null,
  p_note       text              default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_guard   uuid := auth.uid();
  v_profile profiles%rowtype;
  v_open    attendance%rowtype;
  v_site_id uuid;
  v_site    sites%rowtype;
  v_alert   sos_alerts%rowtype;
  v_inside  boolean;
  v_queued  integer;
  v_repeat  boolean := false;
begin
  if v_guard is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select * into v_profile from profiles where id = v_guard and active;
  if not found then
    raise exception 'This account is not active.' using errcode = '42501';
  end if;

  select * into v_open from attendance
  where guard_id = v_guard and check_out_at is null
  order by check_in_at desc nulls last limit 1;
  v_site_id := v_open.site_id;

  if v_site_id is null then
    select site_id into v_site_id from shifts
    where guard_id = v_guard and status in ('scheduled', 'in_progress', 'missed')
      and starts_at - interval '12 hours' <= now() and ends_at + interval '4 hours' >= now()
    order by abs(extract(epoch from starts_at - now())) limit 1;
  end if;

  if v_site_id is null and p_lat is not null and p_lng is not null then
    select id into v_site_id from sites where active
    order by geo_distance_m(lat, lng, p_lat, p_lng) limit 1;
  end if;

  if v_site_id is null then
    select site_id into v_site_id from site_postings where guard_id = v_guard and active limit 1;
  end if;

  if v_site_id is null then
    raise exception 'No site could be found to raise this against. Call the office.' using errcode = 'P0001';
  end if;

  select * into v_site from sites where id = v_site_id;

  -- A scalar rather than a record: with no coordinates a record would be left
  -- unassigned, and reading it raised — so pressing SOS again indoors failed.
  if p_lat is not null and p_lng is not null then
    select inside into v_inside from site_fence_check(v_site_id, p_lat, p_lng);
  end if;

  select * into v_alert from sos_alerts
  where raised_by = v_guard and status in ('active', 'acknowledged');

  if found then
    v_repeat := true;
    update sos_alerts
    set lat = coalesce(p_lat, lat),
        lng = coalesce(p_lng, lng),
        accuracy_m = coalesce(p_accuracy_m, accuracy_m),
        inside_fence = coalesce(v_inside, inside_fence),
        note = coalesce(p_note, note),
        kind = case when p_kind <> 'other' then p_kind else kind end
    where id = v_alert.id
    returning * into v_alert;
  else
    insert into sos_alerts (site_id, raised_by, attendance_id, kind, note, lat, lng, accuracy_m, inside_fence)
    values (v_site_id, v_guard, v_open.id, p_kind, p_note, p_lat, p_lng, p_accuracy_m, v_inside)
    returning * into v_alert;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'id', v_alert.id, 'site_id', v_alert.site_id, 'raised_by', v_alert.raised_by,
      'status', v_alert.status, 'kind', v_alert.kind, 'note', v_alert.note,
      'lat', v_alert.lat, 'lng', v_alert.lng, 'raised_at', v_alert.raised_at,
      'repeat', v_repeat
    ),
    'sos', 'site:' || v_alert.site_id, true
  );
  perform realtime.send(
    jsonb_build_object(
      'id', v_alert.id, 'site_id', v_alert.site_id, 'raised_by', v_alert.raised_by,
      'status', v_alert.status, 'kind', v_alert.kind, 'lat', v_alert.lat, 'lng', v_alert.lng,
      'raised_at', v_alert.raised_at, 'repeat', v_repeat
    ),
    'sos', 'live-map', true
  );

  v_queued := enqueue_sos_push(v_alert.id, v_repeat);
  perform drain_push_outbox();

  if not v_repeat then
    perform enqueue_staff_email('sos', 'SOS · ' || v_site.name || ' · ' || v_profile.full_name,
      jsonb_build_object('alert_id', v_alert.id, 'guard', v_profile.full_name, 'code', v_profile.employee_code,
                         'phone', v_profile.phone, 'site', v_site.name, 'kind', v_alert.kind,
                         'note', v_alert.note, 'lat', v_alert.lat, 'lng', v_alert.lng,
                         'raised_at', v_alert.raised_at, 'on_duty', v_open.id is not null));
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_guard, 'sos.raise', 'sos_alerts', v_alert.id::text,
          jsonb_build_object('site_id', v_alert.site_id, 'kind', v_alert.kind,
                             'repeat', v_repeat, 'pushes', v_queued, 'on_duty', v_open.id is not null));

  return jsonb_build_object(
    'alert_id', v_alert.id,
    'site_id',  v_alert.site_id,
    'site_name', v_site.name,
    'status',   v_alert.status,
    'repeat',   v_repeat,
    'notified', v_queued,
    'raised_at', v_alert.raised_at
  );
end;
$$;

grant execute on function raise_sos(sos_kind, double precision, double precision, double precision, text) to authenticated;

-- ================================================================ realtime
do $$
declare t text;
begin
  foreach t in array array['replacement_requests', 'guard_devices', 'handover_notes'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ================================================================ grants
-- Internal: only security-definer callers, cron and the worker.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('enqueue_email', 'enqueue_staff_email', 'enqueue_push',
                        'claim_email_batch', 'record_email_result', 'device_flag_for',
                        'roster_fill_guard', 'attendance_trail_start', 'notify_booking_status')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on function register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean) from public, anon;
grant execute on function register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean) to authenticated;
