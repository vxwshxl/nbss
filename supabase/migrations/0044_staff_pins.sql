-- A guard's 4-digit PIN, readable by the office.
--
-- The office creates the account and tells the guard their employee code and PIN, so
-- admins and supervisors need to see it again later (in the person's popup). Auth only
-- keeps a hash, so the PIN is also kept here, readable by staff alone and never by the
-- person's colleagues. Set and changed only by the console's server actions.

create table if not exists staff_pins (
  profile_id uuid primary key references profiles (id) on delete cascade,
  pin        text not null check (pin ~ '^\d{4,12}$'),
  set_at     timestamptz not null default now(),
  set_by     uuid references profiles (id) on delete set null
);
alter table staff_pins enable row level security;
drop policy if exists staff_pins_read on staff_pins;
create policy staff_pins_read on staff_pins for select to authenticated using (is_staff());

-- The next free NBSS-### number.
create or replace function next_employee_code() returns text
language sql stable security definer set search_path = public
as $$
  select 'NBSS-' || lpad((coalesce(max(substring(employee_code from '^NBSS-(\d+)$')::int), 0) + 1)::text, 3, '0')
  from profiles where employee_code ~ '^NBSS-\d+$'
$$;
grant execute on function next_employee_code() to authenticated;
