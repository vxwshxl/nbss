-- A guard's own duty history, by month or year, and one duty in full.
--
-- my_duties() covers a week back and two ahead: enough for "today and coming up",
-- not for "what did I work in March". my_duties_between() takes any period (IST
-- dates, inclusive) and adds check-ins that were not against a rostered duty, so
-- the app's history matches the console's attendance register row for row.
-- my_duty() is the detail screen's read.

create or replace function my_duty_json(p_shift shifts)
returns jsonb
language sql stable security definer set search_path = public
as $$
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
    'attendance', (select jsonb_build_object('id', a.id, 'check_in_at', a.check_in_at,
                                             'check_out_at', a.check_out_at, 'worked_minutes', a.worked_minutes,
                                             'overtime_minutes', a.overtime_minutes, 'status', a.status,
                                             'device_flag', a.device_flag, 'review_note', a.review_note)
                   from attendance a where a.shift_id = p_shift.id and a.guard_id = p_shift.guard_id
                   order by a.check_in_at desc limit 1)
  )
$$;

-- A check-in with no rostered duty behind it, in the same shape.
create or replace function my_attendance_json(p_att attendance)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p_att.id,
    'kind', 'off_roster',
    'starts_at', p_att.check_in_at,
    'ends_at', coalesce(p_att.check_out_at, p_att.check_in_at),
    'status', case when p_att.check_out_at is null then 'in_progress' else 'completed' end,
    'shift_type', null,
    'cancel_reason', null,
    'notes', null,
    'site', (select jsonb_build_object('id', st.id, 'name', st.name, 'address', st.address,
                                       'district', st.district, 'lat', st.lat, 'lng', st.lng,
                                       'geofence_radius_m', st.geofence_radius_m, 'polygon', st.polygon,
                                       'max_accuracy_m', st.max_accuracy_m, 'active', st.active)
             from sites st where st.id = p_att.site_id),
    'replaced_by', null,
    'replacing', null,
    'request', null,
    'attendance', jsonb_build_object('id', p_att.id, 'check_in_at', p_att.check_in_at,
                                     'check_out_at', p_att.check_out_at, 'worked_minutes', p_att.worked_minutes,
                                     'overtime_minutes', p_att.overtime_minutes, 'status', p_att.status,
                                     'device_flag', p_att.device_flag, 'review_note', p_att.review_note)
  )
$$;

revoke all on function my_duty_json(shifts) from public, anon, authenticated;
revoke all on function my_attendance_json(attendance) from public, anon, authenticated;

create or replace function my_duties_between(p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with bounds as (
    select (p_from::timestamp at time zone 'Asia/Kolkata') as lo,
           ((least(p_to, p_from + 400) + 1)::timestamp at time zone 'Asia/Kolkata') as hi
  )
  select coalesce(jsonb_agg(d order by (d ->> 'starts_at')), '[]'::jsonb)
  from (
    select my_duty_json(s) as d
    from shifts s, bounds b
    where s.guard_id = auth.uid()
      and s.starts_at >= b.lo and s.starts_at < b.hi
      and (s.status <> 'cancelled' or s.replaced_by_shift is not null)
    union all
    select my_attendance_json(a)
    from attendance a, bounds b
    where a.guard_id = auth.uid()
      and a.check_in_at >= b.lo and a.check_in_at < b.hi
      and (a.shift_id is null or not exists (select 1 from shifts s where s.id = a.shift_id and s.guard_id = auth.uid()))
  ) x
$$;

create or replace function my_duty(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select my_duty_json(s) from shifts s where s.id = p_id and s.guard_id = auth.uid()),
    (select my_attendance_json(a) from attendance a where a.id = p_id and a.guard_id = auth.uid())
  )
$$;

-- my_duties keeps its window, now in the shared shape.
create or replace function my_duties(p_days_back integer default 7, p_days_ahead integer default 14)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(my_duty_json(s) order by s.starts_at), '[]'::jsonb)
  from shifts s
  where s.guard_id = auth.uid()
    and s.ends_at >= now() - make_interval(days => p_days_back)
    and s.starts_at <= now() + make_interval(days => p_days_ahead)
    and (s.status <> 'cancelled' or s.replaced_by_shift is not null)
$$;

revoke all on function my_duties_between(date, date) from public, anon;
revoke all on function my_duty(uuid) from public, anon;
grant execute on function my_duties_between(date, date) to authenticated;
grant execute on function my_duty(uuid) to authenticated;
