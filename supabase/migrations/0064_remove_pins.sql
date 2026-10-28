-- ===========================================================================
-- The PIN is gone.
--
-- Workers sign in with their name and mobile (0063), staff adding an emailed
-- code, clients with Google. So:
--   * the office's copy of each PIN (0044) is deleted;
--   * every account's old PIN password is replaced with a random one nobody
--     knows, so a PIN no longer opens anything, even straight against the auth
--     server. The TEST-, LOAD- and E2F- accounts keep theirs: the test scripts
--     sign in with them.
-- ===========================================================================

drop table if exists staff_pins;

update auth.users u
set encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf'))
from profiles p
where p.id = u.id
  and u.encrypted_password is not null
  and u.encrypted_password <> ''
  and p.employee_code not like 'TEST-%'
  and p.employee_code not like 'LOAD-%'
  and p.employee_code not like 'E2F-%';

update profiles set must_change_pin = false where must_change_pin;
