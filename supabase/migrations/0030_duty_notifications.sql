-- Duty notifications and faster wake-ups.
--
--   * A guard is told when a duty is put on their roster (one message per roster
--     change, however many duties it added).
--   * 30 minutes before a duty: "starts at 6:00 am, check in when you arrive".
--   * 10 minutes after the start with no check-in: "your duty has started".
--   * At the end of a duty still checked in: "duty ended, check out".
--   * A checked-in phone that has gone quiet is woken every 5 minutes (was 10/15).
--   * wake_guard(): the office wakes one guard's phone by hand, from the console.
--
-- All of it rides on the existing push_outbox and the nbss-silent-guards cron
-- (every 2 minutes), which now also runs duty_reminders().

alter table shifts
  add column if not exists notified_at timestamptz,
  add column if not exists reminded_at timestamptz,
  add column if not exists start_nudged_at timestamptz,
  add column if not exists checkout_reminded_at timestamptz;

-- Nothing already on the roster is announced again.
update shifts set notified_at = coalesce(notified_at, now()), reminded_at = coalesce(reminded_at, case when starts_at < now() + interval '30 minutes' then now() end),
                  start_nudged_at = coalesce(start_nudged_at, case when starts_at < now() then now() end),
                  checkout_reminded_at = coalesce(checkout_reminded_at, case when ends_at < now() then now() end);

create or replace function ist_clock(p timestamptz) returns text
language sql immutable set search_path = public
as $$ select ltrim(to_char(p at time zone 'Asia/Kolkata', 'HH12:MI am'), '0') $$;

create or replace function ist_day(p timestamptz) returns text
language sql immutable set search_path = public
as $$ select to_char(p at time zone 'Asia/Kolkata', 'Dy DD Mon') $$;

-- New duties, announced once per guard per roster change.
create or replace function shifts_announce() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v record;
begin
  for v in
    select n.guard_id, count(*) as n,
           (array_agg(n.id order by n.starts_at))[1] as first_id,
           min(n.starts_at) as first_start,
           (array_agg(n.ends_at order by n.starts_at))[1] as first_end,
           (array_agg(st.name order by n.starts_at))[1] as site_name
    from new_rows n
    join sites st on st.id = n.site_id and st.active
    where n.guard_id is not null and n.status = 'scheduled' and n.starts_at > now() and n.notified_at is null
    group by n.guard_id
  loop
    perform enqueue_push(array[v.guard_id],
      case when v.n = 1 then 'New duty · ' || v.site_name else v.n || ' new duties on your roster' end,
      case when v.n = 1
        then ist_day(v.first_start) || ', ' || ist_clock(v.first_start) || ' – ' || ist_clock(v.first_end) || '. Tap to see the details.'
        else 'Next: ' || v.site_name || ', ' || ist_day(v.first_start) || ' at ' || ist_clock(v.first_start) || '.'
      end,
      jsonb_build_object('type', 'duty', 'shift_id', case when v.n = 1 then v.first_id::text end));
  end loop;
  update shifts s set notified_at = now() from new_rows n where s.id = n.id and s.notified_at is null;
  return null;
end;
$$;

drop trigger if exists shifts_announce on shifts;
create trigger shifts_announce after insert on shifts
  referencing new table as new_rows
  for each statement execute function shifts_announce();

-- Before, at and after a duty. Returns counts for the cron log.
create or replace function duty_reminders() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v record;
  v_before integer := 0;
  v_late integer := 0;
  v_out integer := 0;
