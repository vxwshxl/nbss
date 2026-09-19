-- ===========================================================================
-- SOS.
--
-- A guard on a site holds a button for three seconds, and within a few seconds
-- everyone who could do something about it knows: the other guards standing on
-- that site, every admin and supervisor wherever they are, and the client who
-- owns the premises.
--
-- Three constraints shaped everything below.
--
--   IT MUST REACH A CLOSED APP. A guard being attacked is not going to find the
--   console already open on a colleague's phone. Realtime only reaches an app
--   that is running, so the delivery path is a push notification, and realtime
--   is the *second* channel rather than the first.
--
--   A FALSE ALARM IS EXPECTED, NOT EXCEPTIONAL. A phone in a pocket, a misread
--   screen at 3am. Raising one is easy, closing one is easy, and 'false_alarm' is
--   a status rather than an accusation. Nobody will use a panic button they can
--   be told off for pressing.
--
--   IT MUST NOT DEPEND ON ANYTHING THAT CAN BE DOWN. No Edge Function, no queue
--   service, no application server. Postgres holds the outbox and pg_net makes
--   the call, so the path from a held button to a ringing phone crosses one
--   system. Retries are rows, not a process someone has to restart.
-- ===========================================================================

-- --------------------------------------------------------------------- enums
do $$ begin
  create type sos_status as enum ('active', 'acknowledged', 'resolved', 'false_alarm');
exception when duplicate_object then null; end $$;

-- Deliberately short. This is chosen under stress, or not at all — 'other' is the
-- default and pressing the button without answering anything is a complete alert.
do $$ begin
  create type sos_kind as enum ('intruder', 'medical', 'fire', 'assault', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sos_response as enum ('responding', 'on_scene', 'cannot_respond');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sos_audience as enum ('on_duty_guard', 'staff', 'client');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- app_secrets
-- Supabase's Vault, wrapped in two functions so callers never touch the view.
--
-- The Expo access token is the only entry today. It lives here rather than in the
-- application's environment because the thing that needs it is a Postgres
-- function called by pg_cron — there is no process holding an env var at the
-- moment the push goes out.
create or replace function set_secret(p_name text, p_value text) returns void
language plpgsql security definer set search_path = public, vault
as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, 'NBSS operations');
  else
    perform vault.update_secret(v_id, p_value, p_name);
  end if;
end;
$$;

create or replace function get_secret(p_name text) returns text
language sql stable security definer set search_path = public, vault
as $$ select decrypted_secret from vault.decrypted_secrets where name = p_name $$;

-- Readable by nobody holding a publishable key. Only the security-definer
-- functions in this file, which run as the owner, ever call it.
revoke all on function get_secret(text) from anon, authenticated;
revoke all on function set_secret(text, text) from anon, authenticated;

-- --------------------------------------------------------------- device_tokens
-- Where a push is actually delivered. One row per installation, not per person:
-- a supervisor with a phone and a tablet gets both.
create table if not exists device_tokens (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles (id) on delete cascade,

  -- An Expo push token, 'ExponentPushToken[...]'. Unique because reinstalling the
  -- app on the same device returns the same token, and two rows for it would send
  -- every alert twice.
  token        text not null unique,

  platform     text not null check (platform in ('ios', 'android')),
  device_name  text,
  app_version  text,

  last_seen_at timestamptz not null default now(),

  -- Set when Expo replies 'DeviceNotRegistered'. Kept rather than deleted so the
  -- console can say "this guard's app was uninstalled on the 3rd", which is the
  -- kind of thing that explains why an alert went unanswered.
  disabled_at  timestamptz,
  disabled_reason text,

  created_at   timestamptz not null default now()
);

create index if not exists device_tokens_profile_idx on device_tokens (profile_id) where disabled_at is null;

