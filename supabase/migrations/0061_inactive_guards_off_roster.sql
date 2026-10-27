-- ===========================================================================
-- A deactivated guard leaves the roster.
--
-- Deactivating a guard stopped their sign-in, but their standing posting kept
-- writing shifts, so they went on appearing as "Not arrived" on Live tracking,
-- in the duty alerts and on the site's roster. Now, as for a site taken out of
-- service (0025), nothing is deleted from history, but:
--   * their active postings are switched off and marked held_for_inactive, so
--     every list that shows active postings stops showing them;
--   * their future scheduled shifts are withdrawn, and a scheduled one already
--     under way that they never checked in to is cancelled;
--   * an open check-in is closed, and their dot leaves the live map.
-- Reactivating brings the held postings back and fills the roster from them.
-- ===========================================================================

alter table site_postings add column if not exists held_for_inactive boolean not null default false;

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
  -- A deactivated guard is owed no duties.
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

create or replace function guard_off_roster(p_guard uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update site_postings set active = false, held_for_inactive = true
  where guard_id = p_guard and active;

  -- Withdrawn rather than cancelled, as in 0025, so reactivating can write them again.
  delete from shifts
  where guard_id = p_guard and status = 'scheduled' and starts_at > now() and replaced_by_shift is null;

  update shifts set status = 'cancelled', cancel_reason = 'Guard deactivated'
  where guard_id = p_guard and status = 'scheduled' and starts_at <= now() and ends_at > now()
    and not exists (select 1 from attendance a where a.shift_id = shifts.id);

  update attendance set check_out_at = greatest(now(), check_in_at + interval '1 minute'), check_out_method = 'auto_close'
  where guard_id = p_guard and check_out_at is null and check_in_at is not null;
  update shifts set status = 'completed' where guard_id = p_guard and status = 'in_progress';
  delete from guard_positions where guard_id = p_guard;
end;
$$;

create or replace function roster_on_profile_active() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_post site_postings%rowtype;
begin
  if new.active is not distinct from old.active or new.role <> 'guard' then return null; end if;
  if not new.active then
    perform guard_off_roster(new.id);
  else
    -- Back as they were, unless a new standing posting was made for them meanwhile.
    for v_post in select * from site_postings where guard_id = new.id and held_for_inactive loop
      if v_post.dates is not null or not exists (
        select 1 from site_postings where guard_id = new.id and active and dates is null
      ) then
        update site_postings set active = true, held_for_inactive = false where id = v_post.id;
      else
        update site_postings set held_for_inactive = false where id = v_post.id;
      end if;
    end loop;
    perform roster_fill_guard(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_roster_active on profiles;
create trigger profiles_roster_active after update of active on profiles
  for each row execute function roster_on_profile_active();

revoke all on function guard_off_roster(uuid) from public, anon, authenticated;
revoke all on function roster_on_profile_active() from public, anon, authenticated;

-- The guards already deactivated.
select guard_off_roster(id) from profiles where role = 'guard' and not active;
