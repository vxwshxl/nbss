-- ===========================================================================
-- Auto check-out after 5 minutes, not an hour.
--
-- A guard or housekeeper who has not checked out 5 minutes after their shift
-- ends is checked out automatically, still at the shift's end time, and their
-- location sharing stops. The hour's grace (0058) left them on the live map
-- and on duty long after they had gone home.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.auto_check_out()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v record;
  v_done integer := 0;
begin
  for v in
    select a.id, a.guard_id, a.site_id, a.shift_id, s.name as site_name,
           coalesce(sh.ends_at, a.check_in_at + make_interval(mins => s.standard_shift_minutes)) as ends_at
    from attendance a
    join sites s on s.id = a.site_id
    left join shifts sh on sh.id = a.shift_id
    where a.check_out_at is null
      and a.check_in_at is not null
      -- Five minutes' grace after the end, time to tap Check out at the gate; one
      -- who forgot is checked out at the end of the shift.
      and coalesce(sh.ends_at, a.check_in_at + make_interval(mins => s.standard_shift_minutes)) + interval '5 minutes' <= now()
    for update of a skip locked
  loop
    update attendance
    set check_out_at = greatest(v.ends_at, check_in_at + interval '1 minute'),
        check_out_method = 'auto_close'
    where id = v.id;

    update shifts set status = 'completed' where id = v.shift_id and status = 'in_progress';
    delete from guard_positions where guard_id = v.guard_id;

    perform enqueue_push(array[v.guard_id],
      'Checked out automatically · ' || v.site_name,
      'Your duty ended at ' || ist_clock(v.ends_at)
        || ' and you did not check out within 5 minutes, so you were checked out at ' || ist_clock(v.ends_at) || '. Location sharing has stopped.',
      jsonb_build_object('type', 'check_out', 'attendance_id', v.id));

    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'auto_check_out', 'attendance', v.id::text,
            jsonb_build_object('guard', v.guard_id, 'site', v.site_id, 'at', v.ends_at));

    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$function$;