-- ------------------------------------------------------------------ sos_alerts
create table if not exists sos_alerts (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites (id) on delete cascade,
  raised_by       uuid not null references profiles (id) on delete cascade,
  attendance_id   uuid references attendance (id) on delete set null,

  kind            sos_kind not null default 'other',
  note            text,

  -- Where the guard was when they pressed it. Null-able on purpose: a phone
  -- indoors may have no fix at all, and "I need help and I don't know exactly
  -- where I am" must still raise the alarm.
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  accuracy_m      double precision,
  inside_fence    boolean,

  status          sos_status not null default 'active',

  raised_at       timestamptz not null default now(),
  acknowledged_at timestamptz,
  first_responder uuid references profiles (id) on delete set null,
  closed_at       timestamptz,
  closed_by       uuid references profiles (id) on delete set null,
  closing_note    text,

  -- Re-notification bookkeeping. An unanswered alert keeps ringing.
  last_notified_at timestamptz,
  notify_count     integer not null default 0
);

-- One live alert per guard. A frightened person presses a button more than once;
-- that should reach people again, not create a second incident to close.
create unique index if not exists sos_one_live_per_guard
  on sos_alerts (raised_by) where status in ('active', 'acknowledged');

create index if not exists sos_site_time_idx on sos_alerts (site_id, raised_at desc);
create index if not exists sos_live_idx on sos_alerts (raised_at desc)
  where status in ('active', 'acknowledged');

