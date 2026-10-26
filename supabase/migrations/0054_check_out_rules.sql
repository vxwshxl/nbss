-- Checking out happens at the site, and a forgotten check-out happens by itself.
--
-- punch_out now asks what punch_in asks: a fix accurate enough for the site and a
-- position inside its boundary. Before, it recorded the distance but accepted a
-- check-out from anywhere, so a guard could leave and check out from home.
--
-- auto_check_out() runs every minute. Anyone still checked in when their shift ends
-- is checked out at exactly the shift's end, marked auto_close (shown as "Auto
-- check-out" on the website and in the app) and told so on their phone. A punch with
-- no shift ends after the site's standard shift length. The phone stops tracking on
-- its next batch, when the server answers that the shift is closed.

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


create or replace function auto_check_out() returns integer
language plpgsql security definer set search_path = public
as $$
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
      and coalesce(sh.ends_at, a.check_in_at + make_interval(mins => s.standard_shift_minutes)) <= now()
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
      'Your duty ended at ' || to_char(v.ends_at at time zone 'Asia/Kolkata', 'HH24:MI')
        || ', so you were checked out. Location sharing has stopped.',
      jsonb_build_object('type', 'check_out', 'attendance_id', v.id));

    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'auto_check_out', 'attendance', v.id::text,
            jsonb_build_object('guard', v.guard_id, 'site', v.site_id, 'at', v.ends_at));

    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;

revoke all on function auto_check_out() from public, anon, authenticated;
grant execute on function auto_check_out() to service_role;

-- Scheduled from the cluster's `postgres` database (pg_cron lives there):
--   select cron.schedule_in_database('nbss-auto-check-out', '* * * * *',
--          'select auto_check_out()', 'tenant_nbss');
