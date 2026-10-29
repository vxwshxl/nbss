-- ===========================================================================
-- Test accounts do not email the office.
--
-- A test guard (Test mode, or the load-test LOAD-* accounts) signing in on another
-- test guard's phone sent every admin and supervisor a real "New phone for…" email.
-- The staff alerts that a person sets off (a new or shared phone, an SOS, a cover
-- request, a booking) run as that person, so they are skipped here when that person
-- is a test account. The silent-guard watchdog runs from cron and already leaves test
-- guards out.
-- ===========================================================================

create or replace function enqueue_staff_email(p_template text, p_subject text, p_data jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_p record; v_n integer := 0;
begin
  if p_template = 'silent' then
    return 0;
  end if;
  if exists (select 1 from profiles where id = auth.uid() and is_test) then
    return 0;
  end if;
  for v_p in
    select full_name, email from profiles
    where active and role in ('developer', 'admin', 'supervisor') and email is not null
  loop
    perform enqueue_email(v_p.email, v_p.full_name, p_template, p_subject, p_data);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
