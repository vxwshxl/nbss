-- ===========================================================================
-- A developer acts on the side the console is on.
--
-- 0069 and 0070 keep test accounts from emailing the office and from buzzing real
-- phones, by asking whether the person acting has is_test set. A developer's is_test
-- means nothing (they switch Test / Live in the header, data_test_view()), but it was
-- left true, so on Live every push a developer set off to a real guard was dropped:
-- Wake up phone said "no notifications registered" for every guard, and the guard
-- got nothing. Now a developer counts as test only while the console is on Test.
-- ===========================================================================

create or replace function acting_as_test() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case when p.role = 'developer' then data_test_view() else p.is_test end
    from profiles p where p.id = auth.uid()
  ), false)
$$;

create or replace function push_outbox_keep_test_apart() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_test boolean;
begin
  v_test := acting_as_test();
  if not v_test and new.data is not null then
    v_test := exists (
      select 1 from profiles
      where is_test
        and id::text in (new.data ->> 'raised_by', new.data ->> 'guard_id')
    );
  end if;
  if v_test and not exists (select 1 from profiles where id = new.profile_id and (is_test or role = 'developer')) then
    return null;
  end if;
  return new;
end;
$$;

create or replace function enqueue_staff_email(p_template text, p_subject text, p_data jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
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
    where active and role in ('developer', 'admin', 'supervisor') and email is not null
  loop
    perform enqueue_email(v_p.email, v_p.full_name, p_template, p_subject, p_data);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
