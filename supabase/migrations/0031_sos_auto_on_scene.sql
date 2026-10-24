-- A responder is "on scene" the moment their phone puts them there.
--
-- A guard who answered "I'm on the way" is moved to on_scene automatically when a
-- position from their phone lands inside the SOS site's boundary, or within 40 m
-- of where the alert was raised. Nobody has to find the button while running.
-- Guards who have not answered are left alone: marking them would count them as
-- help and stop the alarm for everyone else, without them having seen it.

create or replace function sos_auto_on_scene() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v record;
  v_dist double precision;
  v_inside boolean;
begin
  if new.lat is null or new.lng is null then return new; end if;
  if tg_op = 'UPDATE' and new.lat = old.lat and new.lng = old.lng then return new; end if;

  for v in
    select k.alert_id, a.site_id, a.lat, a.lng, a.status
    from sos_acknowledgements k
    join sos_alerts a on a.id = k.alert_id
    where k.profile_id = new.guard_id and k.response = 'responding'
      and a.status in ('active', 'acknowledged')
  loop
    v_dist := case when v.lat is not null then geo_distance_m(v.lat, v.lng, new.lat, new.lng) end;
    select inside into v_inside from site_fence_check(v.site_id, new.lat, new.lng);
    if coalesce(v_inside, false) or coalesce(v_dist < 40, false) then
      update sos_acknowledgements
      set response = 'on_scene', lat = new.lat, lng = new.lng, distance_m = v_dist, at = now()
      where alert_id = v.alert_id and profile_id = new.guard_id;
      perform realtime.send(
        jsonb_build_object('id', v.alert_id, 'site_id', v.site_id, 'status', v.status,
                           'responder', new.guard_id, 'response', 'on_scene', 'distance_m', v_dist, 'auto', true),
        'sos', 'site:' || v.site_id, true);
      perform realtime.send(
        jsonb_build_object('id', v.alert_id, 'site_id', v.site_id, 'status', v.status,
                           'responder', new.guard_id, 'response', 'on_scene', 'distance_m', v_dist, 'auto', true),
        'sos', 'live-map', true);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists guard_positions_sos_on_scene on guard_positions;
create trigger guard_positions_sos_on_scene
  after insert or update of lat, lng on guard_positions
  for each row execute function sos_auto_on_scene();
