-- ===========================================================================
-- The roster: who guards where.
--
-- Until now any active guard could check in at any active site, first come
-- first served, as long as they stood inside its fence. That is wrong for an
-- agency — a client pays for a set number of guards on their gate — and wrong
-- the other way if made strict, because the replacement sent at 3 am when the
-- rostered guard falls ill must still be able to work.
--
-- So it is hybrid:
--
--   · a guard has one standing POSTING — a site, a daily window, the days of
--     the week — and the roster (`shifts`, from 0001) is filled from it a week
--     ahead;
--   · a SITE carries how many guards it needs on at once;
--   · checking in where you are rostered is an ordinary punch;
--   · checking in somewhere you are NOT rostered still works if you are inside
--     the fence, but the punch is held as 'pending_review' and marked
--     `off_roster`, so a supervisor approves the swap rather than never
--     hearing about it;
--   · a rostered shift nobody turned up for becomes 'missed', and one that has
--     started without its guard shows on the dashboard as "not arrived".
--
-- A guard with no posting, at a site with none, is still first come first
-- served — an agency that has not rostered anyone yet loses nothing.
-- ===========================================================================

alter table sites add column if not exists guards_required integer
  check (guards_required is null or guards_required between 1 and 500);

comment on column sites.guards_required is
  'How many guards this site needs on duty at once. Null when not yet agreed.';

create table if not exists site_postings (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites (id) on delete cascade,
  guard_id    uuid not null references profiles (id) on delete cascade,
  -- A daily window in IST. An end at or before the start runs past midnight.
  starts      time not null,
  ends        time not null,
  -- ISO weekdays the window applies on, Monday = 1.
  days        smallint[] not null default '{1,2,3,4,5,6,7}',
  active      boolean not null default true,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint posting_days check (days <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(days) > 0)
);

-- One post per guard. Moving someone is an update, not a second row.
create unique index if not exists site_postings_one_per_guard on site_postings (guard_id) where active;
create index if not exists site_postings_site_idx on site_postings (site_id) where active;

drop trigger if exists site_postings_touch on site_postings;
create trigger site_postings_touch before update on site_postings
  for each row execute function touch_updated_at();

-- Which posting generated a shift, so moving a guard can withdraw the future
-- shifts the old posting wrote without touching hand-made cover shifts.
alter table shifts add column if not exists posting_id uuid references site_postings (id) on delete set null;

alter table attendance add column if not exists off_roster boolean not null default false;

comment on column attendance.off_roster is
  'Checked in at a site the guard was not rostered to. Held for review, never refused.';

alter table site_postings enable row level security;

drop policy if exists site_postings_staff on site_postings;
create policy site_postings_staff on site_postings
  for all using (is_staff()) with check (is_staff());

drop policy if exists site_postings_own_read on site_postings;
create policy site_postings_own_read on site_postings
  for select using (guard_id = auth.uid());

-- --------------------------------------------------------------- filling in

/**
 * Writes the shifts a guard's posting implies from yesterday to `p_days` ahead,
 * skipping any window that already has a shift for that guard (a cover shift,
 * or one written on an earlier run). Idempotent: safe to call as often as liked.
 */
create or replace function roster_fill_guard(p_guard uuid, p_days integer default 7)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_post  site_postings%rowtype;
  v_day   date;
  v_start timestamptz;
  v_end   timestamptz;
  v_made  integer := 0;
begin
  select * into v_post from site_postings where guard_id = p_guard and active;
  if not found then return 0; end if;

  for v_day in
    select d::date from generate_series(
      (now() at time zone 'Asia/Kolkata')::date - 1,
      (now() at time zone 'Asia/Kolkata')::date + p_days,
      interval '1 day') d
  loop
    continue when not (extract(isodow from v_day)::smallint = any (v_post.days));

    v_start := (v_day + v_post.starts) at time zone 'Asia/Kolkata';
    v_end   := (v_day + v_post.ends + case when v_post.ends <= v_post.starts then interval '1 day' else interval '0' end)
               at time zone 'Asia/Kolkata';
    continue when v_end < now();

    if not exists (
      select 1 from shifts
      where guard_id = p_guard and status <> 'cancelled'
        and tstzrange(starts_at, ends_at) && tstzrange(v_start, v_end)
    ) then
      insert into shifts (site_id, guard_id, starts_at, ends_at, posting_id, created_by)
      values (v_post.site_id, p_guard, v_start, v_end, v_post.id, v_post.created_by);
      v_made := v_made + 1;
    end if;
  end loop;

  return v_made;
end;
$$;

