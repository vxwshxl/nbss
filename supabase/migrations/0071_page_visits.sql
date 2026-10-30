-- Page impressions and the website's page-view counter.
--
-- One row per page per day (India time) with real-user and bot counts, as okhrang's
-- page_visits. Browsers are counted from the page itself (/api/track), bots by the
-- middleware, both through track_visit() with the secret key. site_counters holds the
-- all-time totals: 'views' (every real page view, shown in the public footer) and
-- 'visitors' (each browser once). Administrators and developers read them on
-- Console → Impressions.

create table if not exists page_visits (
  page_name     text not null,
  visit_date    date not null default (now() at time zone 'Asia/Kolkata')::date,
  user_count    integer not null default 0,
  bot_count     integer not null default 0,
  last_updated  timestamptz not null default now(),
  primary key (page_name, visit_date)
);
create index if not exists page_visits_date on page_visits (visit_date);

create table if not exists site_counters (
  key    text primary key,
  value  bigint not null default 0
);
insert into site_counters (key, value) values ('views', 0), ('visitors', 0) on conflict do nothing;

alter table page_visits enable row level security;
alter table site_counters enable row level security;
drop policy if exists "admins read page visits" on page_visits;
create policy "admins read page visits" on page_visits for select to authenticated using (is_admin());
drop policy if exists "anyone reads site counters" on site_counters;
create policy "anyone reads site counters" on site_counters for select using (true);

create or replace function track_visit(p_page text, p_is_bot boolean, p_new_visitor boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  insert into page_visits (page_name, visit_date, user_count, bot_count)
  values (left(p_page, 200), (now() at time zone 'Asia/Kolkata')::date,
          case when p_is_bot then 0 else 1 end, case when p_is_bot then 1 else 0 end)
  on conflict (page_name, visit_date) do update
    set user_count = page_visits.user_count + case when p_is_bot then 0 else 1 end,
        bot_count = page_visits.bot_count + case when p_is_bot then 1 else 0 end,
        last_updated = now();
  if p_new_visitor and not p_is_bot then
    update site_counters set value = value + 1 where key = 'visitors';
  end if;
  if not p_is_bot then
    update site_counters set value = value + 1 where key = 'views' returning value into n;
  else
    select value into n from site_counters where key = 'views';
  end if;
  return n;
end $$;
revoke all on function track_visit(text, boolean, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
