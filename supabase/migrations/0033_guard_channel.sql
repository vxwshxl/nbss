-- A personal realtime channel per person, so the app is told about an SOS instead
-- of asking every few seconds.
--
-- topic `guard:<profile id>`: only that person may read it. Whenever an SOS they may
-- see changes (raised and sent to them, answered, moved to on scene, closed), a small
-- 'sos' message goes to the raiser and everyone it was sent to; the app then reloads
-- once. The phone keeps one socket open instead of three timers.

drop policy if exists nbss_own_channel_read on realtime.messages;
create policy nbss_own_channel_read on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'guard:' || auth.uid()::text);

create or replace function sos_tell_people(p_alert_id uuid, p_what text) returns void
language plpgsql security definer set search_path = public
as $$
declare v_who uuid;
begin
  for v_who in
    select raised_by from sos_alerts where id = p_alert_id
    union
    select profile_id from sos_notifications where alert_id = p_alert_id
  loop
    perform realtime.send(jsonb_build_object('alert_id', p_alert_id, 'what', p_what), 'sos', 'guard:' || v_who, true);
  end loop;
end;
$$;
revoke all on function sos_tell_people(uuid, text) from public, anon, authenticated;

-- Sent to: once the recipients are recorded (they are written after the alert).
create or replace function sos_tell_on_sent() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v record;
begin
  for v in select distinct alert_id from new_rows loop
    perform sos_tell_people(v.alert_id, 'raised');
  end loop;
  return null;
end;
$$;
drop trigger if exists sos_notifications_tell on sos_notifications;
create trigger sos_notifications_tell after insert on sos_notifications
  referencing new table as new_rows for each statement execute function sos_tell_on_sent();

-- Status changes (answered, closed).
create or replace function sos_tell_on_status() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform sos_tell_people(new.id, new.status::text);
  end if;
  return null;
end;
$$;
drop trigger if exists sos_alerts_tell on sos_alerts;
create trigger sos_alerts_tell after update of status on sos_alerts
  for each row execute function sos_tell_on_status();

-- Someone answers, or is moved to on scene.
create or replace function sos_tell_on_answer() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.response is distinct from old.response then
    perform sos_tell_people(new.alert_id, 'answer');
  end if;
  return null;
end;
$$;
drop trigger if exists sos_acknowledgements_tell on sos_acknowledgements;
create trigger sos_acknowledgements_tell after insert or update of response on sos_acknowledgements
  for each row execute function sos_tell_on_answer();