-- -------------------------------------------------------- sos_acknowledgements
-- Who answered, and what they said they were doing about it. One row per person
-- per alert, upserted, so "on the way" can become "on scene".
create table if not exists sos_acknowledgements (
  alert_id   uuid not null references sos_alerts (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  response   sos_response not null,
  lat        double precision,
  lng        double precision,
  -- How far the responder was from the alert when they answered. This is what
  -- turns a list of names into "the nearest help is 400 m away".
  distance_m double precision,
  at         timestamptz not null default now(),

  primary key (alert_id, profile_id)
);

-- ---------------------------------------------------------- sos_notifications
-- Who the alert was sent to. Not the same question as who answered, and the
-- difference is exactly what a post-incident review wants to see.
create table if not exists sos_notifications (
  id         bigserial primary key,
  alert_id   uuid not null references sos_alerts (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  audience   sos_audience not null,
  at         timestamptz not null default now()
);

create index if not exists sos_notifications_alert_idx on sos_notifications (alert_id);

-- ----------------------------------------------------------------- push_outbox
-- An outbox rather than a direct call, for one reason: a push that failed because
-- Expo was briefly unreachable should be retried, and a retry needs to be a row
-- somebody can see rather than an exception nobody caught.
create table if not exists push_outbox (
  id          bigserial primary key,
  token       text not null,
  profile_id  uuid references profiles (id) on delete set null,
  alert_id    uuid references sos_alerts (id) on delete cascade,

  title       text not null,
  body        text not null,
  data        jsonb,
  -- 'high' for everything in this file. Android needs it to wake a dozing app.
  priority    text not null default 'high',
  channel_id  text,
  sound       text default 'default',
  ttl_seconds integer,

  attempts    smallint not null default 0,
  -- The pg_net request this row went out in, so the response can be matched back.
  request_id  bigint,
  queued_at   timestamptz not null default now(),
  sent_at     timestamptz,
  failed_at   timestamptz,
  error       text
);

create index if not exists push_outbox_pending_idx on push_outbox (queued_at)
  where sent_at is null and failed_at is null;
create index if not exists push_outbox_awaiting_idx on push_outbox (request_id)
  where request_id is not null and sent_at is null and failed_at is null;

-- ===========================================================================
-- Tracking cadence, now that there is something to consult.
--
-- Replaces the stub in 0005. Every phone at a site with a live alert is switched
-- to the dense cadence on its next ping, which it learns from the return value of
-- `record_position` — no extra round trip, and no push needed to make it happen.
-- ===========================================================================
create or replace function tracking_mode_for(p_site_id uuid) returns tracking_mode
language sql stable security definer set search_path = public
as $$
  select case
    when p_site_id is null then 'on_duty'
    when exists (
      select 1 from sos_alerts
      where site_id = p_site_id and status in ('active', 'acknowledged')
    ) then 'emergency'
    else 'on_duty'
  end::tracking_mode
$$;

-- ===========================================================================
-- Who an alert reaches.
--
-- Set-returning rather than inlined, so the console can show the intended
-- audience before anything is sent and a post-incident review can ask the same
-- question the notifier asked.
-- ===========================================================================
create or replace function sos_recipients(p_alert_id uuid)
returns table (profile_id uuid, audience sos_audience)
language sql stable security definer set search_path = public
as $$
  with alert as (select * from sos_alerts where id = p_alert_id)
  -- Guards standing on the site right now, by open punch rather than by roster:
  -- the roster says who was meant to be there, and in an emergency only who is
  -- actually there matters. The raiser is excluded — their own phone is already
  -- in their hand.
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a, alert
  where a.site_id = alert.site_id
    and a.check_out_at is null
    and a.guard_id <> alert.raised_by

  union

  -- Every active admin and supervisor, wherever they are. Not filtered by site:
  -- the person who can send a vehicle is not necessarily the person who knows
  -- that site.
  select p.id, 'staff'::sos_audience
  from profiles p
  where p.active and p.role in ('admin', 'supervisor')

  union

  -- The client, if the site has not opted out. `notify_client_on_sos` exists
  -- because the first 3am false alarm that wakes a customer will make somebody
  -- want this off for that site without waiting for a deploy.
  select s.client_id, 'client'::sos_audience
  from sites s, alert
  where s.id = alert.site_id
    and s.client_id is not null
    and s.notify_client_on_sos
$$;

-- ===========================================================================
-- Queueing the push.
--
-- Split from `raise_sos` so the re-notify job can call it again without
-- re-raising anything.
-- ===========================================================================
create or replace function enqueue_sos_push(p_alert_id uuid, p_repeat boolean default false)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_alert   sos_alerts%rowtype;
  v_site    sites%rowtype;
  v_raiser  profiles%rowtype;
  v_title   text;
  v_body    text;
  v_queued  integer;
begin
  select * into v_alert from sos_alerts where id = p_alert_id;
  if not found or v_alert.status not in ('active', 'acknowledged') then return 0; end if;

  select * into v_site   from sites    where id = v_alert.site_id;
  select * into v_raiser from profiles where id = v_alert.raised_by;

  -- Front-loaded with the thing that matters, because on a lock screen this is
  -- truncated and often read at arm's length in the dark.
  v_title := case when p_repeat then 'STILL UNANSWERED — ' else '' end
             || 'SOS · ' || coalesce(v_site.name, 'Unknown site');

  v_body := coalesce(v_raiser.full_name, 'A guard')
            || ' (' || coalesce(v_raiser.employee_code, '?') || ') needs help'
            || case v_alert.kind
                 when 'intruder' then ' — intruder'
                 when 'medical'  then ' — medical'
                 when 'fire'     then ' — fire'
                 when 'assault'  then ' — assault'
                 else ''
               end
            || coalesce('. ' || v_alert.note, '');

  -- Only recorded on the first pass. Re-notifying is not reaching a new audience.
  if not p_repeat then
    insert into sos_notifications (alert_id, profile_id, audience)
    select p_alert_id, r.profile_id, r.audience from sos_recipients(p_alert_id) r;
  end if;

  insert into push_outbox (
    token, profile_id, alert_id, title, body, data, priority, channel_id, sound, ttl_seconds
  )
  select
    d.token,
    d.profile_id,
    p_alert_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type',      'sos',
      'alert_id',  p_alert_id,
      'site_id',   v_alert.site_id,
      'site_name', v_site.name,
      'raised_by', v_alert.raised_by,
      'raiser',    v_raiser.full_name,
      'kind',      v_alert.kind,
      'lat',       v_alert.lat,
      'lng',       v_alert.lng,
      'raised_at', v_alert.raised_at,
      'audience',  r.audience
    ),
    'high',
    -- A channel the app registers at MAX importance, so Android shows it
    -- full-screen over the lock screen rather than as a quiet line in the shade.
    'sos',
    'default',
    -- No point delivering a panic alert twenty minutes late; let it expire rather
    -- than arrive as a ghost.
    900
  from sos_recipients(p_alert_id) r
  join device_tokens d on d.profile_id = r.profile_id and d.disabled_at is null;

  get diagnostics v_queued = row_count;

  update sos_alerts
  set last_notified_at = now(),
      notify_count = notify_count + 1
  where id = p_alert_id;

  return v_queued;
end;
$$;

-- ===========================================================================
-- raise_sos — what the held button calls.
--
-- Security definer and takes no guard argument: the raiser is the JWT, so there
-- is no way to raise an alarm in somebody else's name.
-- ===========================================================================
create or replace function raise_sos(
  p_kind       sos_kind          default 'other',
  p_lat        double precision  default null,
  p_lng        double precision  default null,
  p_accuracy_m double precision  default null,
  p_note       text              default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_guard   uuid := auth.uid();
  v_role    user_role;
  v_open    attendance%rowtype;
  v_alert   sos_alerts%rowtype;
  v_fence   record;
  v_queued  integer;
  v_repeat  boolean := false;
begin
  if v_guard is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select role into v_role from profiles where id = v_guard and active;
  if v_role is null then
    raise exception 'This account is not active.' using errcode = '42501';
  end if;

  -- A guard raises it from a site. Staff have a phone and a radio; what they do
  -- not have is a gate they are standing at, and an alert with no site cannot be
  -- fanned out to anyone.
  select * into v_open
  from attendance
  where guard_id = v_guard and check_out_at is null
  order by check_in_at desc nulls last
  limit 1;

  if not found then
    raise exception 'You are not checked in anywhere, so there is no site to raise an alert for.'
      using errcode = 'P0001';
  end if;

  if p_lat is not null and p_lng is not null then
    select inside into v_fence from site_fence_check(v_open.site_id, p_lat, p_lng);
  end if;

  -- Pressing it again while one is live re-notifies rather than duplicating.
  select * into v_alert
  from sos_alerts
  where raised_by = v_guard and status in ('active', 'acknowledged');

  if found then
    v_repeat := true;
    -- The position is refreshed: they may have moved since, and where they are now
    -- is more useful than where they were.
    update sos_alerts
    set lat = coalesce(p_lat, lat),
        lng = coalesce(p_lng, lng),
        accuracy_m = coalesce(p_accuracy_m, accuracy_m),
        inside_fence = coalesce(v_fence.inside, inside_fence),
        note = coalesce(p_note, note),
        kind = case when p_kind <> 'other' then p_kind else kind end
    where id = v_alert.id
    returning * into v_alert;
  else
    insert into sos_alerts (site_id, raised_by, attendance_id, kind, note, lat, lng, accuracy_m, inside_fence)
    values (v_open.site_id, v_guard, v_open.id, p_kind, p_note, p_lat, p_lng, p_accuracy_m, v_fence.inside)
    returning * into v_alert;
  end if;

  -- Realtime first. It reaches every app that is already open in well under a
  -- second, which is faster than any push service, and the outbox below covers
  -- everyone whose app is closed.
  perform realtime.send(
    jsonb_build_object(
      'id', v_alert.id, 'site_id', v_alert.site_id, 'raised_by', v_alert.raised_by,
      'status', v_alert.status, 'kind', v_alert.kind, 'note', v_alert.note,
      'lat', v_alert.lat, 'lng', v_alert.lng, 'raised_at', v_alert.raised_at,
      'repeat', v_repeat
    ),
    'sos',
    'site:' || v_alert.site_id,
    true
  );

  perform realtime.send(
    jsonb_build_object(
      'id', v_alert.id, 'site_id', v_alert.site_id, 'raised_by', v_alert.raised_by,
      'status', v_alert.status, 'kind', v_alert.kind, 'lat', v_alert.lat, 'lng', v_alert.lng,
      'raised_at', v_alert.raised_at, 'repeat', v_repeat
    ),
    'sos',
    'live-map',
    true
  );

  v_queued := enqueue_sos_push(v_alert.id, v_repeat);

  -- Drained immediately rather than waiting for the next cron tick. Ten seconds
  -- is a long time when this is what it is.
  perform drain_push_outbox();

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_guard, 'sos.raise', 'sos_alerts', v_alert.id::text,
          jsonb_build_object('site_id', v_alert.site_id, 'kind', v_alert.kind,
                             'repeat', v_repeat, 'pushes', v_queued));

  return jsonb_build_object(
    'alert_id', v_alert.id,
    'site_id',  v_alert.site_id,
    'status',   v_alert.status,
    'repeat',   v_repeat,
    'notified', v_queued,
    'raised_at', v_alert.raised_at
  );
end;
$$;

-- ===========================================================================
-- Answering and closing
-- ===========================================================================
create or replace function acknowledge_sos(
  p_alert_id uuid,
  p_response sos_response default 'responding',
  p_lat      double precision default null,
  p_lng      double precision default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_alert sos_alerts%rowtype;
  v_dist  double precision;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select * into v_alert from sos_alerts where id = p_alert_id;
  if not found then raise exception 'No such alert.' using errcode = 'no_data_found'; end if;

  -- Only people the alert was actually sent to may answer it. Anyone else
  -- acknowledging would make the responder list unreliable, which is the one
  -- thing it has to be.
  if not exists (select 1 from sos_notifications where alert_id = p_alert_id and profile_id = v_me) then
    raise exception 'This alert was not sent to you.' using errcode = '42501';
  end if;

  if p_lat is not null and p_lng is not null and v_alert.lat is not null then
    v_dist := geo_distance_m(v_alert.lat, v_alert.lng, p_lat, p_lng);
  end if;

  insert into sos_acknowledgements (alert_id, profile_id, response, lat, lng, distance_m)
  values (p_alert_id, v_me, p_response, p_lat, p_lng, v_dist)
  on conflict (alert_id, profile_id) do update set
    response = excluded.response,
    lat = excluded.lat, lng = excluded.lng, distance_m = excluded.distance_m,
    at = now();

  -- 'cannot_respond' is information, not help — it must not stop the alarm
  -- ringing for everyone else.
  if p_response <> 'cannot_respond' and v_alert.status = 'active' then
    update sos_alerts
    set status = 'acknowledged', acknowledged_at = now(), first_responder = v_me
    where id = p_alert_id and status = 'active'
    returning * into v_alert;
  end if;

  perform realtime.send(
    jsonb_build_object('id', p_alert_id, 'site_id', v_alert.site_id, 'status', v_alert.status,
                       'responder', v_me, 'response', p_response, 'distance_m', v_dist),
    'sos', 'site:' || v_alert.site_id, true
  );
  perform realtime.send(
    jsonb_build_object('id', p_alert_id, 'site_id', v_alert.site_id, 'status', v_alert.status,
                       'responder', v_me, 'response', p_response, 'distance_m', v_dist),
    'sos', 'live-map', true
  );

  return jsonb_build_object('alert_id', p_alert_id, 'status', v_alert.status, 'response', p_response);
end;
$$;

-- Closing it. The guard who raised it may close their own — a false alarm should
-- be cancellable by the person who knows it was one, without finding a supervisor
-- first. Staff may close any.
create or replace function close_sos(
  p_alert_id uuid,
  p_status   sos_status default 'resolved',
  p_note     text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_alert sos_alerts%rowtype;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  if p_status not in ('resolved', 'false_alarm') then
    raise exception 'An alert is closed as resolved or as a false alarm.' using errcode = '22023';
  end if;

  select * into v_alert from sos_alerts where id = p_alert_id;
  if not found then raise exception 'No such alert.' using errcode = 'no_data_found'; end if;

  if v_alert.raised_by <> v_me and not is_staff() then
    raise exception 'Only the guard who raised this alert or a supervisor may close it.'
      using errcode = '42501';
  end if;

  update sos_alerts
  set status = p_status, closed_at = now(), closed_by = v_me, closing_note = p_note
  where id = p_alert_id
  returning * into v_alert;

  -- Anything still queued for this alert is dropped. A phone that has been off
  -- should not light up about an emergency that ended an hour ago.
  update push_outbox
  set failed_at = now(), error = 'alert closed before delivery'
  where alert_id = p_alert_id and sent_at is null and failed_at is null;

  perform realtime.send(
    jsonb_build_object('id', p_alert_id, 'site_id', v_alert.site_id, 'status', p_status,
                       'closed_by', v_me, 'note', p_note),
    'sos', 'site:' || v_alert.site_id, true
  );
  perform realtime.send(
    jsonb_build_object('id', p_alert_id, 'site_id', v_alert.site_id, 'status', p_status,
                       'closed_by', v_me),
    'sos', 'live-map', true
  );

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_me, 'sos.close', 'sos_alerts', p_alert_id::text,
          jsonb_build_object('status', p_status, 'note', p_note));

  return jsonb_build_object('alert_id', p_alert_id, 'status', p_status);
end;
$$;

-- ===========================================================================
-- Device registration — the app calls this on every launch.
-- ===========================================================================
create or replace function register_device(
  p_token       text,
  p_platform    text,
  p_device_name text default null,
  p_app_version text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  if p_token is null or p_token = '' then
    raise exception 'A push token is required.' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Platform must be ios or android.' using errcode = '22023';
  end if;

  -- On conflict on the token, not on the profile: a shared phone handed to the
  -- next shift must re-point at whoever is signed in now, or the outgoing guard
  -- keeps getting alerts for a site they left.
  insert into device_tokens (profile_id, token, platform, device_name, app_version)
  values (v_me, p_token, p_platform, p_device_name, p_app_version)
  on conflict (token) do update set
    profile_id = v_me,
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    last_seen_at = now(),
    disabled_at = null,
    disabled_reason = null;

  return jsonb_build_object('registered', true);
end;
$$;

-- Called on sign-out, so the next person to hold this phone does not inherit the
-- last one's alerts.
create or replace function release_device(p_token text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  delete from device_tokens where token = p_token and profile_id = v_me;
  return jsonb_build_object('released', true);
end;
$$;

-- ===========================================================================
-- Delivery
--
-- Expo takes up to 100 messages in one request, so the outbox is drained in
-- batches and the pg_net request id is written back onto each row. A second job
-- reads the reply and marks each ticket, because Expo answers per message: one
-- token in a batch of ninety-nine can be dead without the others failing.
-- ===========================================================================
create or replace function drain_push_outbox(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ids     bigint[];
  v_body    jsonb;
  v_token   text := get_secret('expo_access_token');
  v_headers jsonb;
  v_request bigint;
begin
  -- FOR UPDATE SKIP LOCKED so two overlapping drains cannot send the same push
  -- twice. `raise_sos` calls this inline while cron may also be running.
  with batch as (
    select id from push_outbox
    where sent_at is null and failed_at is null and request_id is null and attempts < 3
    order by queued_at
    limit p_limit
    for update skip locked
  )
  select array_agg(id) into v_ids from batch;

  if v_ids is null then return jsonb_build_object('sent', 0); end if;

  select jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'to', o.token,
      'title', o.title,
      'body', o.body,
      'data', o.data,
      'sound', o.sound,
      'priority', o.priority,
      'channelId', o.channel_id,
      'ttl', o.ttl_seconds,
      -- iOS: surfaces the alert on a phone in a focus mode without needing the
      -- critical-alerts entitlement, which Apple grants case by case.
      'interruptionLevel', 'timeSensitive',
      '_contentAvailable', true
    ))
  ) into v_body
  from push_outbox o where o.id = any(v_ids);

  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json');
  -- Only sent when a token has been stored. Expo requires one once a project
  -- turns on enhanced push security and rejects the request without it; projects
  -- that have not turned it on accept either.
  if v_token is not null and v_token <> '' then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_token);
  end if;

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_body,
    headers := v_headers,
    timeout_milliseconds := 10000
  ) into v_request;

  update push_outbox
  set request_id = v_request, attempts = attempts + 1
  where id = any(v_ids);

  return jsonb_build_object('sent', array_length(v_ids, 1), 'request_id', v_request);