create or replace function roster_fill(p_days integer default 7)
returns integer
language sql security definer set search_path = public
as $$ select coalesce(sum(roster_fill_guard(guard_id, p_days)), 0)::integer from site_postings where active $$;

/**
 * A posting changed: withdraw the not-yet-started shifts it (or the guard's
 * previous posting) wrote, then write them again from the new one.
 */
create or replace function roster_on_posting_change() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from shifts
  where guard_id = coalesce(new.guard_id, old.guard_id)
    and posting_id is not null
    and status = 'scheduled'
    and starts_at > now();
  if tg_op <> 'DELETE' and new.active then
    perform roster_fill_guard(new.guard_id);
  end if;
  return null;
end;
$$;

drop trigger if exists site_postings_roster on site_postings;
create trigger site_postings_roster after insert or update or delete on site_postings
  for each row execute function roster_on_posting_change();

/** Shifts whose window has ended without their guard become 'missed'. */
create or replace function roster_mark_missed() returns integer
language sql security definer set search_path = public
as $$
  with m as (
    update shifts set status = 'missed'
    where status = 'scheduled' and ends_at < now()
    returning 1
  )
  select count(*)::integer from m
$$;

revoke all on function roster_fill_guard(uuid, integer) from anon, authenticated;
revoke all on function roster_fill(integer) from anon, authenticated;
revoke all on function roster_mark_missed() from anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('nbss-roster-fill', 'nbss-roster-missed');
  perform cron.schedule('nbss-roster-fill', '5 0 * * *', 'select roster_fill(7)');
  perform cron.schedule('nbss-roster-missed', '*/10 * * * *', 'select roster_mark_missed()');
end $$;

-- ------------------------------------------------------------ checking in

create or replace function punch_in(
  p_site_id            uuid,
  p_lat                double precision,
  p_lng                double precision,
  p_accuracy_m         double precision,
  p_device_reported_at timestamptz default null,
  p_photo_key          text        default null,
  p_ip                 inet        default null,
  p_user_agent         text        default null
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

  -- The roster entry covering now at this site, if any.
  select * into v_shift from shifts
  where guard_id = v_me and site_id = p_site_id and status <> 'cancelled'
    and starts_at - interval '4 hours' <= now()
    and ends_at   + interval '4 hours' >= now()
  order by abs(extract(epoch from starts_at - now())) limit 1;

  -- Is the roster in use for this guard or this site? If neither, this is the
  -- first-come case and nothing is held.
  v_rostered := exists (select 1 from site_postings where active and (guard_id = v_me or site_id = p_site_id))
             or exists (select 1 from shifts where status <> 'cancelled'
                          and (guard_id = v_me or site_id = p_site_id)
                          and starts_at - interval '4 hours' <= now()
                          and ends_at + interval '4 hours' >= now());

  if v_shift.id is not null then
    -- Lateness against the rostered start.
    if now() > v_shift.starts_at + make_interval(mins => v_site.grace_minutes) then v_status := 'late'; end if;
  else
    if v_rostered then
      v_off := true;
      v_status := 'pending_review';
    elsif v_site.shift_start is not null then
      -- Unrostered site: lateness against the site's own shift start, in IST.
      v_due := date_trunc('day', now() at time zone 'Asia/Kolkata')
               + v_site.shift_start
               + make_interval(mins => v_site.grace_minutes);
      if (now() at time zone 'Asia/Kolkata') > v_due then v_status := 'late'; end if;
    end if;
  end if;

  begin
    insert into attendance (
      guard_id, site_id, check_in_at, check_in_lat, check_in_lng,
      check_in_accuracy_m, check_in_distance_m, check_in_photo_key, check_in_method,
      status, device_reported_at, ip, user_agent, shift_id, off_roster, review_note
    ) values (
      v_me, p_site_id, now(), p_lat, p_lng,
      p_accuracy_m, v_fence.distance_m, p_photo_key, 'geofence',
      v_status, p_device_reported_at, p_ip, p_user_agent, v_shift.id, v_off,
      case when v_off then 'Checked in at a site this guard was not rostered to.' end
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
                             'off_roster', v_off), p_ip);

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_id,
    'site_id', p_site_id,
    'site_name', v_site.name,
    'status', v_status,
    'off_roster', v_off,
    'distance_m', round(v_fence.distance_m),
    'checked_in_at', now(),
    'mode', tracking_mode_for(p_site_id)
  );
end;
$$;

-- Live updates for the roster screens.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'site_postings') then
    alter publication supabase_realtime add table site_postings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'shifts') then
    alter publication supabase_realtime add table shifts;
  end if;
end $$;
