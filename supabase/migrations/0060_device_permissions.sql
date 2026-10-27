-- What the phone has allowed the app, as the console's guard card shows it.
--
-- register_handset already carried location ("always" / "foreground" / "denied"), GPS
-- and the battery saver. It now also carries notifications (the watchdog's wake push
-- needs them), whether location is precise or approximate, and the Autostart setting
-- on Xiaomi, Vivo, Oppo and similar (which has no API, so it is what the guard
-- confirmed on the phone). permissions_at is when the phone last reported any of them:
-- the app does so at every launch and every time it comes back to the front.
-- Older app versions keep calling with the first twelve arguments and leave the new
-- columns as they were.

alter table guard_devices
  add column if not exists notifications_enabled boolean,
  add column if not exists precise_location     boolean,
  add column if not exists autostart            text check (autostart in ('confirmed', 'needed', 'not_applicable')),
  add column if not exists permissions_at       timestamptz;

drop function if exists register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean, boolean);

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
  p_battery_optimized boolean default null,
  p_notifications boolean default null,
  p_precise_location boolean default null,
  p_autostart text default null
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
                               battery_optimized, notifications_enabled, precise_location, autostart,
                               permissions_at, approved_at)
    values (v_me, p_device_id, p_platform, p_brand, p_model, p_os_version, p_app_version,
            p_device_name, v_status, p_battery, p_charging, p_location_permission, p_gps_enabled,
            p_battery_optimized, p_notifications, p_precise_location, p_autostart,
            now(), case when v_status = 'approved' then now() end)
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
      notifications_enabled = coalesce(p_notifications, notifications_enabled),
      precise_location = coalesce(p_precise_location, precise_location),
      autostart = coalesce(p_autostart, autostart),
      permissions_at = case when p_location_permission is not null or p_notifications is not null
                            then now() else permissions_at end,
      last_seen_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object('device', v_row.id, 'status', v_row.status, 'new', v_new,
                            'shared_with', v_owner.full_name);
end;
$$;

revoke all on function register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function register_handset(text, text, text, text, text, text, text, smallint, boolean, text, boolean, boolean, boolean, boolean, text) to authenticated;