end;
$$;

-- Matching Expo's reply back onto the rows it answers.
create or replace function collect_push_responses() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row     record;
  v_ok      integer := 0;
  v_failed  integer := 0;
begin
  for v_row in
    select distinct o.request_id, r.status_code, r.content, r.error_msg, r.timed_out
    from push_outbox o
    join net._http_response r on r.id = o.request_id
    where o.sent_at is null and o.failed_at is null and o.request_id is not null
  loop
    if v_row.timed_out or v_row.status_code is null or v_row.status_code >= 500 then
      -- Transient. The row goes back in the queue for another attempt; `attempts`
      -- is what stops that being forever.
      update push_outbox set request_id = null, error = coalesce(v_row.error_msg, 'upstream ' || v_row.status_code)
      where request_id = v_row.request_id and sent_at is null and failed_at is null;

      update push_outbox set failed_at = now()
      where request_id is null and attempts >= 3 and sent_at is null and failed_at is null
        and error is not null;
      continue;
    end if;

    if v_row.status_code >= 400 then
      update push_outbox
      set failed_at = now(), error = left(coalesce(v_row.content, 'HTTP ' || v_row.status_code), 500)
      where request_id = v_row.request_id and sent_at is null and failed_at is null;
      v_failed := v_failed + 1;
      continue;
    end if;

    -- Expo replies { "data": [ {status, id} | {status:"error", details:{error}} ] },
    -- in the order the messages were sent. The rows were selected by id, so they
    -- are re-read in the same order to line the two up.
    with tickets as (
      select t.ordinality, t.value
      from jsonb_array_elements((v_row.content::jsonb) -> 'data') with ordinality as t(value, ordinality)
    ),
    rows as (
      select o.id, row_number() over (order by o.id) as n
      from push_outbox o
      where o.request_id = v_row.request_id and o.sent_at is null and o.failed_at is null
    )
    update push_outbox o
    set sent_at = case when tickets.value ->> 'status' = 'ok' then now() end,
        failed_at = case when tickets.value ->> 'status' <> 'ok' then now() end,
        error = tickets.value -> 'details' ->> 'error'
    from tickets join rows on rows.n = tickets.ordinality
    where o.id = rows.id;

    -- A token Expo says is dead is disabled rather than deleted, so the console
    -- can explain an unanswered alert.
    update device_tokens d
    set disabled_at = now(), disabled_reason = 'DeviceNotRegistered'
    from push_outbox o
    where o.token = d.token
      and o.request_id = v_row.request_id
      and o.error = 'DeviceNotRegistered'
      and d.disabled_at is null;

    v_ok := v_ok + 1;
  end loop;

  return jsonb_build_object('responses', v_ok, 'failed', v_failed);
