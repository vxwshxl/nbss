-- Guards hear about their duty in good time, and about every change to it.
--
--   * The reminder before a duty goes an hour ahead (was 30 minutes).
--   * A duty changed after the guard was told about it (new times, another site),
--     cancelled, handed to someone else, or newly given to them by a reassignment:
--     each affected guard gets one push per roster save, however many duties moved.
--     Replacements are covered by the same path: the original duty is cancelled or cut
--     short (the guard replaced is told), the new one is inserted (shifts_announce).

create or replace function duty_reminders() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v record;
  v_before integer := 0;
  v_late integer := 0;
  v_out integer := 0;
begin
  -- An hour before.
  for v in
    select s.id, s.guard_id, s.starts_at, s.ends_at, st.name as site_name, st.is_test
    from shifts s join sites st on st.id = s.site_id and st.active
    where s.status = 'scheduled' and s.guard_id is not null and s.reminded_at is null
      and s.starts_at between now() and now() + interval '60 minutes'
      and not exists (select 1 from attendance a where a.guard_id = s.guard_id and a.check_out_at is null)
  loop
    perform set_config('nbss.scope', v.is_test::text, true);
    perform enqueue_push(array[v.guard_id], 'Duty at ' || ist_clock(v.starts_at) || ' · ' || v.site_name,
      'Starts in ' || greatest(1, round(extract(epoch from v.starts_at - now()) / 60))::int || ' min. Check in when you reach the gate.',
      jsonb_build_object('type', 'check_in', 'shift_id', v.id));
    update shifts set reminded_at = now() where id = v.id;
    v_before := v_before + 1;
  end loop;

  -- 10 minutes after the start, still not checked in.
  for v in
    select s.id, s.guard_id, s.starts_at, st.name as site_name, st.is_test
    from shifts s join sites st on st.id = s.site_id and st.active
    where s.status = 'scheduled' and s.guard_id is not null and s.start_nudged_at is null
      and s.starts_at < now() - interval '10 minutes' and s.ends_at > now()
      and not exists (select 1 from attendance a where a.shift_id = s.id)
      and not exists (select 1 from attendance a where a.guard_id = s.guard_id and a.check_out_at is null)
  loop
    perform set_config('nbss.scope', v.is_test::text, true);
    perform enqueue_push(array[v.guard_id], 'Not checked in · ' || v.site_name,
      'Your duty started at ' || ist_clock(v.starts_at) || '. Open NBSS Kokrajhar and check in now.',
      jsonb_build_object('type', 'check_in', 'shift_id', v.id));
    update shifts set start_nudged_at = now(), reminded_at = coalesce(reminded_at, now()) where id = v.id;
    v_late := v_late + 1;
  end loop;

  -- The duty has ended and the guard is still checked in.
  for v in
    select s.id, s.ends_at, a.guard_id, st.name as site_name, st.is_test
    from attendance a
    join shifts s on s.id = a.shift_id
    join sites st on st.id = a.site_id
    where a.check_out_at is null and s.checkout_reminded_at is null and s.ends_at <= now()
  loop
    perform set_config('nbss.scope', v.is_test::text, true);
    perform enqueue_push(array[v.guard_id], 'Duty ended · ' || v.site_name,
      'Your duty ended at ' || ist_clock(v.ends_at) || '. Hand over and check out in the app.',
      jsonb_build_object('type', 'check_out', 'shift_id', v.id));
    update shifts set checkout_reminded_at = now() where id = v.id;
    v_out := v_out + 1;
  end loop;

  return jsonb_build_object('before', v_before, 'late', v_late, 'checkout', v_out);
end;
$$;

create or replace function shifts_changed() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v record;
begin
  -- Its own update below (notified_at) must not set it off again.
  if pg_trigger_depth() > 1 then return null; end if;

  for v in
    with ch as (
      select n.id, o.guard_id as old_guard, n.guard_id as new_guard, o.status as old_status, n.status as new_status,
             o.starts_at as old_start, n.starts_at, n.ends_at, o.ends_at as old_end, o.site_id as old_site, n.site_id,
             o.notified_at
      from new_rows n join old_rows o on o.id = n.id
      where greatest(n.ends_at, o.ends_at) > now()
    ),
    told as (
      -- Taken off a duty they were told about (reassigned to someone else).
      select old_guard as guard_id, 'removed' as kind, id, old_start as at_start, old_end as at_end, old_site as site
      from ch where old_guard is not null and old_guard is distinct from new_guard and notified_at is not null
      union all
      -- Given a duty by a reassignment.
      select new_guard, 'added', id, starts_at, ends_at, site_id
      from ch where new_guard is not null and new_guard is distinct from old_guard and new_status = 'scheduled'
      union all
      -- Cancelled (or handed over) while still theirs.
      select new_guard, 'cancelled', id, old_start, old_end, old_site
      from ch where new_guard is not null and new_guard = old_guard and notified_at is not null
        and old_status <> 'cancelled' and new_status = 'cancelled'
      union all
      -- New times or another site.
      select new_guard, 'changed', id, starts_at, ends_at, site_id
      from ch where new_guard is not null and new_guard = old_guard and notified_at is not null
        and new_status <> 'cancelled'
        and (starts_at is distinct from old_start or ends_at is distinct from old_end or site_id is distinct from old_site)
    )
    select t.guard_id, count(*) as n,
           (array_agg(t.kind order by t.at_start))[1] as kind,
           (array_agg(t.id order by t.at_start))[1] as first_id,
           min(t.at_start) as first_start,
           (array_agg(t.at_end order by t.at_start))[1] as first_end,
           (array_agg(st.name order by t.at_start))[1] as site_name,
           bool_or(st.is_test) as is_test
    from told t join sites st on st.id = t.site
    group by t.guard_id
  loop
    perform set_config('nbss.scope', v.is_test::text, true);
    perform enqueue_push(array[v.guard_id],
      case
        when v.n > 1 then v.n || ' changes to your duties'
        when v.kind = 'removed' then 'Duty removed · ' || v.site_name
        when v.kind = 'added' then 'New duty · ' || v.site_name
        when v.kind = 'cancelled' then 'Duty cancelled · ' || v.site_name
        else 'Duty changed · ' || v.site_name
      end,
      case
        when v.n > 1 then 'Open the app to see your roster.'
        when v.kind = 'removed' then ist_day(v.first_start) || ', ' || ist_clock(v.first_start) || ' – ' || ist_clock(v.first_end) || ' is no longer yours.'
        when v.kind = 'cancelled' then ist_day(v.first_start) || ', ' || ist_clock(v.first_start) || ' – ' || ist_clock(v.first_end) || ' is cancelled or handed over. Do not go.'
        else 'Now ' || ist_day(v.first_start) || ', ' || ist_clock(v.first_start) || ' – ' || ist_clock(v.first_end) || '. Tap to see the details.'
      end,
      jsonb_build_object('type', 'duty', 'shift_id', case when v.n = 1 and v.kind in ('added', 'changed') then v.first_id::text end));
  end loop;

  -- A reassigned duty counts as announced to its new guard.
  update shifts s set notified_at = now()
  from new_rows n join old_rows o on o.id = n.id
  where s.id = n.id and n.guard_id is not null and n.guard_id is distinct from o.guard_id;
  return null;
end;
$$;

drop trigger if exists shifts_changed on shifts;
create trigger shifts_changed after update on shifts
  referencing old table as old_rows new table as new_rows
  for each statement execute function shifts_changed();

revoke all on function shifts_changed() from public, anon, authenticated;
