-- Three rules from the field.
--
-- A guard sees only the sites they work. Sites are read by a guard only where they are
-- posted, rostered, checked in, or have worked (so their history keeps its names); the
-- duty map lists only those, plus a site whose SOS reached them. Creating a site no
-- longer shows it to every guard.
--
-- A check-out forgotten is made an hour after the shift ends, not at the end itself: a
-- guard still working may be on overtime and checks out within the hour, counted as
-- extra time; one who forgot is checked out at the shift's end, with no overtime.

create or replace function guard_may_see_site(p_site uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from site_postings where site_id = p_site and guard_id = auth.uid() and active)
      or exists (select 1 from shifts where site_id = p_site and guard_id = auth.uid())
      or exists (select 1 from attendance where site_id = p_site and guard_id = auth.uid())
$$;
grant execute on function guard_may_see_site(uuid) to authenticated;

drop policy if exists sites_worker_read on sites;
create policy sites_worker_read on sites for select
  using (is_staff() or (my_role() = 'guard'::user_role and guard_may_see_site(id)));

CREATE OR REPLACE FUNCTION public.duty_areas_now()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as id),
  my_sites as (
    select s.site_id from shifts s, me
    where s.guard_id = me.id and s.status in ('scheduled', 'in_progress')
      and s.starts_at < now() + interval '18 hours' and s.ends_at > now() - interval '6 hours'
    union
    select a.site_id from attendance a, me where a.guard_id = me.id and a.check_out_at is null
    union
    -- The standing and dated posts: a guard's own sites even before today's shift exists.
    select sp.site_id from site_postings sp, me where sp.guard_id = me.id and sp.active
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
        -- A guard sees only their own sites (and one with an SOS they were alerted to);
        -- the office sees every site where something is happening.
        and (st.id in (select site_id from my_sites)
             or exists (select 1 from live_sos l where l.site_id = st.id)
             or (is_staff() and (b.site_id is not null or p.site_id is not null)))
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
    select a.id, a.guard_id, a.site_id, a.shift_id, s.name as site_name,
           coalesce(sh.ends_at, a.check_in_at + make_interval(mins => s.standard_shift_minutes)) as ends_at
    from attendance a
    join sites s on s.id = a.site_id
    left join shifts sh on sh.id = a.shift_id
    where a.check_out_at is null
      and a.check_in_at is not null
      -- An hour's grace after the end: a guard still at work may be on overtime and
      -- checks out themselves; one who forgot is checked out at the end of the shift.
      and coalesce(sh.ends_at, a.check_in_at + make_interval(mins => s.standard_shift_minutes)) + interval '1 hour' <= now()
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
        || ' and you did not check out within the hour, so you were checked out at ' || ist_clock(v.ends_at) || '. Location sharing has stopped.',
      jsonb_build_object('type', 'check_out', 'attendance_id', v.id));

    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'auto_check_out', 'attendance', v.id::text,
            jsonb_build_object('guard', v.guard_id, 'site', v.site_id, 'at', v.ends_at));

    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$function$;
