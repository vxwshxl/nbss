-- Employee codes run NBSS-1, NBSS-2 … NBSS-12, with no leading zeros.
--
-- Existing NBSS-0xx codes lose their zeros (NBSS-011 → NBSS-11). Sign-in looks a code
-- up on profiles and then signs in with the account's own email, so nothing about a
-- login changes; and the sign-in still reads an old "NBSS-011" typed from a printed card
-- as NBSS-11 (expandEmployeeCode in packages/shared). audit_log keeps the codes as they
-- were when each entry was written.

update profiles
set employee_code = 'NBSS-' || (substring(employee_code from '^NBSS-(\d+)$')::int)::text
where employee_code ~ '^NBSS-0\d+$';

-- The next free number, unpadded.
create or replace function next_employee_code() returns text
language sql stable security definer set search_path = public
as $$
  select 'NBSS-' || (coalesce(max(substring(employee_code from '^NBSS-(\d+)$')::int), 0) + 1)::text
  from profiles where employee_code ~ '^NBSS-\d+$'
$$;
grant execute on function next_employee_code() to authenticated;
