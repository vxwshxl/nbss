-- ===========================================================================
-- Audit log: every change to the office's records, with what it was before and
-- after.
--
-- Until now the log held only what the code chose to write ("Edited a site").
-- These triggers add a row for every insert, update and delete on the tables
-- the office manages, wherever it came from: the console, the app, a database
-- job or the SQL editor. An update keeps the whole row before and after, so the
-- console can show exactly which fields moved.
--
-- Left out on purpose:
--   * staff_pins (PIN hashes), location history and positions (thousands a day),
--     push and email queues.
--   * Columns that change by themselves (last seen, battery, reminders sent).
--     An update that only touches those is not logged at all.
--   * A guard's own punch and own shift: the app already logs check-in and
--     check-out in words. Edits by anyone else are logged.
--
-- Who did it: auth.uid() when the change came through a signed-in request; for
-- the website's service-role writes, the x-actor-id header it sends
-- (supabaseAdmin(actorId)); otherwise "System".
-- ===========================================================================

alter table audit_log
  add column if not exists source text not null default 'app',
  add column if not exists before jsonb,
  add column if not exists after  jsonb;

comment on column audit_log.source is 'app: written by the code in words; trigger: a row change recorded by the database.';
comment on column audit_log.before is 'Trigger rows: the record before an update or delete.';
comment on column audit_log.after  is 'Trigger rows: the record after an insert or update.';

create index if not exists audit_log_entity_idx on audit_log (entity, created_at desc);

-- The person behind the current statement, if there is one.
create or replace function audit_actor()
returns uuid
language plpgsql stable
set search_path = public
as $$
declare
  v text;
begin
  if auth.uid() is not null then
    return auth.uid();
  end if;
  begin
    v := current_setting('request.headers', true)::json ->> 'x-actor-id';
  exception when others then
    v := null;
  end;
  if v is null or v !~* '^[0-9a-f-]{36}$' then
    return null;
  end if;
  return v::uuid;
end;
$$;

-- tg_argv[0]: columns to ignore, comma separated.
-- tg_argv[1]: 'people' to skip changes with no person behind them.
-- tg_argv[2]: 'not_self' to skip a guard's change to their own row (guard_id).
create or replace function audit_row_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  ignored text[] := case when tg_nargs > 0 and tg_argv[0] <> '' then string_to_array(tg_argv[0], ',') else '{}' end;
  people  boolean := tg_nargs > 1 and tg_argv[1] = 'people';
  notself boolean := tg_nargs > 2 and tg_argv[2] = 'not_self';
  actor   uuid := audit_actor();
  v_old   jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - ignored end;
  v_new   jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - ignored end;
  v_code  text;
  v_id    text;
begin
  if people and actor is null then
    return null;
  end if;
  if notself and actor is not null and actor::text = coalesce(v_new, v_old) ->> 'guard_id' then
    return null;
  end if;
  -- Nothing that matters moved.
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  if actor is not null then
    select employee_code into v_code from profiles where id = actor;
  end if;
  v_id := coalesce(v_new, v_old) ->> coalesce(nullif(tg_argv[3], ''), 'id');

  insert into audit_log (actor_id, actor_code, action, entity, entity_id, source, before, after)
  values (
    case when exists (select 1 from profiles where id = actor) then actor end,
    v_code, lower(tg_op), tg_table_name, v_id, 'trigger', v_old, v_new
  );
  return null;
end;
$$;
revoke all on function audit_row_change() from public, anon, authenticated;

drop trigger if exists audit_rows on profiles;
create trigger audit_rows after insert or update or delete on profiles
  for each row execute function audit_row_change('last_seen_at,updated_at,dev_view_test');

drop trigger if exists audit_rows on sites;
create trigger audit_rows after insert or update or delete on sites
  for each row execute function audit_row_change('updated_at');

drop trigger if exists audit_rows on site_postings;
create trigger audit_rows after insert or update or delete on site_postings
  for each row execute function audit_row_change('updated_at');

drop trigger if exists audit_rows on shifts;
create trigger audit_rows after insert or update or delete on shifts
  for each row execute function audit_row_change(
    'updated_at,notified_at,reminded_at,start_nudged_at,checkout_reminded_at', 'people', 'not_self');

drop trigger if exists audit_rows on shift_types;
create trigger audit_rows after insert or update or delete on shift_types
  for each row execute function audit_row_change('', '', '', 'code');

drop trigger if exists audit_rows on attendance;
create trigger audit_rows after insert or update or delete on attendance
  for each row execute function audit_row_change(
    'updated_at,silent_alerted_at,silent_staff_alerted_at', 'people', 'not_self');

drop trigger if exists audit_rows on guard_devices;
create trigger audit_rows after insert or update or delete on guard_devices
  for each row execute function audit_row_change(
    'battery,charging,last_seen_at,location_permission,gps_enabled,battery_optimized,notifications_enabled,precise_location,permissions_at,app_version,os_version,device_name');

drop trigger if exists audit_rows on service_requests;
create trigger audit_rows after insert or update or delete on service_requests
  for each row execute function audit_row_change('updated_at');

drop trigger if exists audit_rows on replacement_requests;
create trigger audit_rows after insert or update or delete on replacement_requests
  for each row execute function audit_row_change('');

drop trigger if exists audit_rows on sos_alerts;
create trigger audit_rows after insert or update or delete on sos_alerts
  for each row execute function audit_row_change('last_notified_at,notify_count');

drop trigger if exists audit_rows on handover_notes;
create trigger audit_rows after insert or update or delete on handover_notes
  for each row execute function audit_row_change('');

drop trigger if exists audit_rows on location_pins;
create trigger audit_rows after insert or update or delete on location_pins
  for each row execute function audit_row_change('');

drop trigger if exists audit_rows on submissions;
create trigger audit_rows after insert or update or delete on submissions
  for each row execute function audit_row_change('');

drop trigger if exists audit_rows on app_release;
create trigger audit_rows after insert or update or delete on app_release
  for each row execute function audit_row_change('updated_at');

drop trigger if exists audit_rows on software_fee_settings;
create trigger audit_rows after insert or update or delete on software_fee_settings
  for each row execute function audit_row_change('updated_at');

drop trigger if exists audit_rows on software_fee_invoices;
create trigger audit_rows after insert or update or delete on software_fee_invoices
  for each row execute function audit_row_change('updated_at');

drop trigger if exists audit_rows on software_fee_extras;
create trigger audit_rows after insert or update or delete on software_fee_extras
  for each row execute function audit_row_change('');
