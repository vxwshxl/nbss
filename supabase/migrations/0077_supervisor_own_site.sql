-- ===========================================================================
-- A supervisor sees their own site; the field officer sees the area.
--
-- Until now a supervisor was office staff: every site, every guard, every SOS,
-- the enquiries and the bookings. Now:
--
--   · field_officer (0076) takes over all of that. is_staff() means developer,
--     admin or field officer, so every policy and function that asks it gives a
--     field officer the whole console, as it gave a supervisor.
--   · supervisor sees only the sites they are posted to (an active site_posting):
--     the attendance, roster, positions, routes, handover notes, devices, SOS and
--     replacements there, and the people who work there (plus the office and the
--     site's client, so names and phone numbers still show). Nothing elsewhere;
--     no enquiries or bookings.
--
-- The checks are oversees_site(site) and oversees_person(profile): true for the
-- office everywhere, and for a supervisor at their own sites. The SOS staff fan-out,
-- the "no signal" escalation, new-phone and replacement pushes now go to the office
-- and to the supervisor of the site concerned, rather than to every supervisor.
-- ===========================================================================

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() in ('developer', 'admin', 'field_officer'), false) $$;

-- The sites a supervisor is posted to. Empty for anyone else.
create or replace function supervised_site_ids() returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(sp.site_id), '{}') from site_postings sp
  where sp.guard_id = auth.uid() and sp.active and my_role() = 'supervisor'::user_role
$$;

-- Everyone a supervisor may see: themselves, the office, and anyone posted, rostered
-- or checked in at their sites, now or before (so the site's history keeps its
-- names), and the site's client. Empty for anyone but a supervisor.
create or replace function overseen_people() returns uuid[]
language sql stable security definer set search_path = public
as $$
  with mine as (select unnest(supervised_site_ids()) as site_id)
  select coalesce(array_agg(distinct x.id), '{}') from (
    select auth.uid() as id
    union select p.id from profiles p where p.role in ('admin', 'field_officer')
    union select sp.guard_id from site_postings sp join mine using (site_id) where sp.active
    union select sh.guard_id from shifts sh join mine using (site_id)
    union select a.guard_id from attendance a join mine using (site_id)
    union select s.client_id from sites s join mine on mine.site_id = s.id
  ) x
  where x.id is not null and my_role() = 'supervisor'::user_role
$$;

-- The office, anywhere; a supervisor, at their own sites. A row with no site
-- (an SOS raised away from any site, a fix taken off duty) is the office's alone.
create or replace function oversees_site(p_site uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select is_staff() or coalesce(p_site = any (supervised_site_ids()), false) $$;

create or replace function oversees_person(p_profile uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select is_staff() or coalesce(p_profile = any (overseen_people()), false) $$;

create or replace function oversees_shift(p_shift uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select oversees_site((select site_id from shifts where id = p_shift)) $$;

create or replace function oversees_alert(p_alert uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select oversees_site((select site_id from sos_alerts where id = p_alert)) $$;

grant execute on function supervised_site_ids() to authenticated;
grant execute on function overseen_people() to authenticated;
grant execute on function oversees_site(uuid) to authenticated;
grant execute on function oversees_person(uuid) to authenticated;
grant execute on function oversees_shift(uuid) to authenticated;
grant execute on function oversees_alert(uuid) to authenticated;

-- Who hears about something at a site: the office, and the supervisors posted there.
create or replace function office_ids(p_site uuid) returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(p.id), '{}') from profiles p
  where p.active
    and (p.role in ('developer', 'admin', 'field_officer')
         or (p.role = 'supervisor' and p_site is not null
             and exists (select 1 from site_postings sp where sp.guard_id = p.id and sp.site_id = p_site and sp.active)))
$$;

-- The same, for something about a person rather than a site: the office, and the
-- supervisors of the sites that person is posted to.
create or replace function office_ids_for(p_profile uuid) returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(p.id), '{}') from profiles p
  where p.active
    and (p.role in ('developer', 'admin', 'field_officer')
         or (p.role = 'supervisor'
             and exists (select 1 from site_postings mine
                         join site_postings sup on sup.site_id = mine.site_id
                         where mine.guard_id = p_profile and mine.active
                           and sup.guard_id = p.id and sup.active)))
$$;

revoke all on function office_ids(uuid) from public, anon, authenticated;
revoke all on function office_ids_for(uuid) from public, anon, authenticated;
grant execute on function office_ids(uuid) to service_role;
grant execute on function office_ids_for(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Policies: "staff" becomes "oversees this site / this person".
--
-- Written as (select …) so Postgres works the answer out once per query rather
-- than once per row: route history alone is tens of thousands of rows.
-- ---------------------------------------------------------------------------

alter policy attendance_staff_read on attendance
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));
alter policy attendance_staff_write on attendance
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())))
  with check ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));

