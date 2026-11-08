-- ===========================================================================
-- Breaks in a post, and new hours that reach today's duty.
--
-- A post was one window a day: 8:00 am – 8:00 pm. Sites also want a guard on
-- 8 – 12 and 1 – 8, or a gap mid-afternoon, so a post now carries `breaks`:
-- times inside the window when the guard is off. The roster writes one shift
-- per part of the day (8 – 12 and 1 – 8 are two duties), so everything that
-- works on shifts already works on each part: the reminders, "not arrived",
-- check-in matching and the automatic check-out 5 minutes after each part ends.
--
-- Editing a post's hours used to change only duties that had not started, so a
-- guard on duty when the office moved the end from 8 pm to 10 pm was still
-- checked out at 8. Now the duty running at the time follows the new hours:
-- its end moves to the end of the part of the new day it falls in, or to now
-- when the new hours no longer cover now (a break just added, an earlier end),
-- and the rest of today's parts are written after it.
-- ===========================================================================

alter table site_postings add column if not exists breaks jsonb not null default '[]'::jsonb;

alter table site_postings drop constraint if exists posting_breaks;
alter table site_postings add constraint posting_breaks
  check (jsonb_typeof(breaks) = 'array' and jsonb_array_length(breaks) <= 6);

comment on column site_postings.breaks is
  'Times inside the daily window when the guard is off, [{"starts":"12:00","ends":"13:00"}]. Each part of the day between them is its own shift.';

/**
 * The parts of one day's duty under a post, as instants: the window from
 * `starts` to `ends` (past midnight when `ends` is not after `starts`) with
 * each break taken out. Nothing when the post does not apply that day. A
 * break that does not fit inside the window is ignored.
 */
create or replace function posting_windows(p_post site_postings, p_day date)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable set search_path = public
as $$
declare
  v_len   integer;
  v_start timestamptz;
  v_end   timestamptz;
  v_cur   timestamptz;
  b       record;
begin
  if p_post.dates is not null then
    if not (p_day = any (p_post.dates)) then return; end if;
  elsif not (extract(isodow from p_day)::smallint = any (p_post.days)) then
    return;
  end if;

  -- Minutes in the window; equal start and end is the 24-hour duty.
  v_len := mod((extract(epoch from (p_post.ends - p_post.starts)) / 60)::integer + 1440, 1440);
  if v_len = 0 then v_len := 1440; end if;
  v_start := (p_day + p_post.starts) at time zone 'Asia/Kolkata';
  v_end   := v_start + make_interval(mins => v_len);
  v_cur   := v_start;

  for b in
    select x.s, x.e from (
      select mod((extract(epoch from ((br->>'starts')::time - p_post.starts)) / 60)::integer + 1440, 1440) as s,
             mod((extract(epoch from ((br->>'ends')::time - p_post.starts)) / 60)::integer + 1440, 1440) as e
      from jsonb_array_elements(coalesce(p_post.breaks, '[]'::jsonb)) br
      where br ? 'starts' and br ? 'ends'
    ) x
    where x.s > 0 and x.e > x.s and x.e < v_len
    order by x.s
  loop
    if v_start + make_interval(mins => b.s) > v_cur then
      starts_at := v_cur;
      ends_at   := v_start + make_interval(mins => b.s);
      return next;
    end if;
    v_cur := greatest(v_cur, v_start + make_interval(mins => b.e));
  end loop;

  if v_cur < v_end then
    starts_at := v_cur;
    ends_at   := v_end;
    return next;
  end if;
end;
$$;

revoke all on function posting_windows(site_postings, date) from public, anon, authenticated;

-- As in 0061 (a deactivated guard is owed nothing, an out-of-service site gets
-- nothing), but one shift per part of the day.
create or replace function roster_fill_guard(p_guard uuid, p_days integer default 7)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_post  site_postings%rowtype;
  v_day   date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_part  record;
  v_made  integer := 0;
begin
  if not exists (select 1 from profiles where id = p_guard and active) then return 0; end if;

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
      for v_part in select * from posting_windows(v_post, v_day) loop
        continue when v_part.ends_at < now();

        if not exists (
          select 1 from shifts
          where guard_id = p_guard
            and tstzrange(starts_at, ends_at) && tstzrange(v_part.starts_at, v_part.ends_at)
            and (status <> 'cancelled' or posting_id = v_post.id)
        ) then
          insert into shifts (site_id, guard_id, starts_at, ends_at, posting_id, created_by, shift_type)
          values (v_post.site_id, p_guard, v_part.starts_at, v_part.ends_at, v_post.id, v_post.created_by, v_post.shift_type);
          v_made := v_made + 1;
        end if;
      end loop;
    end loop;
  end loop;

  return v_made;
end;
$$;

revoke all on function roster_fill_guard(uuid, integer) from anon, authenticated;

-- As in 0022, plus: new hours on the same post and site reach the duty running now.
create or replace function roster_on_posting_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_guard uuid := coalesce(new.guard_id, old.guard_id);
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  r       record;
  v_end   timestamptz;
begin
  if tg_op = 'UPDATE' and old.active and new.active
     and new.guard_id = old.guard_id and new.site_id = old.site_id
     and (new.starts, new.ends, new.breaks, new.days, new.dates)
         is distinct from (old.starts, old.ends, old.breaks, old.days, old.dates) then
    for r in
      select s.id, s.starts_at, s.ends_at from shifts s
      where s.posting_id = new.id and s.status in ('scheduled', 'in_progress')
        and s.starts_at <= now() and s.ends_at > now()
    loop
      select w.ends_at into v_end
      from (select * from posting_windows(new, v_today - 1)
            union all
            select * from posting_windows(new, v_today)) w
      where w.starts_at <= now() and w.ends_at > now()
      order by w.ends_at
      limit 1;

      -- Not covered any more: the duty ends now, and the automatic check-out
      -- closes it in 5 minutes at this time, as at any other end.
      v_end := coalesce(v_end, greatest(now(), r.starts_at + interval '1 minute'));
      if v_end is distinct from r.ends_at then
        update shifts
        set ends_at = v_end,
            -- A later end is owed its own "duty ended, check out" reminder.
            checkout_reminded_at = case when v_end > r.ends_at then null else checkout_reminded_at end
        where id = r.id;
      end if;
    end loop;
  end if;

  delete from shifts
  where guard_id = v_guard and posting_id is not null and status = 'scheduled'
    and starts_at > now() and replaced_by_shift is null;
  perform roster_fill_guard(v_guard);
  if tg_op = 'UPDATE' and old.guard_id <> new.guard_id then
    delete from shifts
    where guard_id = old.guard_id and posting_id is not null and status = 'scheduled'
      and starts_at > now() and replaced_by_shift is null;
    perform roster_fill_guard(old.guard_id);
  end if;
  return null;
end;
$$;
