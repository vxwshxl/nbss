-- Two things the app and the console now share.
--
-- 1. "Last seen" means last used, from either side. It used to move only when a
--    guard's phone sent a position, so someone who signed in to the app (or an
--    admin who works only in the console) read "Never". Both now call
--    touch_presence() when they open; it writes at most once a minute.
--
-- 2. An SOS reaches every guard of its district, on duty or not, and stays in
--    their app until it is resolved (duty_areas_now lists the alerts a person was
--    notified of). Before, only the guards at the same site or on duty within 5 km
--    heard it. Anyone may raise one, staff included; the raiser is never sent
--    their own alarm.

create or replace function touch_presence() returns void
language sql volatile security definer set search_path = public
as $$
  update profiles set last_seen_at = now()
  where id = auth.uid()
    and (last_seen_at is null or last_seen_at < now() - interval '1 minute')
$$;

revoke all on function touch_presence() from public, anon;
grant execute on function touch_presence() to authenticated;

create or replace function sos_recipients(p_alert_id uuid)
returns table (profile_id uuid, audience sos_audience)
language sql stable security definer set search_path = public
as $$
  with alert as (
    select a.*, coalesce(a.lat, s.lat) as at_lat, coalesce(a.lng, s.lng) as at_lng, s.district
    from sos_alerts a join sites s on s.id = a.site_id
    where a.id = p_alert_id
  ),
  -- Each guard's districts: where they are posted, rostered today, or checked in now.
  guard_districts as (
    select sp.guard_id, s.district from site_postings sp join sites s on s.id = sp.site_id
    where sp.active and s.active
    union
    select sh.guard_id, s.district from shifts sh join sites s on s.id = sh.site_id
    where sh.status in ('scheduled', 'in_progress')
      and sh.starts_at < now() + interval '18 hours' and sh.ends_at > now() - interval '6 hours'
    union
    select at.guard_id, s.district from attendance at join sites s on s.id = at.site_id
    where at.check_out_at is null
  )
  -- Everyone checked in at the same site.
  select a.guard_id, 'on_duty_guard'::sos_audience
  from attendance a, alert
  where a.site_id = alert.site_id
    and a.check_out_at is null
    and a.guard_id <> alert.raised_by

  union

  -- Every active guard of the district, on duty or not.
  select p.id, 'on_duty_guard'::sos_audience
  from profiles p
  join guard_districts gd on gd.guard_id = p.id
  cross join alert
  where p.active and p.role = 'guard'
    and p.id <> alert.raised_by
    and alert.district is not null and gd.district is not null
    and lower(trim(gd.district)) = lower(trim(alert.district))

  union

  -- On duty nearby: within 5 km, whatever the district says.
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
    and geo_distance_m(alert.at_lat, alert.at_lng, coalesce(gp.lat, s.lat), coalesce(gp.lng, s.lng)) <= 5000

  union

  select p.id, 'staff'::sos_audience
  from profiles p, alert
  where p.active and p.role in ('developer', 'admin', 'supervisor')
    and p.id <> alert.raised_by

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
