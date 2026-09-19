-- ===========================================================================
-- Check-in and check-out, moved into the database.
--
-- This fixes a bug and removes a duplicate, in that order of importance.
--
-- ── The bug
--
-- `attendance` carries exactly one write policy:
--
--     create policy attendance_staff_write on attendance
--       for all using (is_staff()) with check (is_staff());
--
-- and 0001's header says server actions "run through the secret key and bypass all
-- of this". The duty action does not — it writes through `supabaseServer()`, which
-- carries the signed-in guard's session. So every guard check-in has been refused
-- with 42501, "new row violates row-level security policy for table attendance".
-- Nobody noticed because there is no attendance data yet.
--
-- The obvious repair is to switch that action to the admin client. This does the
-- other thing instead, because the app needs to check in too and an admin client on
-- a guard's phone is out of the question: the rule moves into a security-definer
-- function, and both clients call it. The fence test, the accuracy gate, the
-- lateness calculation and the audit line then exist once, in the one place that
-- already owns the site's coordinates and the clock.
--
-- Every decision is still the server's. The phone sends a coordinate and an
-- accuracy — both attacker-controlled — and nothing else is trusted:
--
--   · distance is recomputed by `site_fence_check` from the site's own record;
--   · the timestamp is `now()`, never the device clock, which is stored beside it
--     as evidence and otherwise ignored;
--   · a fix too imprecise to place someone inside the fence is refused outright,
--     because a ±2 km reading centred on the gate proves nothing.
-- ===========================================================================

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
  v_me     uuid := auth.uid();
  v_role   user_role;
  v_site   sites%rowtype;
  v_fence  record;
  v_status attendance_status := 'present';
  v_due    timestamptz;
  v_id     uuid;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select role into v_role from profiles where id = v_me and active;
  if v_role is null then
    raise exception 'This account is not active.' using errcode = '42501';
  end if;

  -- A punch is evidence that a particular person stood at a particular gate.
  -- Supervisors record attendance for others through the console's override path,
  -- which writes 'supervisor_override' and says who did it.
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

  -- Checked before the fence is consulted at all: a reading whose error radius is
  -- larger than the site allows cannot place anyone anywhere.
  if p_accuracy_m > v_site.max_accuracy_m then
    raise exception 'Your position is only accurate to ±% m, and % needs ±% m or better. Step into the open and wait a moment for a stronger fix.',
      round(p_accuracy_m), v_site.name, v_site.max_accuracy_m using errcode = 'P0001';
  end if;

  select inside, distance_m into v_fence from site_fence_check(p_site_id, p_lat, p_lng);

  if not v_fence.inside then
    -- Refusals are logged too. A guard repeatedly punching from 3 km away is
    -- something a supervisor should be able to see.
    insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
    values (v_me, 'check_in_refused', 'sites', p_site_id::text,
            jsonb_build_object('distance_m', round(v_fence.distance_m),
                               'accuracy_m', round(p_accuracy_m)), p_ip);

    raise exception 'You are % m from %, outside its % m boundary. Check in once you are at the gate.',
      round(v_fence.distance_m), v_site.name, v_site.geofence_radius_m using errcode = 'P0001';
  end if;

  -- Lateness is measured against the site's shift start plus its grace period.
  -- Being late never blocks the punch — it marks it, because a guard who is twenty
  -- minutes late is still on duty and still owed those hours.
  if v_site.shift_start is not null then
    v_due := date_trunc('day', now() at time zone 'Asia/Kolkata')
             + v_site.shift_start
             + make_interval(mins => v_site.grace_minutes);
    -- Compared in IST, which is the only timezone this company operates in and the
    -- one the shift times were entered in.
    if (now() at time zone 'Asia/Kolkata') > v_due then v_status := 'late'; end if;
  end if;

  begin
    insert into attendance (
      guard_id, site_id, check_in_at, check_in_lat, check_in_lng,
      check_in_accuracy_m, check_in_distance_m, check_in_photo_key, check_in_method,
      status, device_reported_at, ip, user_agent,
      -- Linked to the roster entry covering now, when there is one. A guard sent
      -- somewhere at short notice still gets a punch; it simply has no shift.
      shift_id
    ) values (
      v_me, p_site_id, now(), p_lat, p_lng,
      p_accuracy_m, v_fence.distance_m, p_photo_key, 'geofence',
      v_status, p_device_reported_at, p_ip, p_user_agent,
      (select id from shifts
        where guard_id = v_me and site_id = p_site_id and status <> 'cancelled'
          and starts_at - interval '4 hours' <= now()
          and ends_at   + interval '4 hours' >= now()
        order by starts_at limit 1)
    )
    returning id into v_id;
  exception when unique_violation then
    -- The partial unique index on an open punch. Saying so plainly beats surfacing
    -- a constraint name.
    raise exception 'You are already checked in. Check out before starting a new shift.'
      using errcode = 'P0001';
  end;

  -- The roster entry, if there is one, now reflects reality.
  update shifts set status = 'in_progress'
  where id = (select shift_id from attendance where id = v_id) and status = 'scheduled';

  insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
  values (v_me, 'check_in', 'sites', p_site_id::text,
          jsonb_build_object('distance_m', round(v_fence.distance_m),
                             'accuracy_m', round(p_accuracy_m),
                             'status', v_status), p_ip);

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_id,
    'site_id', p_site_id,
    'site_name', v_site.name,
    'status', v_status,
    'distance_m', round(v_fence.distance_m),
    'checked_in_at', now(),
    -- So the app can start the background stream at the right cadence immediately,
    -- rather than waiting for its first ping to find out an SOS is already live.
    'mode', tracking_mode_for(p_site_id)
  );
