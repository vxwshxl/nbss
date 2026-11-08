-- ===========================================================================
-- One mobile number, one active account.
--
-- A worker signs in with their name and mobile. Until now two accounts could
-- share a number as long as their names differed, which left the office unsure
-- whose phone it was and let a typo on one account land on another person's
-- sign-in. Now no two active accounts hold the same mobile (compared on its
-- last ten digits, so +91 and spaces do not matter). Names may repeat.
--
-- Enforced here, under every path that writes a number (adding a person, the
-- office editing them, someone editing their own profile, reactivating an
-- account), rather than trusted to each of them. A deactivated account does not
-- hold its number, so a departed guard's number can be given to a new hire;
-- reactivating that old account is then refused until one of them changes.
--
-- Not a unique index: two accounts already share numbers (checked 2026-11-08),
-- and they stay as they are until one of them is edited.
-- ===========================================================================

create or replace function mobile_key(p text) returns text
language sql immutable set search_path = public
as $$ select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '') $$;

create index if not exists profiles_mobile_key_idx on profiles (mobile_key(phone)) where active;

create or replace function profiles_mobile_unique() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_other record;
begin
  if not new.active or mobile_key(new.phone) is null then return new; end if;
  -- Only a new number, or an account coming back, is checked: what is already
  -- there is left alone until someone changes it.
  if tg_op = 'UPDATE'
     and mobile_key(new.phone) is not distinct from mobile_key(old.phone)
     and old.active then
    return new;
  end if;

  select full_name, employee_code into v_other
  from profiles
  where active and id <> new.id and mobile_key(phone) = mobile_key(new.phone)
  limit 1;

  if found then
    raise exception 'The mobile number % already belongs to % (%). Each person needs their own number.',
      mobile_key(new.phone), v_other.full_name, v_other.employee_code
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_mobile_unique on profiles;
create trigger profiles_mobile_unique before insert or update of phone, active on profiles
  for each row execute function profiles_mobile_unique();
