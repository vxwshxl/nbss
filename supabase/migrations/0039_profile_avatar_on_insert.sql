-- A profile made after the Google sign-in picks the photo up as it is created.
create or replace function profile_avatar_from_auth() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.avatar_url is null then
    select coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') into new.avatar_url
    from auth.users u where u.id = new.id;
    if new.avatar_url not like 'https://%' then new.avatar_url := null; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_avatar_from_auth on profiles;
create trigger profiles_avatar_from_auth before insert on profiles for each row execute function profile_avatar_from_auth();