end;
$$;

-- ===========================================================================
-- Keeping it ringing
--
-- A single notification at 3am loses to a phone on silent. An unanswered alert
-- re-notifies every minute, and stops after fifteen — the point is to reach
-- somebody, not to punish the people who already answered.
-- ===========================================================================
create or replace function renotify_unanswered_sos() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_alert record; v_count integer := 0;
begin
  for v_alert in
    select id from sos_alerts
    where status = 'active'
      and raised_at > now() - interval '15 minutes'
      and coalesce(last_notified_at, raised_at) < now() - interval '1 minute'
  loop
    perform enqueue_sos_push(v_alert.id, true);
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then perform drain_push_outbox(); end if;
  return jsonb_build_object('renotified', v_count);
end;
$$;

-- Nothing should stay 'active' forever because everyone was asleep. After an hour
-- it is moved out of the live set so the console's alarm stops and the incident
-- becomes something to review rather than something to answer.
create or replace function expire_stale_sos() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  update sos_alerts
  set status = 'resolved', closed_at = now(),
      closing_note = coalesce(closing_note, 'Closed automatically after one hour with no response. This needs reviewing.')
  where status in ('active', 'acknowledged') and raised_at < now() - interval '1 hour';
  get diagnostics v_n = row_count;
  return jsonb_build_object('expired', v_n);