end;
$$;

create or replace function punch_out(
  p_lat                double precision,
  p_lng                double precision,
  p_accuracy_m         double precision,
  p_device_reported_at timestamptz default null,
  p_photo_key          text        default null,
  p_ip                 inet        default null
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
  if v_role <> 'guard' then raise exception 'Only a guard checks out.' using errcode = '42501'; end if;

  if p_lat is null or p_lng is null then
    raise exception 'Your location could not be read. Try again with GPS switched on.'
      using errcode = '22023';
  end if;

  select * into v_open
  from attendance
  where guard_id = v_me and check_out_at is null
  order by check_in_at desc nulls last
  limit 1;

  if not found then raise exception 'You are not checked in.' using errcode = 'P0001'; end if;

  select * into v_site from sites where id = v_open.site_id;

  -- Distance is recorded on the way out but never used to refuse: a guard whose
  -- shift has ended must always be able to close it. Leaving early shows up as an
  -- unusual check-out distance for a supervisor to ask about, which is the right
  -- way to handle it — a refusal would strand them on shift.
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
  -- worked_minutes and overtime_minutes are filled in by the trigger on this
  -- update, so they are returned from it rather than recomputed here.
  returning * into v_out;

  update shifts set status = 'completed'
  where id = v_open.shift_id and status = 'in_progress';

  -- The guard is off duty, so nothing should still be reporting their position. The
  -- background task learns this from its next ping anyway; clearing the row now
  -- means the live map does not show a dot for someone who has gone home even for
  -- those few seconds.
  delete from guard_positions where guard_id = v_me;

  -- An SOS the guard raised and never closed goes with them. Left open it would keep
  -- every phone on the site in emergency cadence all night.
  update sos_alerts
  set status = 'resolved', closed_at = now(), closed_by = v_me,
      closing_note = coalesce(closing_note, 'Closed automatically when the guard checked out.')
  where raised_by = v_me and status in ('active', 'acknowledged');

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

-- ===========================================================================
-- Grants
--
-- `p_ip` and `p_user_agent` are accepted so the web action can pass what it read
-- from the request headers, which a Postgres function cannot see. A phone can lie
-- about both; so can a browser. They are forensic breadcrumbs, never a control —
-- nothing above branches on them.
-- ===========================================================================
revoke all on function punch_in(uuid, double precision, double precision, double precision,
  timestamptz, text, inet, text) from anon;
grant execute on function punch_in(uuid, double precision, double precision, double precision,
  timestamptz, text, inet, text) to authenticated;

revoke all on function punch_out(double precision, double precision, double precision,
  timestamptz, text, inet) from anon;
grant execute on function punch_out(double precision, double precision, double precision,
  timestamptz, text, inet) to authenticated;
