-- ===========================================================================
-- A guard can now hold several postings (one weekly, any number dated), so
-- ending or deleting one must not leave the others without their shifts: clear
-- the guard's future posted shifts and write them again from whatever is still
-- active, every time.
-- ===========================================================================

create or replace function roster_on_posting_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_guard uuid := coalesce(new.guard_id, old.guard_id);
begin
  delete from shifts
  where guard_id = v_guard
    and posting_id is not null
    and status = 'scheduled'
    and starts_at > now();
  perform roster_fill_guard(v_guard);
  if tg_op = 'UPDATE' and old.guard_id <> new.guard_id then
    delete from shifts
    where guard_id = old.guard_id and posting_id is not null and status = 'scheduled' and starts_at > now();
    perform roster_fill_guard(old.guard_id);
  end if;
  return null;
end;
$$;
