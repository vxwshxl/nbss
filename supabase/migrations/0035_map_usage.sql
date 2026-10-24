-- Counting Google Maps use, so the office can see what the bill will be.
--
-- Google bills the console's maps per map load (the "Dynamic Maps" SKU: one each
-- time a Google map is drawn in a browser) and the SOS email picture per request
-- ("Static Maps"). Both are counted here as they happen. The app's maps are not:
-- Android's Maps SDK is free and iPhones use Apple Maps.
--
-- This is our own count, close to Google's but not the invoice; the exact figure is
-- in Google Cloud Console → Google Maps Platform → Metrics.

create table if not exists map_usage (
  id         bigserial primary key,
  kind       text not null check (kind in ('dynamic', 'static')),
  path       text,
  profile_id uuid references profiles (id) on delete set null,
  at         timestamptz not null default now()
);
create index if not exists map_usage_at on map_usage (at);
alter table map_usage enable row level security;

-- Written only through log_map_load (and by the server for static maps).
create or replace function log_map_load(p_kind text, p_path text default null)
returns void
language sql security definer set search_path = public
as $$
  insert into map_usage (kind, path, profile_id)
  select p_kind, left(p_path, 200), auth.uid()
  where auth.uid() is not null and p_kind in ('dynamic', 'static');
$$;
revoke all on function log_map_load(text, text) from public, anon;
grant execute on function log_map_load(text, text) to authenticated;

-- Per day and kind, plus who loaded the most and from which pages. Admin and developer only.
create or replace function map_usage_report(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_lo timestamptz := p_from::timestamp at time zone 'Asia/Kolkata';
  v_hi timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Kolkata';
begin
  if not exists (select 1 from profiles where id = auth.uid() and active and role in ('admin', 'developer')) then
    raise exception 'Only an administrator can see map usage.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'dynamic', dyn, 'static', sta) order by d)
      from (
        select (at at time zone 'Asia/Kolkata')::date as d,
               count(*) filter (where kind = 'dynamic') as dyn,
               count(*) filter (where kind = 'static') as sta
        from map_usage where at >= v_lo and at < v_hi group by 1
      ) x), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'loads', n) order by n desc)
      from (select coalesce(path, '-') as path, count(*) as n from map_usage
            where kind = 'dynamic' and at >= v_lo and at < v_hi group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'loads', n) order by n desc)
      from (select coalesce(p.full_name, 'System') as name, count(*) as n
            from map_usage m left join profiles p on p.id = m.profile_id
            where m.at >= v_lo and m.at < v_hi group by 1 order by 2 desc limit 10) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function map_usage_report(date, date) from public, anon;
grant execute on function map_usage_report(date, date) to authenticated;
