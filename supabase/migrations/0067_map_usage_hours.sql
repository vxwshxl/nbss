-- ===========================================================================
-- Maps usage by day, month or year.
--
-- The report (0035) answered for a range of days. It now also counts by hour of
-- the day (IST), for the one-day view, and returns up to 100 pages and people
-- rather than 10, so a year's list is not cut short and each site's page can be
-- named and grouped in the console.
-- ===========================================================================

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
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'n', n) order by h)
      from (
        select extract(hour from at at time zone 'Asia/Kolkata')::int as h, count(*) as n
        from map_usage where at >= v_lo and at < v_hi group by 1
      ) x), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'loads', n) order by n desc)
      from (select coalesce(path, '-') as path, count(*) as n from map_usage
            where kind = 'dynamic' and at >= v_lo and at < v_hi group by 1 order by 2 desc limit 100) x), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'phone', phone, 'loads', n) order by n desc)
      from (select coalesce(p.full_name, 'System') as name, p.phone, count(*) as n
            from map_usage m left join profiles p on p.id = m.profile_id
            where m.at >= v_lo and m.at < v_hi group by 1, 2 order by 3 desc limit 100) x), '[]'::jsonb)
  );
end;
$$;