end;
$$;

-- Delivered tickets are not interesting after a fortnight, and the table is on
-- the hot path of an emergency.
create or replace function prune_push_outbox() returns void
language sql security definer set search_path = public
as $$ delete from push_outbox where coalesce(sent_at, failed_at) < now() - interval '14 days' $$;

-- ------------------------------------------------------------------ schedules
do $$ begin perform cron.unschedule('nbss-drain-push');    exception when others then null; end $$;
do $$ begin perform cron.unschedule('nbss-collect-push');   exception when others then null; end $$;
do $$ begin perform cron.unschedule('nbss-renotify-sos');   exception when others then null; end $$;
do $$ begin perform cron.unschedule('nbss-expire-sos');     exception when others then null; end $$;
do $$ begin perform cron.unschedule('nbss-prune-push');     exception when others then null; end $$;

-- `raise_sos` drains inline, so this is the safety net for anything it missed and
-- the path for retries — not the primary route.
select cron.schedule('nbss-drain-push',  '10 seconds', 'select drain_push_outbox()');
select cron.schedule('nbss-collect-push', '5 seconds', 'select collect_push_responses()');
select cron.schedule('nbss-renotify-sos','30 seconds', 'select renotify_unanswered_sos()');
select cron.schedule('nbss-expire-sos',  '*/5 * * * *', 'select expire_stale_sos()');
select cron.schedule('nbss-prune-push',  '23 3 * * *',  'select prune_push_outbox()');

