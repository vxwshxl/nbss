-- ===========================================================================
-- Supervisors and field officers check in and out.
--
-- Until now only a guard (role guard, housekeepers included) could check in. Now:
--
--   · supervisor: at a site they are posted to supervise (an active site_posting),
--     inside its boundary and accurate enough, exactly as a guard. Their posting is
--     their roster, so no shift is no reason for review. Their check-ins count at
--     the site as a guard's do, for the site's client too.
--   · field_officer: from anywhere. The check-in has no site (attendance.site_id is
--     now nullable), records where they were, and they are tracked live until they
--     check out, which they may also do from anywhere. With no shift, a forgotten
--     check-out closes itself after 12 hours.
--
-- Tracking (record_position, record_positions) follows the open check-in for all
-- three roles; a check-in with no site has no boundary verdict. Test and live data
-- for a check-in with no site follow the person's own test flag, as positions do.
-- ===========================================================================

alter table attendance alter column site_id drop not null;

drop policy if exists nbss_test_live on attendance;
create policy nbss_test_live on attendance as restrictive for select to authenticated
  using (coalesce(site_is_test(site_id), profile_is_test(guard_id)) = (select data_test_view()));

CREATE OR REPLACE FUNCTION public.punch_in(p_site_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_device_reported_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_photo_key text DEFAULT NULL::text, p_ip inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_device_id text DEFAULT NULL::text, p_battery smallint DEFAULT NULL::smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_prior    integer := 0;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select role into v_role from profiles where id = v_me and active;
  if v_role is null then
    raise exception 'This account is not active.' using errcode = '42501';
  end if;
  if v_role not in ('guard', 'supervisor', 'field_officer') then
    raise exception 'Only guards, supervisors and field officers check in.'
      using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null or p_accuracy_m is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_accuracy_m < 0 then
    raise exception 'Your location could not be read. Try again with GPS switched on.'
      using errcode = '22023';
  end if;

  -- A field officer checks in wherever they are: no site, no boundary. Where they
  -- were is recorded, and they are tracked live until they check out.
  if v_role = 'field_officer' then
    if p_accuracy_m > 150 then
      raise exception 'Your position is only accurate to ±% m. Step into the open and wait a moment for a fix of ±150 m or better.',
        round(p_accuracy_m) using errcode = 'P0001';
    end if;
    v_flag := device_flag_for(v_me, p_device_id);
    if v_flag is not null then
      v_status := 'pending_review';
      v_notes := array_append(v_notes, case v_flag
        when 'shared_device' then 'Checked in from a phone registered to another person.'
        when 'new_device'    then 'Checked in from a phone not yet approved for this person.'
        else 'Checked in without a device id.'
      end);
    end if;
    begin
      insert into attendance (
        guard_id, site_id, check_in_at, check_in_lat, check_in_lng,
        check_in_accuracy_m, check_in_photo_key, check_in_method,
        status, device_reported_at, ip, user_agent, review_note,
        device_id, device_flag, check_in_battery
      ) values (
        v_me, null, now(), p_lat, p_lng,
        p_accuracy_m, p_photo_key, 'geofence',
        v_status, p_device_reported_at, p_ip, p_user_agent,
        nullif(array_to_string(v_notes, ' '), ''),
        p_device_id, v_flag, p_battery
      )
      returning id into v_id;
    exception when unique_violation then
      raise exception 'You are already checked in. Check out before starting again.'
        using errcode = 'P0001';
    end;

    insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
    values (v_me, 'check_in', 'attendance', v_id::text,
            jsonb_build_object('field', true, 'lat', p_lat, 'lng', p_lng,
                               'accuracy_m', round(p_accuracy_m), 'device_flag', v_flag), p_ip);

    return jsonb_build_object(
      'ok', true,
      'attendance_id', v_id,
      'site_id', null,
      'site_name', null,
      'field', true,
      'status', v_status,
      'off_roster', false,
      'device_flag', v_flag,
      'distance_m', null,
      'checked_in_at', now(),
      'session', 1,
      'mode', tracking_mode_for(null)
    );
  end if;

  select * into v_site from sites where id = p_site_id;
  if not found then raise exception 'That site is not on the register.' using errcode = 'no_data_found'; end if;
  if not v_site.active then
    raise exception '% is not in service.', v_site.name using errcode = 'P0001';
  end if;

  -- A supervisor checks in only at a site they are posted to supervise.
  if v_role = 'supervisor' and not exists (
    select 1 from site_postings where guard_id = v_me and site_id = p_site_id and active
  ) then
    raise exception 'You can check in only at a site you supervise. % is not one of yours.', v_site.name
      using errcode = 'P0001';
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
    -- Back for a second (or later) session of the same duty — after lunch, say. Its own
    -- record, never late: the first session already answered "did they come on time".
    select count(*) into v_prior from attendance where shift_id = v_shift.id and guard_id = v_me;
    if v_prior > 0 then
      v_notes := array_append(v_notes, 'Session ' || (v_prior + 1) || ' of this duty.');
    elsif now() > v_shift.starts_at + make_interval(mins => v_site.grace_minutes) then
      v_status := 'late';
    end if;
  else
    -- A supervisor's posting is their roster: no shift is no reason for review.
    if v_rostered and v_role <> 'supervisor' then
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
      when 'shared_device' then 'Checked in from a phone registered to another person.'
      when 'new_device'    then 'Checked in from a phone not yet approved for this person.'
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
    -- A duty checked out of earlier and now resumed is in progress again.
    update shifts set status = 'in_progress' where id = v_shift.id and status in ('scheduled', 'completed');
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
    'session', v_prior + 1,
    'mode', tracking_mode_for(p_site_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.punch_out(p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_device_reported_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_photo_key text DEFAULT NULL::text, p_ip inet DEFAULT NULL::inet, p_handover text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if v_role is null or v_role not in ('guard', 'supervisor', 'field_officer') then
    raise exception 'Only guards, supervisors and field officers check out.' using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'Your location could not be read. Try again with GPS switched on.'
      using errcode = '22023';
  end if;

  select * into v_open from attendance
  where guard_id = v_me and check_out_at is null
  order by check_in_at desc nulls last limit 1;

  if not found then raise exception 'You are not checked in.' using errcode = 'P0001'; end if;

  -- Field duty (no site): checked out wherever they are, as they checked in.
  if v_open.site_id is null then
    update attendance set
      check_out_at = now(),
      check_out_lat = p_lat,
      check_out_lng = p_lng,
      check_out_accuracy_m = p_accuracy_m,
      check_out_photo_key = p_photo_key,
      check_out_method = 'geofence'
    where id = v_open.id
    returning * into v_out;

    insert into guard_location_history (guard_id, site_id, attendance_id, lat, lng, accuracy_m,
                                        inside_fence, distance_m, recorded_at, ping_reason)
    values (v_me, null, v_open.id, p_lat, p_lng, coalesce(p_accuracy_m, 0), null, null, now(), 'check_out');

    delete from guard_positions where guard_id = v_me;

    update sos_alerts
    set status = 'resolved', closed_at = now(), closed_by = v_me,
        closing_note = coalesce(closing_note, 'Closed automatically at check-out.')
    where raised_by = v_me and status in ('active', 'acknowledged');

    insert into audit_log (actor_id, action, entity, entity_id, detail, ip)
    values (v_me, 'check_out', 'attendance', v_open.id::text,
            jsonb_build_object('field', true, 'worked_minutes', v_out.worked_minutes,
                               'lat', p_lat, 'lng', p_lng), p_ip);

    return jsonb_build_object(
      'ok', true,
      'attendance_id', v_out.id,
      'site_name', null,
      'field', true,
      'worked_minutes', coalesce(v_out.worked_minutes, 0),
      'overtime_minutes', coalesce(v_out.overtime_minutes, 0),
      'distance_m', null,
      'checked_out_at', v_out.check_out_at
    );
  end if;

  select * into v_site from sites where id = v_open.site_id;

  -- At the site, as for checking in: the same accuracy and the same boundary. A guard
  -- who has left without checking out is checked out at the end of the shift instead
  -- (auto_check_out), or by a supervisor.
  if p_accuracy_m is null or p_accuracy_m > v_site.max_accuracy_m then
    raise exception 'Your position is only accurate to ±% m, and % needs ±% m or better. Step into the open and wait a moment for a stronger fix.',
      round(coalesce(p_accuracy_m, 9999)), v_site.name, v_site.max_accuracy_m using errcode = 'P0001';
  end if;

  select inside, distance_m into v_fence from site_fence_check(v_open.site_id, p_lat, p_lng);

  if not v_fence.inside then
    raise exception 'You are % m from %, outside its boundary. Check out at the site.',
      round(v_fence.distance_m), v_site.name using errcode = 'P0001';
  end if;

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
$function$;

CREATE OR REPLACE FUNCTION public.record_positions(p_points jsonb, p_device_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_newest_inside boolean;
  v_newest_distance double precision;
begin
  if v_guard is null then
    return jsonb_build_object('tracked', false, 'reason', 'not_signed_in');
  end if;

  select role into v_role from profiles where id = v_guard and active;
  if v_role is null or v_role not in ('guard', 'supervisor', 'field_officer') then
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

    -- Field duty has no site, so no boundary: inside and distance stay empty.
    if v_open.site_id is null then
      select null::boolean as inside, null::double precision as distance_m into v_fence;
    else
      select inside, distance_m into v_fence from site_fence_check(v_open.site_id, v_pt.lat, v_pt.lng);
    end if;

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
    v_newest_inside := v_fence.inside;
    v_newest_distance := v_fence.distance_m;
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
      v_newest_inside, v_newest_distance, v_mode, v_newest_at,
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
    'inside_fence', v_newest_inside,
    'server_time', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_position(p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_heading double precision DEFAULT NULL::double precision, p_speed_mps double precision DEFAULT NULL::double precision, p_battery smallint DEFAULT NULL::smallint, p_device_reported_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ping_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_guard   uuid := auth.uid();
  v_role    user_role;
  v_open    attendance%rowtype;
  v_fence   record;
  v_last    timestamptz;
  v_mode    tracking_mode;
begin
  if v_guard is null then
    return jsonb_build_object('tracked', false, 'reason', 'not_signed_in');
  end if;

  select role into v_role from profiles where id = v_guard and active;
  if v_role is null or v_role not in ('guard', 'supervisor', 'field_officer') then
    -- Only field staff on duty are tracked: guards, and supervisors and field
    -- officers while they are checked in (the check below). Nobody is followed home.
    return jsonb_build_object('tracked', false, 'reason', 'not_a_guard');
  end if;

  -- Coordinates are checked here rather than left to the column constraints, so
  -- a malformed fix returns a reason the app can log instead of a 400 it cannot
  -- read.
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('tracked', true, 'stored', false, 'reason', 'bad_coordinates');
  end if;

  -- ------------------------------------------------------------------ on duty?
  -- Tracking follows the punch, not the app being open. A guard who has checked
  -- out is not followed home — which is both the decent thing and the reason this
  -- system can be explained to the people it tracks.
  select * into v_open
  from attendance
  where guard_id = v_guard and check_out_at is null
  order by check_in_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('tracked', false, 'reason', 'not_on_duty');
  end if;

  v_mode := tracking_mode_for(v_open.site_id);

  -- --------------------------------------------------------------- throttle
  -- The client's own policy already spaces pings out; this is the floor for a
  -- client that has been edited, or is simply buggy. 'emergency' gets a lower
  -- floor because that is when a dense trail is worth the rows.
  select recorded_at into v_last from guard_positions where guard_id = v_guard;

  if v_last is not null
     and now() - v_last < (case when v_mode = 'emergency' then interval '3 seconds'
                                else interval '10 seconds' end)
  then
    return jsonb_build_object('tracked', true, 'stored', false, 'reason', 'throttled',
                              'mode', v_mode, 'site_id', v_open.site_id);
  end if;

  -- ------------------------------------------------------------ fence verdict
  if v_open.site_id is null then
    select null::boolean as inside, null::double precision as distance_m into v_fence;
  else
    select inside, distance_m into v_fence
    from site_fence_check(v_open.site_id, p_lat, p_lng);
  end if;

  -- ----------------------------------------------------------------- current
  insert into guard_positions as gp (
    guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps,
    battery, inside_fence, distance_m, mode, recorded_at, device_reported_at, ping_reason
  ) values (
    v_guard, v_open.site_id, v_open.id, p_lat, p_lng, p_accuracy_m, p_heading, p_speed_mps,
    p_battery, v_fence.inside, v_fence.distance_m, v_mode, now(), p_device_reported_at, p_ping_reason
  )
  on conflict (guard_id) do update set
    site_id = excluded.site_id,
    attendance_id = excluded.attendance_id,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    heading = excluded.heading,
    speed_mps = excluded.speed_mps,
    battery = excluded.battery,
    inside_fence = excluded.inside_fence,
    distance_m = excluded.distance_m,
    mode = excluded.mode,
    recorded_at = excluded.recorded_at,
    device_reported_at = excluded.device_reported_at,
    ping_reason = excluded.ping_reason;

  -- ----------------------------------------------------------------- history
  insert into guard_location_history (
    guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps,
    battery, inside_fence, distance_m, mode, recorded_at, device_reported_at, ping_reason
  ) values (
    v_guard, v_open.site_id, v_open.id, p_lat, p_lng, p_accuracy_m, p_heading, p_speed_mps,
    p_battery, v_fence.inside, v_fence.distance_m, v_mode, now(), p_device_reported_at, p_ping_reason
  );

  -- Cheap, and it makes "when did we last hear from this phone at all" answerable
  -- without joining to positions.
  update profiles set last_seen_at = now() where id = v_guard;

  return jsonb_build_object(
    'tracked', true,
    'stored', true,
    'mode', v_mode,
    'site_id', v_open.site_id,
    'inside_fence', v_fence.inside,
    'distance_m', round(v_fence.distance_m::numeric, 1),
    'server_time', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.auto_check_out()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v record;
  v_done integer := 0;
begin
  for v in
    select a.id, a.guard_id, a.site_id, a.shift_id, coalesce(s.name, 'Field duty') as site_name,
           coalesce(sh.ends_at, a.check_in_at + make_interval(mins => coalesce(s.standard_shift_minutes, 720))) as ends_at
    from attendance a
    left join sites s on s.id = a.site_id
    left join shifts sh on sh.id = a.shift_id
    where a.check_out_at is null
      and a.check_in_at is not null
      -- Five minutes' grace after the end, time to tap Check out at the gate; one
      -- who forgot is checked out at the end of the shift.
      and coalesce(sh.ends_at, a.check_in_at + make_interval(mins => coalesce(s.standard_shift_minutes, 720))) + interval '5 minutes' <= now()
    for update of a skip locked
  loop
    update attendance
    set check_out_at = greatest(v.ends_at, check_in_at + interval '1 minute'),
        check_out_method = 'auto_close'
    where id = v.id;

    update shifts set status = 'completed' where id = v.shift_id and status = 'in_progress';
    delete from guard_positions where guard_id = v.guard_id;

    perform enqueue_push(array[v.guard_id],
      'Checked out automatically · ' || v.site_name,
      'Your duty ended at ' || ist_clock(v.ends_at)
        || ' and you did not check out within 5 minutes, so you were checked out at ' || ist_clock(v.ends_at) || '. Location sharing has stopped.',
      jsonb_build_object('type', 'check_out', 'attendance_id', v.id));

    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'auto_check_out', 'attendance', v.id::text,
            jsonb_build_object('guard', v.guard_id, 'site', v.site_id, 'at', v.ends_at));

    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$function$;

CREATE OR REPLACE FUNCTION public.attendance_trail_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.check_in_lat is not null and new.check_in_lng is not null then
    insert into guard_location_history (guard_id, site_id, attendance_id, lat, lng, accuracy_m,
                                        inside_fence, distance_m, recorded_at, ping_reason, device_id, battery)
    values (new.guard_id, new.site_id, new.id, new.check_in_lat, new.check_in_lng,
            coalesce(new.check_in_accuracy_m, 0), case when new.site_id is null then null else true end, new.check_in_distance_m,
            coalesce(new.check_in_at, now()), 'check_in', new.device_id, new.check_in_battery);
  end if;
  return new;
end;
$function$;
