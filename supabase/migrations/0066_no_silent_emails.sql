-- ===========================================================================
-- No email when a guard's phone goes quiet.
--
-- The office was mailed "No signal from …" every time a phone stopped
-- reporting (0023), and it filled their inbox. The watchdog still wakes the
-- phone, still pushes the guard and the supervisors, and Live tracking still
-- shows the guard as No signal; only the email is gone. SOS and every other
-- staff email are sent as before.
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
