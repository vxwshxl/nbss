-- Who an SOS reaches: the guards who can actually get there.
--
-- Before: only guards checked in at the same site (plus the office and the client).
-- Now also guards on duty at other sites in the same district within 5 km of the
-- alert, measured from their phone's latest position (or their site, when the phone
-- has gone quiet). A guard in Bongaigaon never hears about Kokrajhar; the post down
-- the road does. The office and the client are unchanged.

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

  select s.client_id, 'client'::sos_audience
  from sites s, alert
  where s.id = alert.site_id
    and s.client_id is not null
    and s.notify_client_on_sos
$$;
