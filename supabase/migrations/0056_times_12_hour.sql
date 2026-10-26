-- Every time the database writes into a notification or email is 12-hour ("8:00 pm"),
-- through ist_clock, as the app and the website show them. These three still wrote
-- "20:00".

CREATE OR REPLACE FUNCTION public.assign_replacement(p_shift_ids uuid[], p_guard uuid, p_reason text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me    uuid := auth.uid();
  v_guard profiles%rowtype;
  v_old   shifts%rowtype;
  v_site  sites%rowtype;
  v_orig  profiles%rowtype;
  v_new   uuid;
  v_start timestamptz;
  v_made  integer := 0;
  v_lines text[] := '{}';
  v_sites text[] := '{}';
begin
  if v_me is null or not is_staff() then
    raise exception 'Only a supervisor assigns a replacement.' using errcode = '42501';
  end if;

  select * into v_guard from profiles where id = p_guard;
  if not found or v_guard.role <> 'guard' or not v_guard.active then
    raise exception 'Choose an active guard as the replacement.' using errcode = '22023';
  end if;

  for v_old in
    select * from shifts where id = any (p_shift_ids) order by starts_at for update
  loop
    if v_old.guard_id = p_guard then
      raise exception '% is already the guard on that shift.', v_guard.full_name using errcode = 'P0001';
    end if;
    if v_old.status not in ('scheduled', 'in_progress', 'missed') or v_old.replaced_by_shift is not null then
      raise exception 'A shift that is % cannot be handed over.', v_old.status using errcode = 'P0001';
    end if;
    if v_old.ends_at <= now() then
      raise exception 'That shift has already ended.' using errcode = 'P0001';
    end if;

    select * into v_site from sites where id = v_old.site_id;
    select * into v_orig from profiles where id = v_old.guard_id;
    v_start := greatest(v_old.starts_at, case when v_old.status = 'in_progress' then now() else v_old.starts_at end);

    -- The original first, so the overlap rule does not see two guards' shifts as one.
    update shifts set
      status = case when v_old.status = 'in_progress' then 'in_progress'::shift_status else 'cancelled'::shift_status end,
      ends_at = case when v_old.status = 'in_progress' then greatest(now(), starts_at + interval '1 minute') else ends_at end,
      cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Replaced')
    where id = v_old.id;

    begin
      insert into shifts (site_id, guard_id, starts_at, ends_at, status, notes, created_by,
                          shift_type, replaces_shift)
      values (v_old.site_id, p_guard, v_start, v_old.ends_at, 'scheduled',
              'Replacing ' || v_orig.full_name, v_me, v_old.shift_type, v_old.id)
      returning id into v_new;
    exception when exclusion_violation then
      raise exception '% already has a shift overlapping % on %.',
        v_guard.full_name, v_site.name,
        (to_char(v_old.starts_at at time zone 'Asia/Kolkata', 'DD Mon') || ', ' || ist_clock(v_old.starts_at))
        using errcode = 'P0001';
    end;

    update shifts set replaced_by_shift = v_new where id = v_old.id;

    v_made := v_made + 1;
    v_lines := v_lines || ((to_char(v_start at time zone 'Asia/Kolkata', 'Dy DD Mon') || ', ' || ist_clock(v_start)) || '–'
                          || ist_clock(v_old.ends_at) || ' at ' || v_site.name);
    v_sites := v_sites || v_site.name;
  end loop;

  if v_made = 0 then
    raise exception 'Choose at least one shift to hand over.' using errcode = '22023';
  end if;

  if p_request_id is not null then
    update replacement_requests
    set status = 'assigned', replacement_guard = p_guard, handled_by = v_me, handled_at = now()
    where id = p_request_id and status = 'open';
  end if;
  -- Any other open request for these shifts is answered by the same act.
  update replacement_requests
  set status = 'assigned', replacement_guard = p_guard, handled_by = v_me, handled_at = now()
  where shift_id = any (p_shift_ids) and status = 'open';

  perform enqueue_push(array[p_guard],
    'New duty · ' || v_sites[1],
    case when v_made = 1 then 'You are replacing ' || v_orig.full_name || ': ' || v_lines[1]
         else 'You have ' || v_made || ' replacement duties. Open the app to see them.' end,
    jsonb_build_object('type', 'duty'));

  perform enqueue_email(v_guard.email, v_guard.full_name, 'duty',
    case when v_made = 1 then 'New duty: ' || v_lines[1] else v_made || ' new duties assigned to you' end,
    jsonb_build_object('guard', v_guard.full_name, 'replacing', v_orig.full_name,
                       'lines', to_jsonb(v_lines), 'reason', nullif(trim(p_reason), '')));

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_me, 'replacement_assigned', 'profiles', p_guard::text,
          jsonb_build_object('shifts', to_jsonb(p_shift_ids), 'reason', p_reason, 'count', v_made));

  return jsonb_build_object('ok', true, 'count', v_made);
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_replacement(p_shift_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me    uuid := auth.uid();
  v_me_p  profiles%rowtype;
  v_shift shifts%rowtype;
  v_site  sites%rowtype;
  v_id    uuid;
  v_when  text;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  select * into v_me_p from profiles where id = v_me and active;

  select * into v_shift from shifts where id = p_shift_id and guard_id = v_me;
  if not found then raise exception 'That duty is not yours.' using errcode = '42501'; end if;
  if v_shift.status not in ('scheduled', 'in_progress') or v_shift.ends_at <= now() then
    raise exception 'That duty can no longer be changed.' using errcode = 'P0001';
  end if;

  select * into v_site from sites where id = v_shift.site_id;
  v_when := (to_char(v_shift.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon') || ', ' || ist_clock(v_shift.starts_at));

  begin
    insert into replacement_requests (shift_id, guard_id, reason)
    values (p_shift_id, v_me, nullif(trim(p_reason), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You have already asked for this duty to be covered.' using errcode = 'P0001';
  end;

  perform enqueue_push(
    array(select id from profiles where active and role in ('developer', 'admin', 'supervisor')),
    'Replacement needed · ' || v_site.name,
    v_me_p.full_name || ' cannot make ' || v_when || coalesce(': ' || nullif(trim(p_reason), ''), '.'),
    jsonb_build_object('type', 'replacement', 'request_id', v_id));

  perform enqueue_staff_email('replacement_request', 'Replacement needed: ' || v_site.name || ', ' || v_when,
    jsonb_build_object('guard', v_me_p.full_name, 'code', v_me_p.employee_code, 'site', v_site.name,
                       'when', v_when, 'reason', nullif(trim(p_reason), '')));

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (v_me, 'replacement_requested', 'shifts', p_shift_id::text, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'request_id', v_id);
end;
$function$;

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
      and coalesce(sh.ends_at, a.check_in_at + make_interval(mins => s.standard_shift_minutes)) <= now()
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
        || ', so you were checked out. Location sharing has stopped.',
      jsonb_build_object('type', 'check_out', 'attendance_id', v.id));

    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'auto_check_out', 'attendance', v.id::text,
            jsonb_build_object('guard', v.guard_id, 'site', v.site_id, 'at', v.ends_at));

    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$function$;