begin
  -- 30 minutes before.
  for v in
    select s.id, s.guard_id, s.starts_at, s.ends_at, st.name as site_name
    from shifts s join sites st on st.id = s.site_id and st.active
    where s.status = 'scheduled' and s.guard_id is not null and s.reminded_at is null
      and s.starts_at between now() and now() + interval '30 minutes'
      and not exists (select 1 from attendance a where a.guard_id = s.guard_id and a.check_out_at is null)
  loop
    perform enqueue_push(array[v.guard_id], 'Duty at ' || ist_clock(v.starts_at) || ' · ' || v.site_name,
      'Starts in ' || greatest(1, round(extract(epoch from v.starts_at - now()) / 60))::int || ' min. Check in when you reach the gate.',
      jsonb_build_object('type', 'check_in', 'shift_id', v.id));
    update shifts set reminded_at = now() where id = v.id;
    v_before := v_before + 1;
  end loop;

  -- 10 minutes after the start, still not checked in.
  for v in
    select s.id, s.guard_id, s.starts_at, st.name as site_name
    from shifts s join sites st on st.id = s.site_id and st.active
    where s.status = 'scheduled' and s.guard_id is not null and s.start_nudged_at is null
      and s.starts_at < now() - interval '10 minutes' and s.ends_at > now()
      and not exists (select 1 from attendance a where a.shift_id = s.id)
      and not exists (select 1 from attendance a where a.guard_id = s.guard_id and a.check_out_at is null)
  loop
    perform enqueue_push(array[v.guard_id], 'Not checked in · ' || v.site_name,
      'Your duty started at ' || ist_clock(v.starts_at) || '. Open NBSS Kokrajhar and check in now.',
      jsonb_build_object('type', 'check_in', 'shift_id', v.id));
    update shifts set start_nudged_at = now(), reminded_at = coalesce(reminded_at, now()) where id = v.id;
    v_late := v_late + 1;
  end loop;

  -- The duty has ended and the guard is still checked in.
  for v in
    select s.id, s.ends_at, a.guard_id, st.name as site_name
    from attendance a
    join shifts s on s.id = a.shift_id
    join sites st on st.id = a.site_id
    where a.check_out_at is null and s.checkout_reminded_at is null and s.ends_at <= now()
  loop
    perform enqueue_push(array[v.guard_id], 'Duty ended · ' || v.site_name,
      'Your duty ended at ' || ist_clock(v.ends_at) || '. Hand over and check out in the app.',
      jsonb_build_object('type', 'check_out', 'shift_id', v.id));
    update shifts set checkout_reminded_at = now() where id = v.id;
    v_out := v_out + 1;
  end loop;

  return jsonb_build_object('before', v_before, 'late', v_late, 'checkout', v_out);
end;
$$;

-- The wake-up itself: a silent push (the app restarts tracking in the background)
-- and a visible one in case the silent one cannot run.
create or replace function wake_phone(p_attendance uuid, p_guard uuid, p_site text, p_by_office boolean)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  insert into push_outbox (token, profile_id, title, body, data, priority, channel_id, sound, ttl_seconds)
  select d.token, d.profile_id, null, null,
         jsonb_build_object('type', 'resume_tracking', 'attendance_id', p_attendance), 'high', null, null, 300
  from device_tokens d where d.profile_id = p_guard and d.disabled_at is null;
  get diagnostics v_n = row_count;
  perform enqueue_push(array[p_guard],
    case when p_by_office then 'The office is checking on you' else 'Location sharing stopped' end,
    'You are on duty at ' || p_site || '. Tap to open NBSS Kokrajhar so your location is shared again.',
    jsonb_build_object('type', 'resume_tracking', 'attendance_id', p_attendance));
  perform pg_notify('nbss_push', '');
  return v_n;
end;
$$;
revoke all on function wake_phone(uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function check_silent_guards() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row       record;
  v_woken     integer := 0;
  v_escalated integer := 0;
  v_staff     uuid[] := array(select id from profiles where active and role in ('developer', 'admin', 'supervisor'));
  v_duty      jsonb;
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
      and greatest(a.check_in_at, gp.received_at, gp.recorded_at) < now() - interval '5 minutes'
  loop
    -- Wake the phone while it stays quiet: every 4 minutes on the 2-minute cron.
    if v_row.silent_alerted_at is null or v_row.silent_alerted_at < v_row.heard
       or v_row.silent_alerted_at < now() - interval '3 minutes 50 seconds' then
      perform wake_phone(v_row.id, v_row.guard_id, v_row.site_name, false);
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

  v_duty := duty_reminders();
  return jsonb_build_object('woken', v_woken, 'escalated', v_escalated, 'duty', v_duty);
end;
$$;

-- The console's "Wake up phone" button.
create or replace function wake_guard(p_guard uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_open record;
  v_n integer;
begin
  if not is_staff() then raise exception 'Only the office can wake a phone.'; end if;
  select a.id, s.name as site_name into v_open
  from attendance a join sites s on s.id = a.site_id
  where a.guard_id = p_guard and a.check_out_at is null
  order by a.check_in_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_on_duty');
  end if;
  v_n := wake_phone(v_open.id, p_guard, v_open.site_name, true);
  update attendance set silent_alerted_at = now() where id = v_open.id;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), 'wake_phone', 'profiles', p_guard::text, jsonb_build_object('attendance_id', v_open.id, 'devices', v_n));
  return jsonb_build_object('ok', true, 'devices', v_n);
end;
$$;

revoke all on function wake_guard(uuid) from public, anon;
grant execute on function wake_guard(uuid) to authenticated;
revoke all on function duty_reminders() from public, anon, authenticated;
