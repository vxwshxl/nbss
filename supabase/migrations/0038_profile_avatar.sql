-- The Google account's photo on the profile.
--
-- Whenever someone signs in with Google (or links it), Supabase writes the photo URL
-- into the user's metadata. A trigger copies it onto their profile at once, so the
-- console's menus and lists, and the app's Me tab, all show the same face without any
-- page fetching it. A photo a person set some other way is never overwritten by none.

alter table profiles add column if not exists avatar_url text;

create or replace function copy_auth_avatar() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_url text;
begin
  v_url := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  if v_url is not null and v_url like 'https://%' then
    update profiles set avatar_url = v_url where id = new.id and avatar_url is distinct from v_url;
  end if;
  return new;
end;
$$;

drop trigger if exists auth_users_avatar on auth.users;
create trigger auth_users_avatar after insert or update of raw_user_meta_data on auth.users
  for each row execute function copy_auth_avatar();

-- And for anyone who has already signed in with Google.
update profiles p
set avatar_url = coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
where u.id = p.id and p.avatar_url is null
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') like 'https://%';

