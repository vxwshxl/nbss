-- Every position (and every compass turn) goes out the moment it is stored.
--
-- The 15-second batch (broadcast_positions) made the console's dots and direction
-- arrows step every 15 s at best. Now a change to a guard's live row sends that one
-- position, at once, to the console's live map and to the site's channel. The batch
-- stays behind it, as the catch-up for anyone who joins mid-way. Self-hosted
-- Realtime: no per-message bill, and a message is a few hundred bytes.

create or replace function guard_position_push() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v jsonb;
begin
  v := jsonb_build_object(
    'guard_id', new.guard_id, 'site_id', new.site_id, 'attendance_id', new.attendance_id,
    'lat', new.lat, 'lng', new.lng, 'accuracy_m', new.accuracy_m,
    'heading', new.heading, 'speed_mps', new.speed_mps,
    'battery', new.battery, 'charging', new.charging,
    'inside_fence', new.inside_fence, 'distance_m', round(new.distance_m::numeric, 1),
    'mode', new.mode, 'recorded_at', new.recorded_at,
    'received_at', coalesce(new.received_at, new.recorded_at));
  perform realtime.send(jsonb_build_object('at', now(), 'positions', jsonb_build_array(v)), 'positions', 'live-map', true);
  if new.site_id is not null then
    perform realtime.send(jsonb_build_object('at', now(), 'positions', jsonb_build_array(v)), 'positions', 'site:' || new.site_id, true);
  end if;
  return null;
end;
$$;

drop trigger if exists guard_positions_push on guard_positions;
create trigger guard_positions_push after insert or update on guard_positions
  for each row execute function guard_position_push();
