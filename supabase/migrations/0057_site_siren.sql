-- A site can have the phone siren on or off. On (the default), an SOS from that site
-- rings a siren on the phones it reaches, with a vibration like an incoming call; off,
-- it only vibrates (a post where a sound would give the guard away). The SOS itself,
-- its push and its fan-out are unchanged: this is how it sounds, not who hears it.

alter table sites add column sos_siren boolean not null default true;

-- For the phone: which of these sites ring a siren. A guard may be alerted to an SOS
-- at a site they cannot read (a neighbour's), so this answers for any site id given
-- and says nothing but yes or no.
create or replace function sos_siren_sites(p_site_ids uuid[]) returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(id), '{}') from sites where id = any (p_site_ids) and sos_siren
$$;

revoke all on function sos_siren_sites(uuid[]) from public, anon;
grant execute on function sos_siren_sites(uuid[]) to authenticated;
