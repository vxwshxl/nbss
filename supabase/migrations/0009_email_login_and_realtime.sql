-- ===========================================================================
-- Email sign-in, and the live change feed.
--
-- Sign-in moves from "employee code + PIN" to one universal door: an email
-- address (or the employee code, which resolves to it) and a six-digit code
-- that Supabase Auth mails through ZeptoMail (scripts/configure-auth.mjs). A
-- password or PIN still works for anyone who has one.
--
-- That needs every guard and client to have a real address, so the address is
-- now held on the profile as well as on the auth user — the console lists,
-- searches and previews people by it, and those reads go through RLS on
-- `profiles`, not through the admin API.
-- ===========================================================================

-- ------------------------------------------------------------ profile email
alter table profiles add column if not exists email text;

alter table profiles drop constraint if exists profiles_email_format;
alter table profiles add constraint profiles_email_format
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- The synthesized `…@staff.nbss.co.in` logins are an implementation detail and
-- never a person's address, so they are not copied across.
update profiles p
   set email = lower(u.email)
  from auth.users u
 where u.id = p.id
   and p.email is null
   and u.email is not null
   and u.email not ilike '%@staff.nbss.co.in';

create unique index if not exists profiles_email_key on profiles (lower(email)) where email is not null;

-- Keeps the profile in step when the login address changes, whoever changes it
-- (an admin through the API, or the person confirming a new address).
create or replace function sync_profile_email() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update profiles
     set email = case when new.email ilike '%@staff.nbss.co.in' then null else lower(new.email) end
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function sync_profile_email();

-- A person may edit their own profile row (name, phone, photo), but the columns
-- that identify them at sign-in are the office's to change. `current_user` is
-- 'authenticated' only for a request coming through the API as that person;
-- the security-definer sync above and the service role both pass untouched.
create or replace function guard_identity_columns() returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and not is_admin() then
    if new.email is distinct from old.email
       or new.employee_code is distinct from old.employee_code then
      raise exception 'Only an administrator can change an email address or employee code.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_identity on profiles;
create trigger profiles_guard_identity
  before update on profiles
  for each row execute function guard_identity_columns();

-- Self-registered clients arrive with an address; keep it on the profile too.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'signup', '') <> 'client' then
    return new;
  end if;

  insert into profiles (id, employee_code, role, full_name, phone, email)
  values (
    new.id,
    next_client_code(),
    'client',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    lower(new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- --------------------------------------------------------------- realtime
-- The console re-reads a page when a table it shows changes. Postgres changes
-- are filtered by each subscriber's RLS, so a guard's browser is told about
-- their own attendance rows and nobody else's.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'sites', 'shifts', 'attendance', 'submissions',
    'service_requests', 'sos_alerts'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------ housekeeping
-- The migration ledger lives in `public`, which the API exposes. With RLS on
-- and no policies it is invisible to every API key; the migration script
-- connects as the database owner and is unaffected.
alter table if exists schema_migrations enable row level security;
