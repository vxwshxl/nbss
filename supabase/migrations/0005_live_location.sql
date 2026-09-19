-- ===========================================================================
-- Live guard location.
--
-- Two tables, because they answer two different questions and want opposite
-- shapes:
--
--   guard_positions          "where is everyone right now" — one row per guard,
--                            overwritten in place. The console's map reads this,
--                            so it stays small enough to scan whatever the
--                            history grows to.
--   guard_location_history   "where was this guard at 2am last Tuesday" —
--                            append-only, indexed by guard and time, pruned and
--                            then thinned rather than kept forever.
--
-- Positions are not streamed row by row. A trigger broadcasting every insert
-- would send one realtime message per ping per viewer, which multiplies by the
-- number of people with a map open and is the single largest cost in this design.
-- Instead `broadcast_positions()` assembles one message carrying every position
-- and pg_cron sends it every fifteen seconds. The bill then scales with the
-- number of watchers rather than the number of guards walking about.
--
-- The client cadence that decides when a phone bothers to send anything at all
-- lives in packages/shared/src/location.ts, so the app and the browser agree.
-- This file re-states the floor, because a client is a thing that can be edited.
-- ===========================================================================

-- pg_cron drives the fifteen-second broadcast and the nightly prune. pg_net is
-- how the SOS migration reaches Expo's push service. Recorded here so a fresh
-- environment gets them without anyone remembering to tick a box.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- --------------------------------------------------------------------- enums
-- How hard a phone is working. 'emergency' is switched on for every guard at a
-- site while an SOS is live there, and off again when it closes.
do $$ begin
  create type tracking_mode as enum ('on_duty', 'emergency');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------- guard_positions
create table if not exists guard_positions (
  guard_id           uuid primary key references profiles (id) on delete cascade,

  -- Which site this position was recorded against, and which open punch it
  -- belongs to. Both null-able: a position is still worth having if the roster
  -- is wrong, and the evidence trail is better for recording that mismatch than
  -- for refusing the row.
  site_id            uuid references sites (id) on delete set null,
  attendance_id      uuid references attendance (id) on delete set null,

  lat                double precision not null check (lat between -90 and 90),
  lng                double precision not null check (lng between -180 and 180),
  accuracy_m         double precision not null check (accuracy_m >= 0),
  heading            double precision check (heading between 0 and 360),
  speed_mps          double precision check (speed_mps >= 0),

  -- Battery percentage, 0–100. Not vanity: "the dot stopped moving" and "the
  -- phone died" are different incidents, and this is how the console tells them
  -- apart without ringing the guard.
  battery            smallint check (battery between 0 and 100),

  -- The fence verdict at the moment of the ping, computed in Postgres from the
  -- stored site and never sent up from the phone.
  inside_fence       boolean,
  distance_m         double precision,

  mode               tracking_mode not null default 'on_duty',

  -- Server clock. This is the timestamp everything orders and ages by.
  recorded_at        timestamptz not null default now(),
  -- Device clock. Recorded, never trusted — a phone whose clock disagrees with
  -- the server is itself a signal worth keeping.
  device_reported_at timestamptz,

  -- 'moved' | 'heartbeat' | 'first', from the client's adaptive policy. Useful
  -- when a trail looks sparse and the question is whether the guard stood still
  -- or the app stopped working.
  ping_reason        text
);

comment on table guard_positions is
  'Latest known position per guard, overwritten in place. The live map reads this.';

create index if not exists guard_positions_site_idx on guard_positions (site_id, recorded_at desc);
create index if not exists guard_positions_recorded_idx on guard_positions (recorded_at desc);

-- ---------------------------------------------------- guard_location_history
create table if not exists guard_location_history (
  id                 bigserial primary key,
  guard_id           uuid not null references profiles (id) on delete cascade,
  site_id            uuid references sites (id) on delete set null,
  attendance_id      uuid references attendance (id) on delete set null,

  lat                double precision not null,
  lng                double precision not null,
  accuracy_m         double precision not null,
  heading            double precision,
  speed_mps          double precision,
  battery            smallint,
  inside_fence       boolean,
  distance_m         double precision,
  mode               tracking_mode not null default 'on_duty',

  recorded_at        timestamptz not null default now(),
  device_reported_at timestamptz,
  ping_reason        text
);

