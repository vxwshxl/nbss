-- ===========================================================================
-- Tracking that cannot die quietly.
--
-- A phone stops reporting for ordinary reasons: the guard swiped the app away
-- on a phone whose battery saver then killed it, the phone restarted, the OS
-- reclaimed memory overnight. Until now the console noticed (the dot greys out)
-- but nobody was told, and nothing tried to bring it back.
--
--   check_silent_guards()   every two minutes (pg_cron, scheduled from the
--                           cluster's postgres database — see README → Database):
--     · 10 minutes without a word from an on-duty guard's phone → a silent
--       "wake" push (no title: the app handles it in the background and restarts
--       the location service — a high-priority FCM message is what Android
--       allows to start one from the background) plus a visible notification
--       asking the guard to open the app. Repeated every 15 minutes of silence.
--     · 20 minutes → the supervisors are told, by push and email, once per
--       silence.
--
-- Also: whether the phone's battery saver may kill the app, reported by the app
-- (guard_devices.battery_optimized), so the console can say why a phone went
-- quiet before it happens.
-- ===========================================================================

alter table guard_devices add column if not exists battery_optimized boolean;
comment on column guard_devices.battery_optimized is
  'True when Android battery optimisation is on for the app, i.e. the OS may stop background tracking.';

alter table attendance add column if not exists silent_alerted_at       timestamptz;
alter table attendance add column if not exists silent_staff_alerted_at timestamptz;

-- A data-only push (the background wake) has no title or body.
alter table push_outbox alter column title drop not null;
alter table push_outbox alter column body  drop not null;

-- register_handset gains the battery-saver flag.
drop function if exists register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean);

create or replace function register_handset(
  p_device_id   text,
  p_platform    text default null,
  p_brand       text default null,
  p_model       text default null,
  p_os_version  text default null,
  p_app_version text default null,
  p_device_name text default null,
  p_battery     smallint default null,
  p_charging    boolean default null,
  p_location_permission text default null,
  p_gps_enabled boolean default null,
  p_battery_optimized boolean default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_profile profiles%rowtype;
  v_row     guard_devices%rowtype;
  v_owner   profiles%rowtype;
  v_status  text;
  v_new     boolean := false;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  if p_device_id is null or length(p_device_id) not between 8 and 128 then
    raise exception 'A device id is required.' using errcode = '22023';
  end if;

  select * into v_profile from profiles where id = v_me and active;
  if not found then raise exception 'This account is not active.' using errcode = '42501'; end if;

  select * into v_row from guard_devices where profile_id = v_me and device_id = p_device_id;

  if not found then
    v_new := true;
    select p.* into v_owner from guard_devices d join profiles p on p.id = d.profile_id
    where d.device_id = p_device_id and d.profile_id <> v_me and d.status = 'approved'
      and p.active and p.role = 'guard'
    limit 1;

    v_status := case
      when v_profile.role <> 'guard' then 'approved'
      when v_owner.id is not null then 'pending'
      when not exists (select 1 from guard_devices where profile_id = v_me and status = 'approved') then 'approved'
      else 'pending'
    end;

    insert into guard_devices (profile_id, device_id, platform, brand, model, os_version, app_version,
                               device_name, status, battery, charging, location_permission, gps_enabled,
                               battery_optimized, approved_at)
    values (v_me, p_device_id, p_platform, p_brand, p_model, p_os_version, p_app_version,
            p_device_name, v_status, p_battery, p_charging, p_location_permission, p_gps_enabled,
            p_battery_optimized, case when v_status = 'approved' then now() end)
    returning * into v_row;

    if v_status = 'pending' then
      insert into audit_log (actor_id, actor_code, action, entity, entity_id, detail)
      values (v_me, v_profile.employee_code, 'device_pending', 'guard_devices', v_row.id::text,
              jsonb_build_object('model', p_model, 'brand', p_brand, 'shared_with', v_owner.employee_code));
      perform enqueue_staff_email('device', 'New phone for ' || v_profile.full_name,
        jsonb_build_object('guard', v_profile.full_name, 'code', v_profile.employee_code,
                           'device', trim(coalesce(p_brand, '') || ' ' || coalesce(p_model, 'Unknown phone')),
                           'platform', p_platform, 'os', p_os_version,
                           'shared_with', v_owner.full_name, 'shared_code', v_owner.employee_code));
      perform enqueue_push(
        array(select id from profiles where active and role in ('developer', 'admin', 'supervisor')),
        'New phone · ' || v_profile.full_name,
        coalesce('Already registered to ' || v_owner.full_name || '. ', '')
          || 'Approve it in Devices, or their check-ins stay held for review.',
        jsonb_build_object('type', 'device', 'device_id', v_row.id));
    end if;
  else
    update guard_devices set
      platform = coalesce(p_platform, platform), brand = coalesce(p_brand, brand),
      model = coalesce(p_model, model), os_version = coalesce(p_os_version, os_version),
      app_version = coalesce(p_app_version, app_version), device_name = coalesce(p_device_name, device_name),
      battery = coalesce(p_battery, battery), charging = coalesce(p_charging, charging),
      location_permission = coalesce(p_location_permission, location_permission),
      gps_enabled = coalesce(p_gps_enabled, gps_enabled),
      battery_optimized = coalesce(p_battery_optimized, battery_optimized),
      last_seen_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object('device', v_row.id, 'status', v_row.status, 'new', v_new,
                            'shared_with', v_owner.full_name);
end;
$$;

revoke all on function register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean, boolean) from public, anon;
grant execute on function register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean, boolean) to authenticated;

