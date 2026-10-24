-- A client hears about an SOS at their site only when the site is deployed: a guard
-- posted there or checked in. Everything else about who an SOS reaches is unchanged
-- (0032: the site's guards, on-duty guards within 5 km in the district, the office).

create or replace function sos_recipients(p_alert_id uuid)
returns table (profile_id uuid, audience sos_audience)
language sql stable security definer set search_path = public
as $$
  with alert as (
    select a.*, coalesce(a.lat, s.lat) as at_lat, coalesce(a.lng, s.lng) as at_lng, s.district
    from sos_alerts a join sites s on s.id = a.site_id
    where a.id = p_alert_id
  )
  -- Everyone checked in at the same site.
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a, alert
  where a.site_id = alert.site_id
    and a.check_out_at is null
    and a.guard_id <> alert.raised_by

  union

  -- On duty nearby: same district, within 5 km.
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a
  join sites s on s.id = a.site_id
  left join guard_positions gp on gp.guard_id = a.guard_id
    and coalesce(gp.received_at, gp.recorded_at) > now() - interval '20 minutes'
  cross join alert
  where a.check_out_at is null
    and a.guard_id <> alert.raised_by
    and a.site_id <> alert.site_id
    and s.active
    and (alert.district is null or s.district is null or lower(trim(s.district)) = lower(trim(alert.district)))
    and geo_distance_m(alert.at_lat, alert.at_lng, coalesce(gp.lat, s.lat), coalesce(gp.lng, s.lng)) <= 5000

  union

  select p.id, 'staff'::sos_audience
  from profiles p
  where p.active and p.role in ('developer', 'admin', 'supervisor')

  union

  -- The client: only once their site is actually deployed (a guard posted there, or
  -- someone checked in), so a site still being set up never alarms the customer.
  select s.client_id, 'client'::sos_audience
  from sites s, alert
  where s.id = alert.site_id
    and s.client_id is not null
    and s.notify_client_on_sos
    and s.active
    and (exists (select 1 from site_postings sp where sp.site_id = s.id and sp.active)
         or exists (select 1 from attendance at where at.site_id = s.id and at.check_out_at is null))
$$;
