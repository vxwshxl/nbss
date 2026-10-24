-- What a guard's maps show: where duties are going on now, the colleagues on duty
-- with them, and any SOS they may see.
--
-- areas:   active sites with a duty running now (or starting within the hour), or an
--          open check-in. Closed sites never appear.
-- friends: guards checked in right now at a site where the caller is rostered today
--          or checked in. Name, phone and last position only (heard in 20 minutes).
-- alerts:  open SOS the caller may read (the sos_read test), with the raiser's name,
--          phone and position.

create or replace function duty_areas_now()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with me as (select auth.uid() as id),
  my_sites as (
    select s.site_id from shifts s, me
    where s.guard_id = me.id and s.status in ('scheduled', 'in_progress')
      and s.starts_at < now() + interval '18 hours' and s.ends_at > now() - interval '6 hours'
    union
    select a.site_id from attendance a, me where a.guard_id = me.id and a.check_out_at is null
  ),
  busy as (
    select s.site_id, count(distinct s.guard_id) as rostered
    from shifts s
    where s.status in ('scheduled', 'in_progress')
      and s.starts_at < now() + interval '1 hour' and s.ends_at > now()
    group by s.site_id
  ),
  present as (
    select a.site_id, count(*) as on_duty from attendance a where a.check_out_at is null group by a.site_id
  ),
  live_sos as (
    select al.* from sos_alerts al, me
    where al.status in ('active', 'acknowledged')
      and (is_staff() or al.raised_by = me.id
           or exists (select 1 from sos_notifications n where n.alert_id = al.id and n.profile_id = me.id))
  )
  select jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'lat', st.lat, 'lng', st.lng,
        'geofence_radius_m', st.geofence_radius_m, 'polygon', st.polygon,
        'on_duty', coalesce(p.on_duty, 0), 'rostered', coalesce(b.rostered, 0),
        'mine', st.id in (select site_id from my_sites),
        'sos', exists (select 1 from live_sos l where l.site_id = st.id)
      ) order by st.name)
      from sites st
      left join busy b on b.site_id = st.id
      left join present p on p.site_id = st.id
      where st.active
        and (b.site_id is not null or p.site_id is not null
             or st.id in (select site_id from my_sites)
             or exists (select 1 from live_sos l where l.site_id = st.id))
    ), '[]'::jsonb),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.full_name, 'code', pr.employee_code, 'phone', pr.phone,
        'site_id', a.site_id, 'site_name', st.name, 'check_in_at', a.check_in_at,
        'lat', gp.lat, 'lng', gp.lng, 'heading', gp.heading, 'battery', gp.battery,
        'inside', gp.inside_fence, 'heard_at', coalesce(gp.received_at, gp.recorded_at)
      ) order by pr.full_name)
      from attendance a
      join profiles pr on pr.id = a.guard_id
      join sites st on st.id = a.site_id and st.active
      left join guard_positions gp on gp.guard_id = a.guard_id and gp.attendance_id = a.id
        and coalesce(gp.received_at, gp.recorded_at) > now() - interval '20 minutes'
      where a.check_out_at is null
        and a.guard_id <> (select id from me)
        and a.site_id in (select site_id from my_sites)
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'site_id', l.site_id, 'site_name', st.name, 'kind', l.kind, 'status', l.status,
        'raised_at', l.raised_at, 'note', l.note,
        'raised_by', l.raised_by, 'raiser_name', pr.full_name, 'raiser_phone', pr.phone,
        'mine', l.raised_by = (select id from me),
        'lat', coalesce(gp.lat, l.lat), 'lng', coalesce(gp.lng, l.lng),
        'responders', (select count(*) from sos_acknowledgements k where k.alert_id = l.id and k.response <> 'cannot_respond')
      ) order by l.raised_at desc)
      from live_sos l
      join sites st on st.id = l.site_id
      join profiles pr on pr.id = l.raised_by
      left join guard_positions gp on gp.guard_id = l.raised_by
        and coalesce(gp.received_at, gp.recorded_at) > now() - interval '20 minutes'
    ), '[]'::jsonb)
  )
$$;

revoke all on function duty_areas_now() from public, anon;
grant execute on function duty_areas_now() to authenticated;
