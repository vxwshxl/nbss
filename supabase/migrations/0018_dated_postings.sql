-- ===========================================================================
-- Posting by date as well as by week.
--
-- A posting was always a standing weekly pattern: a site, a daily window, the
-- weekdays. Agencies also post people for particular days (an event, a two-day
-- cover, a month of named dates), so a posting may now carry `dates` instead:
--
--   · dates is null  → weekly: the window on each of `days`, every week. Still
--                      one per guard, as before.
--   · dates is set   → dated: the window on exactly those dates. A guard may
--                      hold any number of these, at different sites.
--
-- Shifts are written from both. A dated posting is written in full however far
-- ahead its dates run; a weekly one, as before, a week ahead by the nightly job.
-- ===========================================================================

alter table site_postings add column if not exists dates date[];

alter table site_postings drop constraint if exists posting_dates;
alter table site_postings add constraint posting_dates
  check (dates is null or cardinality(dates) between 1 and 366);

comment on column site_postings.dates is
  'Null for a weekly posting (days apply every week). Set for a dated posting: the window on exactly these IST dates.';

-- One standing weekly post per guard; dated postings are not limited.
drop index if exists site_postings_one_per_guard;
create unique index if not exists site_postings_one_weekly_per_guard
  on site_postings (guard_id) where active and dates is null;

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
  for v_post in select * from site_postings where guard_id = p_guard and active loop
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
        where guard_id = p_guard and status <> 'cancelled'
          and tstzrange(starts_at, ends_at) && tstzrange(v_start, v_end)
      ) then
        insert into shifts (site_id, guard_id, starts_at, ends_at, posting_id, created_by)
        values (v_post.site_id, p_guard, v_start, v_end, v_post.id, v_post.created_by);
        v_made := v_made + 1;
      end if;
    end loop;
  end loop;

  return v_made;
end;
$$;

create or replace function roster_fill(p_days integer default 7)
returns integer
language sql security definer set search_path = public
as $$
  select coalesce(sum(roster_fill_guard(g, p_days)), 0)::integer
  from (select distinct guard_id as g from site_postings where active) x
$$;

revoke all on function roster_fill_guard(uuid, integer) from anon, authenticated;
revoke all on function roster_fill(integer) from anon, authenticated;

-- shifts are what the console and the app watch; make sure they are broadcast.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'shifts') then
    alter publication supabase_realtime add table shifts;
  end if;
end $$;
