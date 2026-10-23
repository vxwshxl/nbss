-- ===========================================================================
-- Sign in with Google.
--
-- Someone already on the books (staff or client, with a real address) keeps
-- their account: GoTrue links the Google identity to the existing auth user by
-- its verified email, so no new row reaches auth.users and this trigger never
-- runs for them.
--
-- A Google address nobody holds yet is the old "first code makes a client
-- account" door, so it becomes a client too. Google's metadata carries no
-- `signup` flag, so the provider is read from raw_app_meta_data instead, which
-- only GoTrue writes. The role is still hardcoded to 'client': nothing the
-- browser sends can mint staff.
--
-- An address some profile already holds under a different auth user is left
-- alone rather than tripping the unique email and failing the whole sign-up;
-- the callback then finds no profile and refuses it like any other stranger.
-- ===========================================================================

create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'signup', '') <> 'client'
     and coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
    return new;
  end if;

  if exists (select 1 from profiles where email = lower(new.email)) then
    return new;
  end if;

  insert into profiles (id, employee_code, role, full_name, phone, email)
  values (
    new.id,
    next_client_code(),
    'client',
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    lower(new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
