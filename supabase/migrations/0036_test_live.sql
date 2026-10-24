-- Test / Live, as a payment dashboard has it.
--
-- Every person and site is either test or live (is_test). What anyone sees is decided
-- here, in row level security, so every page, the app, realtime and "View as" follow
-- it without each query remembering to:
--
--   a developer   chooses with the console's Test / Live switch (sent as the
--                 x-nbss-mode request header); developers themselves appear in both;
--   everyone else sees the side their own account is on. Test guards see test sites,
--                 test admins test guards; real accounts see only real data.
--
-- Everything that exists today becomes test. New accounts and sites are live, unless
-- a developer creates them while in Test.
--
-- Notifications follow the same line: a push or email about test data reaches
-- developers and test staff only, never a live admin.

alter table profiles    add column if not exists is_test boolean not null default false;
alter table sites       add column if not exists is_test boolean not null default false;
alter table submissions add column if not exists is_test boolean not null default false;

update profiles    set is_test = true;
update sites       set is_test = true;
update submissions set is_test = true;

create index if not exists profiles_is_test on profiles (is_test);
create index if not exists sites_is_test on sites (is_test);

-- The side the signed-in person is looking at.
create or replace function data_test_view() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case
      when p.role = 'developer'
        then coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-nbss-mode', 'live') = 'test'
      else p.is_test
    end
    from profiles p where p.id = auth.uid()
  ), false)
$$;

create or replace function site_is_test(p_site uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select is_test from sites where id = p_site $$;

create or replace function profile_is_test(p_profile uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select is_test from profiles where id = p_profile $$;

grant execute on function data_test_view() to authenticated, anon;
grant execute on function site_is_test(uuid) to authenticated;
grant execute on function profile_is_test(uuid) to authenticated;

-- Restrictive: on top of every existing read policy, never instead of one.
do $$
declare t record;
begin
  for t in select * from (values
    ('profiles',               'role = ''developer'' or id = auth.uid() or is_test = (select data_test_view())'),
    ('sites',                  'is_test = (select data_test_view())'),
    ('shifts',                 'site_is_test(site_id) = (select data_test_view())'),
    ('attendance',             'site_is_test(site_id) = (select data_test_view())'),
    ('site_postings',          'site_is_test(site_id) = (select data_test_view())'),
    ('handover_notes',         'site_is_test(site_id) = (select data_test_view())'),
    ('sos_alerts',             'site_is_test(site_id) = (select data_test_view())'),
    ('guard_positions',        'coalesce(site_is_test(site_id), profile_is_test(guard_id)) = (select data_test_view())'),
    ('guard_location_history', 'coalesce(site_is_test(site_id), profile_is_test(guard_id)) = (select data_test_view())'),
    ('replacement_requests',   'profile_is_test(guard_id) = (select data_test_view())'),
    ('guard_devices',          'profile_is_test(profile_id) = (select data_test_view())'),
    ('service_requests',       'coalesce(site_is_test(site_id), profile_is_test(client_id), false) = (select data_test_view())'),
    ('submissions',            'is_test = (select data_test_view())')
  ) as x(tbl, cond)
  loop
    execute format('drop policy if exists nbss_test_live on %I', t.tbl);
    execute format('create policy nbss_test_live on %I as restrictive for select to authenticated using (%s)', t.tbl, t.cond);
  end loop;
end $$;

-- A developer creating something while in Test makes it test.
create or replace function mark_test_when_developer_in_test() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select data_test_view()) and exists (select 1 from profiles where id = auth.uid() and role = 'developer') then
    new.is_test := true;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_mark_test on profiles;
create trigger profiles_mark_test before insert on profiles for each row execute function mark_test_when_developer_in_test();
drop trigger if exists sites_mark_test on sites;
create trigger sites_mark_test before insert on sites for each row execute function mark_test_when_developer_in_test();

-- ─── notifications follow the line ───────────────────────────────────────────
-- The side an event belongs to: set explicitly by the cron jobs (nbss.scope), or
-- the side of whoever caused it. Unknown (a public form) means no filtering.
create or replace function event_scope() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    nullif(current_setting('nbss.scope', true), '')::boolean,
    (select is_test from profiles where id = auth.uid() and role <> 'developer')
  )
$$;

create or replace function outbox_keep_scope() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_scope boolean := event_scope();
  v_who   record;
begin
  if v_scope is null then return new; end if;
  if tg_table_name = 'push_outbox' then
    select role, is_test into v_who from profiles where id = new.profile_id;
  else
    select role, is_test into v_who from profiles where lower(email) = lower(new.to_email) limit 1;
  end if;
  -- Developers see both sides; people who are not on file (a client's own email) are kept.
  if not found or v_who.role = 'developer' or v_who.is_test = v_scope then return new; end if;
  return null;
end;
$$;
drop trigger if exists push_outbox_scope on push_outbox;
create trigger push_outbox_scope before insert on push_outbox for each row execute function outbox_keep_scope();

drop trigger if exists email_outbox_scope on email_outbox;
create trigger email_outbox_scope before insert on email_outbox for each row execute function outbox_keep_scope();

-- The cron jobs set the side per guard they act on.
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
    select s.id, s.guard_id, s.starts_at, s.ends_at, st.name as site_name, st.is_test
    from shifts s join sites st on st.id = s.site_id and st.active
    where s.status = 'scheduled' and s.guard_id is not null and s.reminded_at is null
      and s.starts_at between now() and now() + interval '30 minutes'
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

  perform set_config('nbss.scope', '', true);
  v_duty := duty_reminders();
  return jsonb_build_object('woken', v_woken, 'escalated', v_escalated, 'duty', v_duty);
end;
$$;