alter policy device_tokens_staff_read on device_tokens
  using ((select is_staff()) or profile_id in (select unnest(overseen_people())));
alter policy guard_devices_staff on guard_devices
  using ((select is_staff()) or profile_id in (select unnest(overseen_people())))
  with check ((select is_staff()) or profile_id in (select unnest(overseen_people())));

alter policy history_staff_read on guard_location_history
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));
alter policy positions_staff_read on guard_positions
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));

alter policy handover_staff on handover_notes
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())))
  with check ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));

alter policy profiles_staff_read on profiles
  using ((select is_staff()) or id in (select unnest(overseen_people())));

alter policy rr_staff on replacement_requests
  using ((select is_staff()) or oversees_shift(shift_id))
  with check ((select is_staff()) or oversees_shift(shift_id));

alter policy shifts_staff_read on shifts
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));
alter policy shifts_staff_write on shifts
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())))
  with check ((select is_staff()) or site_id in (select unnest(supervised_site_ids())));

-- A supervisor arranges the posts at their site, but not their own: taking
-- themselves off it would take the site away from them.
alter policy site_postings_staff on site_postings
  using ((select is_staff()) or (site_id in (select unnest(supervised_site_ids())) and guard_id <> (select auth.uid())))
  with check ((select is_staff()) or (site_id in (select unnest(supervised_site_ids())) and guard_id <> (select auth.uid())));

alter policy sites_worker_read on sites
  using ((select is_staff()) or id in (select unnest(supervised_site_ids()))
         or (my_role() = 'guard'::user_role and guard_may_see_site(id)));

alter policy sos_read on sos_alerts
  using ((select is_staff()) or site_id in (select unnest(supervised_site_ids())) or raised_by = auth.uid()
         or exists (select 1 from sos_notifications n where n.alert_id = sos_alerts.id and n.profile_id = auth.uid()));

alter policy sos_notifications_read on sos_notifications
  using ((select is_staff()) or profile_id = auth.uid() or oversees_alert(alert_id));

alter policy sos_ack_read on sos_acknowledgements
  using ((select is_staff()) or profile_id = auth.uid() or oversees_alert(alert_id)
         or exists (select 1 from sos_notifications n where n.alert_id = sos_acknowledgements.alert_id and n.profile_id = auth.uid())
         or exists (select 1 from sos_alerts a where a.id = sos_acknowledgements.alert_id and a.raised_by = auth.uid()));

-- The live-map channel carries every site's positions, so it stays the office's
-- (is_staff). A supervisor's map listens on its own site's channel instead, which
-- may_read_site_channel now opens to them (below).

-- ---------------------------------------------------------------------------
-- Functions: the same checks, and site-scoped audiences.
-- ---------------------------------------------------------------------------

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
  if v_me is null or not (is_staff() or my_role() = 'supervisor'::user_role) then
    raise exception 'Only a field officer or a supervisor assigns a replacement.' using errcode = '42501';
  end if;

  select * into v_guard from profiles where id = p_guard;
  if not found or v_guard.role <> 'guard' or not v_guard.active then
    raise exception 'Choose an active guard as the replacement.' using errcode = '22023';
  end if;
  -- A supervisor hands a shift to someone who works their site, as the field officer would.
  if not oversees_person(p_guard) then
    raise exception '% does not work at your site.', v_guard.full_name using errcode = '42501';
  end if;

  for v_old in
    select * from shifts where id = any (p_shift_ids) order by starts_at for update
  loop
    if not oversees_site(v_old.site_id) then
      raise exception 'That shift is not at your site.' using errcode = '42501';
    end if;
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

