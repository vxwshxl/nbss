-- ===========================================================================
-- Names on an SOS, for the people who can see it.
--
-- A guard reads only their own profile (profiles_self_read), so on a guard's
-- alarm screen every responder came out as "Someone" and a colleague's alert
-- had no name on it at all. Opening the profiles table to them would hand over
-- emails and PIN-reset fields too; this returns only the name, phone, answer
-- and distance, and only to whoever may already read the alert's answers
-- (the same test as sos_ack_read in 0014).
-- ===========================================================================

create or replace function sos_people(p_alert_id uuid)
returns table (
  kind        text,
  profile_id  uuid,
  full_name   text,
  phone       text,
  response    sos_response,
  distance_m  double precision,
  at          timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1
    from sos_alerts s
    where s.id = p_alert_id
      and (
        is_staff()
        or s.raised_by = auth.uid()
        or exists (select 1 from sos_notifications n where n.alert_id = s.id and n.profile_id = auth.uid())
        or exists (select 1 from sos_acknowledgements a where a.alert_id = s.id and a.profile_id = auth.uid())
      )
  )
  select 'raiser', p.id, p.full_name, p.phone, null::sos_response, null::double precision, s.raised_at
  from sos_alerts s
  join profiles p on p.id = s.raised_by
  where s.id = p_alert_id and exists (select 1 from allowed)
  union all
  select 'responder', p.id, p.full_name, p.phone, a.response, a.distance_m, a.at
  from sos_acknowledgements a
  join profiles p on p.id = a.profile_id
  where a.alert_id = p_alert_id and exists (select 1 from allowed)
  order by 1, 7;
$$;

-- EXECUTE is granted to PUBLIC by default (see 0013), so it is taken back first.
revoke execute on function sos_people(uuid) from public, anon;
grant execute on function sos_people(uuid) to authenticated, service_role;
