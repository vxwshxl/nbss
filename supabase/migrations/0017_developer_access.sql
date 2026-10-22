-- ===========================================================================
-- What a developer may do: everything an administrator may, plus granting and
-- removing the developer role itself.
--
-- Every policy already asks is_staff() or is_admin(), so widening those two is
-- what gives a developer the whole console. The one place that names roles
-- directly is the SOS audience.
-- ===========================================================================

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() in ('developer', 'admin', 'supervisor'), false) $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() in ('developer', 'admin'), false) $$;

create or replace function is_developer() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() = 'developer', false) $$;

create or replace function sos_recipients(p_alert_id uuid)
returns table (profile_id uuid, audience sos_audience)
language sql stable security definer set search_path = public
as $$
  with alert as (select * from sos_alerts where id = p_alert_id)
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a, alert
  where a.site_id = alert.site_id
    and a.check_out_at is null
    and a.guard_id <> alert.raised_by

  union

  select p.id, 'staff'::sos_audience
  from profiles p
  where p.active and p.role in ('developer', 'admin', 'supervisor')

  union

  select s.client_id, 'client'::sos_audience
  from sites s, alert
  where s.id = alert.site_id
    and s.client_id is not null
    and s.notify_client_on_sos
$$;

-- Only a developer makes or unmakes a developer. Writes through the service
-- role (the console's server actions) are checked again in TypeScript; this
-- covers anything that reaches the table as a signed-in user.
create or replace function guard_developer_role() returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and not is_developer() then
    if (new.role = 'developer') is distinct from (old.role = 'developer') then
      raise exception 'Only a developer can grant or remove the developer role.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_developer on profiles;
create trigger profiles_guard_developer
  before update of role on profiles
  for each row execute function guard_developer_role();