CREATE OR REPLACE FUNCTION public.check_silent_guards()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row       record;
  v_woken     integer := 0;
  v_escalated integer := 0;
  v_duty      jsonb;
begin
  for v_row in
    select a.id, a.guard_id, a.site_id, a.check_in_at, a.silent_alerted_at, a.silent_staff_alerted_at,
           p.full_name, p.employee_code, p.phone, s.name as site_name, s.is_test,
           greatest(a.check_in_at, gp.received_at, gp.recorded_at) as heard
    from attendance a
    join profiles p on p.id = a.guard_id
    join sites s on s.id = a.site_id
    left join guard_positions gp on gp.guard_id = a.guard_id
    where a.check_out_at is null
      and greatest(a.check_in_at, gp.received_at, gp.recorded_at) < now() - interval '5 minutes'
  loop
    -- Pushes and emails about this guard stay on their side (test or live).
    perform set_config('nbss.scope', v_row.is_test::text, true);
    -- Wake the phone while it stays quiet: every 4 minutes on the 2-minute cron.
    if v_row.silent_alerted_at is null or v_row.silent_alerted_at < v_row.heard
       or v_row.silent_alerted_at < now() - interval '3 minutes 50 seconds' then
      perform wake_phone(v_row.id, v_row.guard_id, v_row.site_name, false);
      update attendance set silent_alerted_at = now() where id = v_row.id;
      v_woken := v_woken + 1;
    end if;

    -- Tell the office and the site's supervisor once per silence, after 20 minutes.
    if v_row.heard < now() - interval '20 minutes'
       and (v_row.silent_staff_alerted_at is null or v_row.silent_staff_alerted_at < v_row.heard) then
      perform enqueue_push(office_ids(v_row.site_id),
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

  perform set_config('nbss.scope', '', true);
  v_duty := duty_reminders();
  return jsonb_build_object('woken', v_woken, 'escalated', v_escalated, 'duty', v_duty);
end;
$function$;

CREATE OR REPLACE FUNCTION public.close_sos(p_alert_id uuid, p_status sos_status DEFAULT 'resolved'::sos_status, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_alert.raised_by <> v_me and not oversees_site(v_alert.site_id) then
    raise exception 'Only the guard who raised this alert, the site''s supervisor or a field officer may close it.'
      using errcode = '42501';
  end if;

  update sos_alerts
  set status = p_status, closed_at = now(), closed_by = v_me, closing_note = p_note
  where id = p_alert_id
  returning * into v_alert;

  -- Queued but not yet sent: dropped, because a phone that has been off should not
  -- light up about an emergency that ended an hour ago. Already dispatched: left
  -- alone, because it was.
  update push_outbox
  set failed_at = now(), error = 'alert closed before delivery'
  where alert_id = p_alert_id
    and sent_at is null and failed_at is null and request_id is null;

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
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_staff_email(p_template text, p_subject text, p_data jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p record; v_n integer := 0;
begin
  if p_template = 'silent' then
    return 0;
  end if;
  if acting_as_test() then
    return 0;
  end if;
  for v_p in
    select full_name, email from profiles
    where active and role in ('developer', 'admin', 'field_officer') and email is not null
  loop
    perform enqueue_email(v_p.email, v_p.full_name, p_template, p_subject, p_data);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_trail(p_attendance_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_att    attendance%rowtype;
  v_points jsonb;
begin
  select * into v_att from attendance where id = p_attendance_id;
  if not found then return null; end if;
  if not (oversees_site(v_att.site_id) or v_att.guard_id = auth.uid()) then
    raise exception 'Not yours to see.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
           round(h.lat::numeric, 6), round(h.lng::numeric, 6),
           extract(epoch from h.recorded_at)::bigint,
           round(h.accuracy_m::numeric), h.inside_fence, h.battery,
           round(coalesce(h.speed_mps, 0)::numeric, 1), h.ping_reason
         ) order by h.recorded_at), '[]'::jsonb)
  into v_points
  from guard_location_history h
  where h.attendance_id = p_attendance_id;

  return jsonb_build_object(
    'attendance_id', v_att.id,
    'guard_id', v_att.guard_id,
    'site_id', v_att.site_id,
    'check_in_at', v_att.check_in_at,
    'check_out_at', v_att.check_out_at,
    -- [lat, lng, epoch seconds, accuracy m, inside fence, battery %, speed m/s, reason]
    'points', v_points
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.may_read_site_channel(p_topic text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if oversees_site(v_site) then return true; end if;

  return exists (
    select 1 from attendance
    where guard_id = auth.uid() and site_id = v_site and check_out_at is null
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_handset(p_device_id text, p_platform text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_model text DEFAULT NULL::text, p_os_version text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_device_name text DEFAULT NULL::text, p_battery smallint DEFAULT NULL::smallint, p_charging boolean DEFAULT NULL::boolean, p_location_permission text DEFAULT NULL::text, p_gps_enabled boolean DEFAULT NULL::boolean, p_battery_optimized boolean DEFAULT NULL::boolean, p_notifications boolean DEFAULT NULL::boolean, p_precise_location boolean DEFAULT NULL::boolean, p_autostart text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        office_ids_for(v_me),
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
    office_ids(v_shift.site_id),
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

CREATE OR REPLACE FUNCTION public.send_location_pin(p_lat double precision, p_lng double precision, p_accuracy_m real, p_age_s integer, p_note text DEFAULT NULL::text, p_mocked boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_id   uuid;
begin
  select role into v_role from profiles where id = auth.uid() and active;
  if v_role is null or v_role not in ('guard', 'supervisor', 'field_officer', 'admin', 'developer') then
    raise exception 'Only staff can send a location.' using errcode = '42501';
  end if;
  if coalesce(p_mocked, false) then
    raise exception 'This phone reports a fake location. Turn off any mock-location app and try again.';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'The phone sent no usable location.';
  end if;
  if p_accuracy_m is null or p_accuracy_m > 100 then
    raise exception 'GPS is not precise enough yet (±% m). Step into the open and try again.', round(coalesce(p_accuracy_m, 0));
  end if;
  if p_age_s is null or p_age_s < 0 or p_age_s > 120 then
    raise exception 'That location is out of date. Try again.';
  end if;
  if (select count(*) from location_pins where sent_by = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Twenty locations sent in the last hour is the limit. Try again later.';
  end if;

  insert into location_pins (sent_by, lat, lng, accuracy_m, note, captured_at, is_test)
  values (auth.uid(), p_lat, p_lng, p_accuracy_m, nullif(left(btrim(p_note), 200), ''),
          now() - make_interval(secs => p_age_s), acting_as_test())
  returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sos_allowed(p_profile uuid, p_site uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select sos_enabled from profiles where id = p_profile), false)
     and (
       (select role in ('developer', 'admin', 'field_officer', 'supervisor') from profiles where id = p_profile)
       or not exists (
         select 1 from sites s
         where not s.sos_enabled
           and s.id in (
             -- the alert's own site, the site they are checked in at, else where they are posted
             select p_site where p_site is not null
             union all
             select a.site_id from attendance a where a.guard_id = p_profile and a.check_out_at is null
             union all
             select sp.site_id from site_postings sp
             where sp.guard_id = p_profile and sp.active and sp.dates is null
               and not exists (select 1 from attendance a where a.guard_id = p_profile and a.check_out_at is null)
           )
       )
     )
$function$;

CREATE OR REPLACE FUNCTION public.sos_map(p_alert_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alert sos_alerts%rowtype;
  v_site  sites%rowtype;
  v_me    uuid := auth.uid();
begin
  select * into v_alert from sos_alerts where id = p_alert_id;
  if not found then return null; end if;
  if not (
    oversees_site(v_alert.site_id)
    or v_alert.raised_by = v_me
    or exists (select 1 from sos_notifications n where n.alert_id = p_alert_id and n.profile_id = v_me)
    or exists (select 1 from sos_acknowledgements a where a.alert_id = p_alert_id and a.profile_id = v_me)
  ) then
    return null;
  end if;
  select * into v_site from sites where id = v_alert.site_id;

  return jsonb_build_object(
    'alert', jsonb_build_object(
      'id', v_alert.id, 'status', v_alert.status, 'kind', v_alert.kind, 'note', v_alert.note,
      'lat', v_alert.lat, 'lng', v_alert.lng, 'raised_at', v_alert.raised_at,
      'raised_by', v_alert.raised_by, 'closed_at', v_alert.closed_at, 'closing_note', v_alert.closing_note
    ),
    'site', jsonb_build_object(
      'id', v_site.id, 'name', v_site.name, 'lat', v_site.lat, 'lng', v_site.lng,
      'radius_m', v_site.geofence_radius_m, 'polygon', v_site.polygon
    ),
    'people', coalesce((
      select jsonb_agg(row order by row ->> 'sort', row ->> 'name')
      from (
        select jsonb_build_object(
          'id', p.id,
          'name', p.full_name,
          'phone', p.phone,
          'role', case when p.id = v_alert.raised_by then 'raiser'
                       when ack.profile_id is not null then 'responder'
                       when p.role = 'guard' then 'guard' else 'staff' end,
          'sort', case when p.id = v_alert.raised_by then 0 when ack.response = 'on_scene' then 1
                       when ack.response = 'responding' then 2 when ack.response is not null then 3 else 4 end,
          'response', ack.response,
          'answered_at', ack.at,
          -- Where they are now if the phone is reporting, else where they answered from.
          'lat', coalesce(gp.lat, ack.lat, case when p.id = v_alert.raised_by then v_alert.lat end),
          'lng', coalesce(gp.lng, ack.lng, case when p.id = v_alert.raised_by then v_alert.lng end),
          'heard_at', coalesce(gp.received_at, gp.recorded_at, ack.at),
          'distance_m', case
            when v_alert.lat is null then null
            when gp.lat is not null then round(geo_distance_m(v_alert.lat, v_alert.lng, gp.lat, gp.lng)::numeric)
            when ack.distance_m is not null then round(ack.distance_m::numeric)
          end
        ) as row
        from profiles p
        left join sos_acknowledgements ack on ack.alert_id = p_alert_id and ack.profile_id = p.id
        left join guard_positions gp on gp.guard_id = p.id
        where p.id = v_alert.raised_by
           or ack.profile_id is not null
           -- Everyone on duty at the site right now.
           or exists (select 1 from attendance a where a.guard_id = p.id and a.site_id = v_alert.site_id and a.check_out_at is null)
      ) x
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.sos_people(p_alert_id uuid)
 RETURNS TABLE(kind text, profile_id uuid, full_name text, phone text, response sos_response, distance_m double precision, at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with allowed as (
    select 1
    from sos_alerts s
    where s.id = p_alert_id
      and (
        oversees_site(s.site_id)
        or s.raised_by = auth.uid()
        or exists (select 1 from sos_notifications n where n.alert_id = s.id and n.profile_id = auth.uid())
        or exists (select 1 from sos_acknowledgements a where a.alert_id = s.id and a.profile_id = auth.uid())
      )
  )
  select 'raiser', p.id, p.full_name, p.phone, null::sos_response, null::double precision, s.raised_at
  from sos_alerts s
  join profiles p on p.id = s.raised_by
  where s.id = p_alert_id and exists (select 1 from allowed)
  union all
  select 'responder', p.id, p.full_name, p.phone, a.response, a.distance_m, a.at
  from sos_acknowledgements a
  join profiles p on p.id = a.profile_id
  where a.alert_id = p_alert_id and exists (select 1 from allowed)
  order by 1, 7;
$function$;

CREATE OR REPLACE FUNCTION public.sos_recipients(p_alert_id uuid)
 RETURNS TABLE(profile_id uuid, audience sos_audience)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with alert as (
    select a.*, coalesce(a.lat, s.lat) as at_lat, coalesce(a.lng, s.lng) as at_lng, s.district
    from sos_alerts a join sites s on s.id = a.site_id
    where a.id = p_alert_id
  ),
  -- Each guard's districts: where they are posted, rostered today, or checked in now.
  guard_districts as (
    select sp.guard_id, s.district from site_postings sp join sites s on s.id = sp.site_id
    where sp.active and s.active
    union
    select sh.guard_id, s.district from shifts sh join sites s on s.id = sh.site_id
    where sh.status in ('scheduled', 'in_progress')
      and sh.starts_at < now() + interval '18 hours' and sh.ends_at > now() - interval '6 hours'
    union
    select at.guard_id, s.district from attendance at join sites s on s.id = at.site_id
    where at.check_out_at is null
  )
  -- Everyone checked in at the same site.
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a, alert
  where a.site_id = alert.site_id
    and a.check_out_at is null
    and a.guard_id <> alert.raised_by

  union

  -- Every active guard of the district, on duty or not.
  select p.id, 'on_duty_guard'::sos_audience
  from profiles p
  join guard_districts gd on gd.guard_id = p.id
  cross join alert
  where p.active and p.role = 'guard'
    and p.id <> alert.raised_by
    and alert.district is not null and gd.district is not null
    and lower(trim(gd.district)) = lower(trim(alert.district))

  union

  -- On duty nearby: within 5 km, whatever the district says.
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a
  join sites s on s.id = a.site_id
  left join guard_positions gp on gp.guard_id = a.guard_id
    and coalesce(gp.received_at, gp.recorded_at) > now() - interval '20 minutes'
  cross join alert
  where a.check_out_at is null
    and a.guard_id <> alert.raised_by
    and a.site_id <> alert.site_id
    and s.active
    and geo_distance_m(alert.at_lat, alert.at_lng, coalesce(gp.lat, s.lat), coalesce(gp.lng, s.lng)) <= 5000

  union

  -- The office, and the supervisor of the site where it was raised.
  select p.id, 'staff'::sos_audience
  from profiles p, alert
  where p.active and p.id = any (office_ids(alert.site_id))
    and p.id <> alert.raised_by

  union

  -- The client: only once their site is actually deployed (a guard posted there, or
  -- someone checked in), so a site still being set up never alarms the customer.
  select s.client_id, 'client'::sos_audience
  from sites s, alert
  where s.id = alert.site_id
    and s.client_id is not null
    and s.notify_client_on_sos
    and s.active
    and (exists (select 1 from site_postings sp where sp.site_id = s.id and sp.active)
         or exists (select 1 from attendance at where at.site_id = s.id and at.check_out_at is null))
$function$;

CREATE OR REPLACE FUNCTION public.wake_guard(p_guard uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_open record;
  v_n integer;
begin
  if not (is_staff() or my_role() = 'supervisor'::user_role) then
    raise exception 'Only the office or a supervisor can wake a phone.';
  end if;
  select a.id, a.site_id, s.name as site_name into v_open
  from attendance a join sites s on s.id = a.site_id
  where a.guard_id = p_guard and a.check_out_at is null
  order by a.check_in_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_on_duty');
  end if;
  if not oversees_site(v_open.site_id) then
    raise exception 'That guard is on duty at another site.';
  end if;
  v_n := wake_phone(v_open.id, p_guard, v_open.site_name, true);
  update attendance set silent_alerted_at = now() where id = v_open.id;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), 'wake_phone', 'profiles', p_guard::text, jsonb_build_object('attendance_id', v_open.id, 'devices', v_n));
  return jsonb_build_object('ok', true, 'devices', v_n);
end;
$function$;
