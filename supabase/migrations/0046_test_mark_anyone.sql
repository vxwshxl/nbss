-- Anything created by someone on the Test side is test: a developer in Test, or a test
-- admin or supervisor (0036 covered developers only). Inserts made with the service key
-- have no caller, so the console sets is_test on those itself.
create or replace function mark_test_when_developer_in_test() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and (select data_test_view()) then
    new.is_test := true;
  end if;
  return new;
end;
$$;
