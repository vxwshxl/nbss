-- ===========================================================================
-- record_positions: a batch whose every point is dropped (all closer than the
-- cadence floor to what is already stored — a phone re-sending its outbox after
-- a timeout, say) raised "record v_newest_fence is not assigned yet", because a
-- record field read inside a CASE is resolved even when the branch is not taken.
-- The phone then kept that batch and retried it forever, so nothing it walked
-- afterwards ever arrived. The verdict is now held in scalars that start null.
-- Found by scripts/e2e-field.mjs (Watchdog).
-- ===========================================================================

create or replace function record_positions(
  p_points    jsonb,
  p_device_id text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
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
  if v_role is null or v_role <> 'guard' then
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

    select inside, distance_m into v_fence from site_fence_check(v_open.site_id, v_pt.lat, v_pt.lng);

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
$$;

revoke all on function record_positions(jsonb, text) from public, anon;
grant execute on function record_positions(jsonb, text) to authenticated;
