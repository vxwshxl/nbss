-- Housekeeping: people who work a site exactly as a guard does — posted, rostered,
-- checked in by the fence, tracked while on duty, in the SOS fan-out — but who keep
-- the premises rather than guard them.
--
-- A trade on the guard role rather than a fifth role. Thirteen functions and a policy
-- decide things by `role = 'guard'` (the punch, positions, the roster, replacements,
-- SOS recipients, the watchdog, the fee), and a housekeeper must pass every one of
-- them; a separate role would have to be added to each, and to each new one after.
-- The website and the app show the trade as its own role: "Housekeeper".

alter table profiles
  add column trade text not null default 'security'
    check (trade in ('security', 'housekeeping'));

-- Only a guard-role account carries a trade other than security.
alter table profiles
  add constraint profiles_trade_guard_only check (trade = 'security' or role = 'guard');

-- A person cannot move themselves between trades, as they cannot change their code.
create or replace function guard_identity_columns() returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and not is_admin() then
    if new.email is distinct from old.email
       or new.employee_code is distinct from old.employee_code
       or new.trade is distinct from old.trade then
      raise exception 'Only an administrator can change an email address, employee code or trade.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