/**
 * The watchdog. Returns what it did, for the cron log.
 */
create or replace function check_silent_guards() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row       record;
  v_woken     integer := 0;
  v_escalated integer := 0;
  v_staff     uuid[] := array(select id from profiles where active and role in ('developer', 'admin', 'supervisor'));
begin
  for v_row in
    select a.id, a.guard_id, a.check_in_at, a.silent_alerted_at, a.silent_staff_alerted_at,
           p.full_name, p.employee_code, p.phone, s.name as site_name,
           greatest(a.check_in_at, gp.received_at, gp.recorded_at) as heard
    from attendance a
    join profiles p on p.id = a.guard_id
    join sites s on s.id = a.site_id
    left join guard_positions gp on gp.guard_id = a.guard_id
    where a.check_out_at is null
      and greatest(a.check_in_at, gp.received_at, gp.recorded_at) < now() - interval '10 minutes'
  loop
    -- Wake the phone: a new silence, or 15 minutes since the last try.
    if v_row.silent_alerted_at is null or v_row.silent_alerted_at < v_row.heard
       or v_row.silent_alerted_at < now() - interval '15 minutes' then
      -- Silent: the app restarts tracking in the background.
      insert into push_outbox (token, profile_id, title, body, data, priority, channel_id, sound, ttl_seconds)
      select d.token, d.profile_id, null, null,
             jsonb_build_object('type', 'resume_tracking', 'attendance_id', v_row.id), 'high', null, null, 600
      from device_tokens d where d.profile_id = v_row.guard_id and d.disabled_at is null;
      -- Visible: in case the wake could not (force-stopped, notifications off for background).
      perform enqueue_push(array[v_row.guard_id],
        'Location sharing stopped',
        'You are on duty at ' || v_row.site_name || '. Tap to open NBSS Kokrajhar and resume.',
        jsonb_build_object('type', 'resume_tracking', 'attendance_id', v_row.id));
      update attendance set silent_alerted_at = now() where id = v_row.id;
      v_woken := v_woken + 1;
    end if;

    -- Tell the supervisors once per silence, after 20 minutes.
    if v_row.heard < now() - interval '20 minutes'
       and (v_row.silent_staff_alerted_at is null or v_row.silent_staff_alerted_at < v_row.heard) then
      perform enqueue_push(v_staff,
        'No signal · ' || v_row.full_name,
        v_row.site_name || ': nothing from the phone since '
          || to_char(v_row.heard at time zone 'Asia/Kolkata', 'HH12:MI am') || '. The guard has been asked to open the app.',
        jsonb_build_object('type', 'silent_guard', 'attendance_id', v_row.id, 'guard_id', v_row.guard_id));
      perform enqueue_staff_email('silent', 'No signal from ' || v_row.full_name || ' · ' || v_row.site_name,
        jsonb_build_object('guard', v_row.full_name, 'code', v_row.employee_code, 'phone', v_row.phone,
                           'site', v_row.site_name, 'since', v_row.heard, 'attendance_id', v_row.id));
      update attendance set silent_staff_alerted_at = now() where id = v_row.id;
      v_escalated := v_escalated + 1;
    end if;
  end loop;

  return jsonb_build_object('woken', v_woken, 'escalated', v_escalated);
end;
$$;

revoke all on function check_silent_guards() from public, anon, authenticated;
grant execute on function check_silent_guards() to service_role;

-- Scheduled from the cluster's `postgres` database (pg_cron lives there):
--   select cron.schedule_in_database('nbss-silent-guards', '*/2 * * * *',
--          'select check_silent_guards()', 'tenant_nbss');
