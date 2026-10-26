-- Every account's employee code is NBSS-n: no leading zeros (0047), and no prefixes
-- by kind. Clients who registered or signed in with Google were given CL-001029
-- (next_client_code, 0007) and the developer DEV-001 (scripts/ensure-developer.mjs);
-- they now take the next NBSS numbers, oldest account first.
--
-- Nobody's login changes: every one of these accounts signs in with its own email
-- address, not with an address made from its code. audit_log keeps the codes as they
-- were when each entry was written.

do $$
declare
  p record;
begin
  for p in
    select id from profiles
    where employee_code ~ '^(CL|DEV)-'
    order by created_at, employee_code
  loop
    update profiles set employee_code = next_employee_code() where id = p.id;
  end loop;
end $$;

-- Registration and Google sign-in still call next_client_code(); it now hands out the
-- same NBSS-n as the office does.
create or replace function next_client_code() returns text
language sql volatile security definer set search_path = public
as $$ select next_employee_code() $$;
