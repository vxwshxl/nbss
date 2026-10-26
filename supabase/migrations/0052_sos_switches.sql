-- SOS can be switched off for a person (set when the account is made, changed on their
-- page) and for a site. Off means that person, or anyone working that site, has no SOS
-- button and the database refuses one from them. Staff are held only by their own
-- switch: the office can always raise an alarm, wherever the nearest site is.
--
-- Enforced on the insert rather than inside raise_sos, so every way an alert can be
-- created obeys it, and the phone asks the same rule whether to show the button.

alter table profiles add column sos_enabled boolean not null default true;
alter table sites add column sos_enabled boolean not null default true;

-- May this person raise an SOS (against this site, when one is known)?
create or replace function sos_allowed(p_profile uuid, p_site uuid default null) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select sos_enabled from profiles where id = p_profile), false)
     and (
       (select role in ('developer', 'admin', 'supervisor') from profiles where id = p_profile)
       or not exists (
         select 1 from sites s
         where not s.sos_enabled
           and s.id in (
             -- the alert's own site, the site they are checked in at, else where they are posted
             select p_site where p_site is not null
             union all
             select a.site_id from attendance a where a.guard_id = p_profile and a.check_out_at is null
             union all
             select sp.site_id from site_postings sp
             where sp.guard_id = p_profile and sp.active and sp.dates is null
               and not exists (select 1 from attendance a where a.guard_id = p_profile and a.check_out_at is null)
           )
       )
     )
$$;

-- For the phone: whether to show the SOS button to the person signed in.
create or replace function my_sos_allowed() returns boolean
language sql stable security definer set search_path = public
as $$ select sos_allowed(auth.uid()) $$;
grant execute on function my_sos_allowed() to authenticated;
revoke all on function sos_allowed(uuid, uuid) from public, anon, authenticated;

create or replace function refuse_switched_off_sos() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not sos_allowed(new.raised_by, new.site_id) then
    raise exception 'SOS is switched off for you or for this site. Call the office.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sos_alerts_switched_off
  before insert on sos_alerts
  for each row execute function refuse_switched_off_sos();

-- Only an administrator changes someone's SOS switch, as with their code and trade.
create or replace function guard_identity_columns() returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and not is_admin() then
    if new.email is distinct from old.email
       or new.employee_code is distinct from old.employee_code
       or new.trade is distinct from old.trade
       or new.sos_enabled is distinct from old.sos_enabled then
      raise exception 'Only an administrator can change an email address, employee code, trade or SOS switch.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