comment on table guard_location_history is
  'The trail. Append-only: no update or delete grant is written for it, and the '
  'only deletions are the retention job below.';

create index if not exists glh_guard_time_idx on guard_location_history (guard_id, recorded_at desc);
create index if not exists glh_site_time_idx  on guard_location_history (site_id, recorded_at desc);
-- Supports the nightly prune, which scans purely by age.
create index if not exists glh_time_idx       on guard_location_history (recorded_at);

-- ===========================================================================
-- Which cadence a guard should be on.
--
-- Replaced by 0006_sos.sql once there is an alerts table to consult. Defined here
-- so `record_position` below can be written once and not rewritten.
-- ===========================================================================
create or replace function tracking_mode_for(p_site_id uuid) returns tracking_mode
language sql stable
as $$ select 'on_duty'::tracking_mode $$;

-- ===========================================================================
-- record_position — the only way a position is ever written.
--
-- Security definer, so neither table needs an insert policy and a phone holding
-- the publishable key cannot write a position for anybody but itself. The guard
-- id is taken from the JWT, never from an argument; there is deliberately no way
-- to say whose position this is.
--
-- Returns what the client needs to decide what to do next — whether it should
-- keep tracking at all, and at what cadence — so a phone learns that an SOS has
-- been raised at its site from the same round trip it was already making.
-- ===========================================================================
create or replace function record_position(
  p_lat                double precision,
  p_lng                double precision,
  p_accuracy_m         double precision,
  p_heading            double precision default null,
  p_speed_mps          double precision default null,
  p_battery            smallint         default null,
  p_device_reported_at timestamptz      default null,
  p_ping_reason        text             default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_guard   uuid := auth.uid();
  v_role    user_role;
  v_open    attendance%rowtype;
  v_fence   record;
  v_last    timestamptz;
  v_mode    tracking_mode;
begin
  if v_guard is null then
    return jsonb_build_object('tracked', false, 'reason', 'not_signed_in');
  end if;

  select role into v_role from profiles where id = v_guard and active;
  if v_role is null or v_role <> 'guard' then
    -- Only guards are tracked. A supervisor opening the app is not followed
    -- around, and there is no argument by which they could ask to be.
    return jsonb_build_object('tracked', false, 'reason', 'not_a_guard');
  end if;

  -- Coordinates are checked here rather than left to the column constraints, so
  -- a malformed fix returns a reason the app can log instead of a 400 it cannot
  -- read.
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('tracked', true, 'stored', false, 'reason', 'bad_coordinates');
  end if;

  -- ------------------------------------------------------------------ on duty?
  -- Tracking follows the punch, not the app being open. A guard who has checked
  -- out is not followed home — which is both the decent thing and the reason this
  -- system can be explained to the people it tracks.
  select * into v_open
  from attendance
  where guard_id = v_guard and check_out_at is null
  order by check_in_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('tracked', false, 'reason', 'not_on_duty');
  end if;

  v_mode := tracking_mode_for(v_open.site_id);

  -- --------------------------------------------------------------- throttle
  -- The client's own policy already spaces pings out; this is the floor for a
  -- client that has been edited, or is simply buggy. 'emergency' gets a lower
  -- floor because that is when a dense trail is worth the rows.
  select recorded_at into v_last from guard_positions where guard_id = v_guard;

  if v_last is not null
     and now() - v_last < (case when v_mode = 'emergency' then interval '3 seconds'
                                else interval '10 seconds' end)
  then
    return jsonb_build_object('tracked', true, 'stored', false, 'reason', 'throttled',
                              'mode', v_mode, 'site_id', v_open.site_id);
  end if;

  -- ------------------------------------------------------------ fence verdict
  select inside, distance_m into v_fence
  from site_fence_check(v_open.site_id, p_lat, p_lng);

  -- ----------------------------------------------------------------- current
  insert into guard_positions as gp (
    guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps,
    battery, inside_fence, distance_m, mode, recorded_at, device_reported_at, ping_reason
  ) values (
    v_guard, v_open.site_id, v_open.id, p_lat, p_lng, p_accuracy_m, p_heading, p_speed_mps,
    p_battery, v_fence.inside, v_fence.distance_m, v_mode, now(), p_device_reported_at, p_ping_reason
  )
  on conflict (guard_id) do update set
    site_id = excluded.site_id,
    attendance_id = excluded.attendance_id,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    heading = excluded.heading,
    speed_mps = excluded.speed_mps,
    battery = excluded.battery,
    inside_fence = excluded.inside_fence,
    distance_m = excluded.distance_m,
    mode = excluded.mode,
    recorded_at = excluded.recorded_at,
    device_reported_at = excluded.device_reported_at,
    ping_reason = excluded.ping_reason;

  -- ----------------------------------------------------------------- history
  insert into guard_location_history (
    guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps,
    battery, inside_fence, distance_m, mode, recorded_at, device_reported_at, ping_reason
  ) values (
    v_guard, v_open.site_id, v_open.id, p_lat, p_lng, p_accuracy_m, p_heading, p_speed_mps,
    p_battery, v_fence.inside, v_fence.distance_m, v_mode, now(), p_device_reported_at, p_ping_reason
  );

  -- Cheap, and it makes "when did we last hear from this phone at all" answerable
  -- without joining to positions.
  update profiles set last_seen_at = now() where id = v_guard;

  return jsonb_build_object(
    'tracked', true,
    'stored', true,
    'mode', v_mode,
    'site_id', v_open.site_id,
    'inside_fence', v_fence.inside,
    'distance_m', round(v_fence.distance_m::numeric, 1),
    'server_time', now()
  );
end;
$$;

comment on function record_position is
  'The only write path for a guard position. Takes the guard from the JWT, refuses '
  'anyone not currently punched in, and computes the fence verdict server-side.';

revoke all on function record_position(double precision, double precision, double precision,
  double precision, double precision, smallint, timestamptz, text) from anon;
grant execute on function record_position(double precision, double precision, double precision,
  double precision, double precision, smallint, timestamptz, text) to authenticated;

-- ===========================================================================
-- The broadcast
--
-- One message, every fifteen seconds, carrying every position fresh enough to
-- draw. Fifteen seconds is below the point at which a dot stops feeling live, and
-- it fixes the message count at roughly 173,000 per watcher per month no matter
-- how many guards are on duty.
--
-- Sent private, so `realtime.messages` policies decide who may receive it. A
-- public topic would put guard coordinates behind nothing but the publishable key.
-- ===========================================================================
create or replace function broadcast_positions() returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_all   jsonb;
  v_site  record;
begin
  -- Anything older than this is not "live" and would only put a stale dot on a
  -- map. The map shows last-known separately, read from the table directly.
  select coalesce(jsonb_agg(row), '[]'::jsonb) into v_all
  from (
    select jsonb_build_object(
      'guard_id',    gp.guard_id,
      'site_id',     gp.site_id,
      'lat',         gp.lat,
      'lng',         gp.lng,
      'accuracy_m',  gp.accuracy_m,
      'heading',     gp.heading,
      'speed_mps',   gp.speed_mps,
      'battery',     gp.battery,
      'inside_fence', gp.inside_fence,
      'distance_m',  round(gp.distance_m::numeric, 1),
      'mode',        gp.mode,
      'recorded_at', gp.recorded_at
    ) as row
    from guard_positions gp
    where gp.recorded_at > now() - interval '20 minutes'
  ) s;

  -- Nothing on duty, nothing to say. Skipped rather than sent empty, so a quiet
  -- night costs nothing at all.
  if v_all = '[]'::jsonb then return; end if;

  perform realtime.send(
    jsonb_build_object('at', now(), 'positions', v_all),
    'positions',
    'live-map',
    true
  );

  -- And one per site, for the guards on it. This is what makes an SOS response
  -- work: the people running towards a colleague can see where that colleague is,
  -- on their own phones, without being staff.
  for v_site in
    select distinct site_id from guard_positions
    where site_id is not null and recorded_at > now() - interval '20 minutes'
  loop
    perform realtime.send(
      jsonb_build_object(
        'at', now(),
        'positions', (
          select coalesce(jsonb_agg(p), '[]'::jsonb)
          from jsonb_array_elements(v_all) p
          where (p ->> 'site_id')::uuid = v_site.site_id
        )
      ),
      'positions',
      'site:' || v_site.site_id,
      true
    );
  end loop;
end;
$$;

comment on function broadcast_positions is
  'Assembles every live position into one realtime message per audience. Called by '
  'pg_cron every 15s — never by a trigger, which would bill per ping per viewer.';

-- ===========================================================================
-- Retention
--
-- Thirty days at full resolution answers any dispute anyone actually raises. After
-- that the trail is thinned to one position every ten minutes rather than deleted,
-- which keeps a year of shape for a fraction of the rows — enough to say a guard
-- patrolled, not enough to say exactly where they stood.
-- ===========================================================================
create or replace function prune_location_history() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_thinned bigint;
  v_deleted bigint;
begin
  -- Thin the 30–365 day window: keep the earliest row in each ten-minute bucket
  -- per guard, drop the rest.
  with bucketed as (
    select id,
           row_number() over (
             partition by guard_id, date_trunc('hour', recorded_at),
                          floor(extract(minute from recorded_at) / 10)
             order by recorded_at
           ) as rn
    from guard_location_history
    where recorded_at < now() - interval '30 days'
      and recorded_at >= now() - interval '365 days'
  )
  delete from guard_location_history h
  using bucketed b
  where h.id = b.id and b.rn > 1;
  get diagnostics v_thinned = row_count;

  delete from guard_location_history
  where recorded_at < now() - interval '365 days';
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('thinned', v_thinned, 'deleted', v_deleted, 'at', now());
end;
$$;

-- ===========================================================================
-- Schedules
--
-- Unscheduled first so this migration is safe to re-run, and so a renamed job
-- does not leave its predecessor running beside it.
-- ===========================================================================
do $$ begin
  perform cron.unschedule('nbss-broadcast-positions');
exception when others then null;
end $$;

do $$ begin
  perform cron.unschedule('nbss-prune-locations');
exception when others then null;
end $$;

select cron.schedule('nbss-broadcast-positions', '15 seconds', 'select broadcast_positions()');
select cron.schedule('nbss-prune-locations',     '17 3 * * *', 'select prune_location_history()');

-- ===========================================================================
-- Row level security
--
-- No insert or update policy anywhere: every write goes through
-- `record_position`, which is the whole reason the fence verdict can be trusted.
-- ===========================================================================
alter table guard_positions        enable row level security;
alter table guard_location_history enable row level security;

-- A guard sees their own trail. Being tracked and not being allowed to see the
-- track would be indefensible.
create policy positions_own_read on guard_positions
  for select using (guard_id = auth.uid());

create policy positions_staff_read on guard_positions
  for select using (is_staff());

create policy history_own_read on guard_location_history
  for select using (guard_id = auth.uid());

create policy history_staff_read on guard_location_history
  for select using (is_staff());

-- Deliberately no client policy on either table.
--
-- A client is entitled to know their site is staffed and what they are billed
-- for, which `client_attendance` gives them. Following an individual employee
-- around a compound minute by minute is a different thing, and it is not the
-- customer's to do. If a client ever needs it, that is a conversation and a
-- contract, not a policy quietly added here.

-- ===========================================================================
-- Realtime channel authorisation
--
-- `realtime.send(..., private => true)` means Realtime consults these before
-- handing a message to a subscriber. Without them the topics exist and deliver
-- nothing, which is the correct direction to fail in.
-- ===========================================================================

-- Staff see the whole fleet.
drop policy if exists nbss_live_map_read on realtime.messages;
create policy nbss_live_map_read on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'live-map' and is_staff());

-- Per-site topics: staff, plus any guard currently punched in at that site.
-- Membership is checked against the open punch rather than the roster, so a
-- guard who has gone home stops receiving their colleagues' positions the moment
-- they check out.
create or replace function may_read_site_channel(p_topic text) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare v_site uuid;
begin
  if p_topic is null or p_topic not like 'site:%' then return false; end if;

  -- A topic is a client-supplied string. Anything that is not a uuid is refused
  -- rather than allowed to raise, because an exception inside an RLS check is a
  -- confusing way to be denied.
  begin
    v_site := substring(p_topic from 6)::uuid;
  exception when others then
    return false;
  end;

  if is_staff() then return true; end if;

  return exists (
    select 1 from attendance
    where guard_id = auth.uid() and site_id = v_site and check_out_at is null
  );
end;
$$;

drop policy if exists nbss_site_channel_read on realtime.messages;
create policy nbss_site_channel_read on realtime.messages
  for select to authenticated
  using (may_read_site_channel(realtime.topic()));