-- ===========================================================================
-- Row level security
-- ===========================================================================
alter table sos_alerts           enable row level security;
alter table sos_acknowledgements enable row level security;
alter table sos_notifications    enable row level security;
alter table device_tokens        enable row level security;
alter table push_outbox          enable row level security;

-- An alert is readable by the people it was sent to, the guard who raised it, and
-- staff. Not by everyone with an account.
create policy sos_read on sos_alerts
  for select using (
    is_staff()
    or raised_by = auth.uid()
    or exists (select 1 from sos_notifications n where n.alert_id = sos_alerts.id and n.profile_id = auth.uid())
  );

-- No insert, update or delete policy. Raising, answering and closing all go
-- through the functions above, which is what makes "who raised this" trustworthy.

create policy sos_notifications_read on sos_notifications
  for select using (is_staff() or profile_id = auth.uid());

create policy sos_ack_read on sos_acknowledgements
  for select using (
    is_staff()
    or profile_id = auth.uid()
    or exists (select 1 from sos_notifications n where n.alert_id = sos_acknowledgements.alert_id and n.profile_id = auth.uid())
  );

-- A person may see and remove their own devices, and nobody else's. Registration
-- goes through `register_device` so the profile id comes from the JWT.
create policy device_tokens_own on device_tokens
  for select using (profile_id = auth.uid());

create policy device_tokens_own_delete on device_tokens
  for delete using (profile_id = auth.uid());

create policy device_tokens_staff_read on device_tokens
  for select using (is_staff());

-- The outbox is internal. Every push carries somebody's name and location, and no
-- client needs to read the queue it went out in.
create policy push_outbox_admin_read on push_outbox
  for select using (is_admin());

-- ------------------------------------------------------------------- grants
revoke all on function drain_push_outbox(integer)       from anon, authenticated;
revoke all on function collect_push_responses()         from anon, authenticated;
revoke all on function renotify_unanswered_sos()        from anon, authenticated;
revoke all on function expire_stale_sos()               from anon, authenticated;
revoke all on function enqueue_sos_push(uuid, boolean)  from anon, authenticated;
revoke all on function prune_push_outbox()              from anon, authenticated;

grant execute on function raise_sos(sos_kind, double precision, double precision, double precision, text) to authenticated;
grant execute on function acknowledge_sos(uuid, sos_response, double precision, double precision) to authenticated;
grant execute on function close_sos(uuid, sos_status, text) to authenticated;
grant execute on function register_device(text, text, text, text) to authenticated;
grant execute on function release_device(text) to authenticated;
