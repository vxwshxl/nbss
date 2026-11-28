-- ===========================================================================
-- Distances in a check-in / check-out refusal read in km past 1000 m.
--
-- punch_in and punch_out told a guard "You are 147848 m from ...". Anything under
-- a kilometre still reads in metres; a kilometre or more reads "147.8 km", as the
-- app and the console already format every other distance (formatDistance / km()).
-- Only the distance-from-site figure changes; the site's boundary radius (always a
-- small number) and the ± accuracy stay in metres.
-- ===========================================================================

create or replace function fmt_metres(m double precision) returns text
language sql immutable
as $$
  select case
    when m is null then '?'
    when m < 1000 then round(m)::text || ' m'
    when m < 10000 then trim(to_char(m / 1000.0, 'FM990.0')) || ' km'
    else round(m / 1000.0)::text || ' km'
  end
$$;

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
    raise exception 'You are % from %, outside its % m boundary. Check in once you are at the gate.',
      fmt_metres(v_fence.distance_m), v_site.name, v_site.geofence_radius_m using errcode = 'P0001';
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
    raise exception 'You are % from %, outside its boundary. Check out at the site.',
      fmt_metres(v_fence.distance_m), v_site.name using errcode = 'P0001';
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
