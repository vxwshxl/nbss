-- The app's duty view says when a check-out was automatic (0054): the day's
-- attendance and each session carry auto_check_out.

CREATE OR REPLACE FUNCTION public.my_duty_json(p_shift shifts)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                      'auto_check_out', bool_or(check_out_method = 'auto_close'),
                      'worked_minutes', sum(coalesce(worked_minutes, 0)),
                      'overtime_minutes', sum(coalesce(overtime_minutes, 0)),
                      'status', (select status from s order by check_in_at limit 1),
                      'device_flag', (select device_flag from s where device_flag is not null limit 1),
                      'review_note', (select review_note from s where review_note is not null order by check_in_at desc limit 1))
                   from s having count(*) > 0),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
                      'id', id, 'check_in_at', check_in_at, 'check_out_at', check_out_at,
                      'worked_minutes', worked_minutes, 'status', status,
                      'auto_check_out', check_out_method = 'auto_close') order by check_in_at) from s), '[]'::jsonb)
  )
$function$;
