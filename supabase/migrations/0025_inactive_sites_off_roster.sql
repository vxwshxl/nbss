-- ===========================================================================
-- A site taken out of service leaves the roster.
--
-- Deactivating a site stopped check-ins there (punch_in refuses it) but the
-- guard's weekly posting kept writing shifts for it, so the app went on showing
-- it as "Your duty" and the guard found out only at the gate ("KGC is not in
-- service"). Now: deactivating withdraws the site's future scheduled shifts, the
-- roster never writes shifts for an inactive site, and reactivating fills them
-- back in from the postings.
-- ===========================================================================

create or replace function roster_fill_guard(p_guard uuid, p_days integer default 7)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_post  site_postings%rowtype;
  v_day   date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_start timestamptz;
  v_end   timestamptz;
  v_made  integer := 0;
begin
  for v_post in
    select sp.* from site_postings sp join sites s on s.id = sp.site_id
    where sp.guard_id = p_guard and sp.active and s.active
  loop
    for v_day in
      select d from (
        select unnest(v_post.dates) as d where v_post.dates is not null
        union all
        select g::date from generate_series(v_today - 1, v_today + p_days, interval '1 day') g
        where v_post.dates is null
      ) x
      where d >= v_today - 1
      order by d
    loop
      continue when v_post.dates is null
        and not (extract(isodow from v_day)::smallint = any (v_post.days));

      v_start := (v_day + v_post.starts) at time zone 'Asia/Kolkata';
      v_end   := (v_day + v_post.ends + case when v_post.ends <= v_post.starts then interval '1 day' else interval '0' end)
                 at time zone 'Asia/Kolkata';
      continue when v_end < now();

      if not exists (
        select 1 from shifts
        where guard_id = p_guard
          and tstzrange(starts_at, ends_at) && tstzrange(v_start, v_end)
          and (status <> 'cancelled' or posting_id = v_post.id)
      ) then
        insert into shifts (site_id, guard_id, starts_at, ends_at, posting_id, created_by, shift_type)
        values (v_post.site_id, p_guard, v_start, v_end, v_post.id, v_post.created_by, v_post.shift_type);
        v_made := v_made + 1;
      end if;
    end loop;
  end loop;

  return v_made;
end;
$$;

create or replace function roster_on_site_active() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_guard uuid;
begin
  if new.active is not distinct from old.active then return null; end if;
  if not new.active then
    -- Withdrawn, not cancelled: a cancelled posted shift blocks its window from
    -- being written again, and reactivating should bring the duties back.
    delete from shifts
    where site_id = new.id and status = 'scheduled' and starts_at > now() and replaced_by_shift is null;
  else
    for v_guard in select distinct guard_id from site_postings where site_id = new.id and active loop
      perform roster_fill_guard(v_guard);
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists sites_roster_active on sites;
create trigger sites_roster_active after update of active on sites
  for each row execute function roster_on_site_active();

revoke all on function roster_on_site_active() from public, anon, authenticated;
