-- A duty worked in more than one session: in at 7:59, out at 12:00, in again at 13:00,
-- out at 20:00. Each session has always been its own attendance record (nothing is
-- overwritten); what was wrong was around it:
--   * the return was marked late (13:00 is after the 8:00 start) — now a second or
--     later session of the same duty is never late;
--   * the first check-out marked the duty completed, and it stayed so while the guard
--     was back on duty — now resuming puts it back in progress;
--   * the app and the console showed only the latest session — my_duty_json now
--     carries every session, with the day's first in, last out and total hours.

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
  v_prior    integer := 0;
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
    -- Back for a second (or later) session of the same duty — after lunch, say. Its own
    -- record, never late: the first session already answered "did they come on time".
    select count(*) into v_prior from attendance where shift_id = v_shift.id and guard_id = v_me;
    if v_prior > 0 then
      v_notes := array_append(v_notes, 'Session ' || (v_prior + 1) || ' of this duty.');
    elsif now() > v_shift.starts_at + make_interval(mins => v_site.grace_minutes) then
      v_status := 'late';
    end if;
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
$$;

create or replace function my_duty_json(p_shift shifts)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with s as (
    select a.* from attendance a
    where a.shift_id = p_shift.id and a.guard_id = p_shift.guard_id
    order by a.check_in_at
  )
  select jsonb_build_object(
    'id', p_shift.id,
    'kind', 'shift',
    'starts_at', p_shift.starts_at,
    'ends_at', p_shift.ends_at,
    'status', p_shift.status,
    'shift_type', p_shift.shift_type,
    'cancel_reason', p_shift.cancel_reason,
    'notes', p_shift.notes,
    'site', (select jsonb_build_object('id', st.id, 'name', st.name, 'address', st.address,
                                       'district', st.district, 'lat', st.lat, 'lng', st.lng,
                                       'geofence_radius_m', st.geofence_radius_m, 'polygon', st.polygon,
                                       'max_accuracy_m', st.max_accuracy_m, 'active', st.active)
             from sites st where st.id = p_shift.site_id),
    'replaced_by', (select p.full_name from shifts r join profiles p on p.id = r.guard_id where r.id = p_shift.replaced_by_shift),
    'replacing', (select p.full_name from shifts o join profiles p on p.id = o.guard_id where o.id = p_shift.replaces_shift),
    'request', (select jsonb_build_object('id', rr.id, 'status', rr.status, 'reason', rr.reason)
                from replacement_requests rr where rr.shift_id = p_shift.id and rr.guard_id = p_shift.guard_id
                order by rr.created_at desc limit 1),
    -- The day as a whole: first in, last out (none while a session is open), total worked.
    'attendance', (select jsonb_build_object(
                      'id', (select id from s order by check_in_at desc limit 1),
                      'check_in_at', min(check_in_at),
                      'check_out_at', case when bool_or(check_out_at is null) then null else max(check_out_at) end,
                      'worked_minutes', sum(coalesce(worked_minutes, 0)),
                      'overtime_minutes', sum(coalesce(overtime_minutes, 0)),
                      'status', (select status from s order by check_in_at limit 1),
                      'device_flag', (select device_flag from s where device_flag is not null limit 1),
                      'review_note', (select review_note from s where review_note is not null order by check_in_at desc limit 1))
                   from s having count(*) > 0),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
                      'id', id, 'check_in_at', check_in_at, 'check_out_at', check_out_at,
                      'worked_minutes', worked_minutes, 'status', status) order by check_in_at) from s), '[]'::jsonb)
  )
$$;
