-- ===========================================================================
-- Sign-in by name and mobile number.
--
-- A worker signs in with their name and their 10-digit mobile. The name is
-- compared without regard to case, with spaces before and after dropped and a
-- run of spaces counted as one; a space between words still matters. The mobile
-- is the last ten digits of the stored number, so "+977…" and 10-digit Indian
-- numbers both match what was typed.
--
-- Two people may share a number (a family phone); the name decides which of them
-- it is. Clients are not found here: they sign in with Google.
--
-- Only the server calls this, with the secret key.
-- ===========================================================================

create or replace function worker_for_sign_in(p_name text, p_mobile text)
returns table (id uuid, role user_role, email text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.role, u.email::text
  from profiles p
  join auth.users u on u.id = p.id
  where p.active
    and p.role <> 'client'
    and lower(regexp_replace(regexp_replace(p.full_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
      = lower(regexp_replace(regexp_replace(p_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
    and length(p_mobile) = 10
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = p_mobile
$$;

revoke all on function worker_for_sign_in(text, text) from public, anon, authenticated;
grant execute on function worker_for_sign_in(text, text) to service_role;
