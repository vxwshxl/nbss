-- ===========================================================================
-- sos_map: everything the SOS screen draws, in one call.
--
-- The alarm screen used to be a full red page with names on it. It is now a map:
-- the person who raised it, the people responding (highlighted, with how far
-- they are), the other guards on the site, and the fence. A guard cannot read
-- other guards' positions or profiles directly, so this returns exactly what the
-- screen needs to whoever may already see the alert (the same test as
-- sos_people, 0015): staff, the raiser, and everyone it was sent to.
-- ===========================================================================

create or replace function sos_map(p_alert_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_alert sos_alerts%rowtype;
  v_site  sites%rowtype;
  v_me    uuid := auth.uid();
begin
  select * into v_alert from sos_alerts where id = p_alert_id;
  if not found then return null; end if;
  if not (
    is_staff()
    or v_alert.raised_by = v_me
    or exists (select 1 from sos_notifications n where n.alert_id = p_alert_id and n.profile_id = v_me)
    or exists (select 1 from sos_acknowledgements a where a.alert_id = p_alert_id and a.profile_id = v_me)
  ) then
    return null;
  end if;
  select * into v_site from sites where id = v_alert.site_id;

  return jsonb_build_object(
    'alert', jsonb_build_object(
      'id', v_alert.id, 'status', v_alert.status, 'kind', v_alert.kind, 'note', v_alert.note,
      'lat', v_alert.lat, 'lng', v_alert.lng, 'raised_at', v_alert.raised_at,
      'raised_by', v_alert.raised_by, 'closed_at', v_alert.closed_at, 'closing_note', v_alert.closing_note
    ),
    'site', jsonb_build_object(
      'id', v_site.id, 'name', v_site.name, 'lat', v_site.lat, 'lng', v_site.lng,
      'radius_m', v_site.geofence_radius_m, 'polygon', v_site.polygon
    ),
    'people', coalesce((
      select jsonb_agg(row order by row ->> 'sort', row ->> 'name')
      from (
        select jsonb_build_object(
          'id', p.id,
          'name', p.full_name,
          'phone', p.phone,
          'role', case when p.id = v_alert.raised_by then 'raiser'
                       when ack.profile_id is not null then 'responder'
                       when p.role = 'guard' then 'guard' else 'staff' end,
          'sort', case when p.id = v_alert.raised_by then 0 when ack.response = 'on_scene' then 1
                       when ack.response = 'responding' then 2 when ack.response is not null then 3 else 4 end,
          'response', ack.response,
          'answered_at', ack.at,
          -- Where they are now if the phone is reporting, else where they answered from.
          'lat', coalesce(gp.lat, ack.lat, case when p.id = v_alert.raised_by then v_alert.lat end),
          'lng', coalesce(gp.lng, ack.lng, case when p.id = v_alert.raised_by then v_alert.lng end),
          'heard_at', coalesce(gp.received_at, gp.recorded_at, ack.at),
          'distance_m', case
            when v_alert.lat is null then null
            when gp.lat is not null then round(geo_distance_m(v_alert.lat, v_alert.lng, gp.lat, gp.lng)::numeric)
            when ack.distance_m is not null then round(ack.distance_m::numeric)
          end
        ) as row
        from profiles p
        left join sos_acknowledgements ack on ack.alert_id = p_alert_id and ack.profile_id = p.id
        left join guard_positions gp on gp.guard_id = p.id
        where p.id = v_alert.raised_by
           or ack.profile_id is not null
           -- Everyone on duty at the site right now.
           or exists (select 1 from attendance a where a.guard_id = p.id and a.site_id = v_alert.site_id and a.check_out_at is null)
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function sos_map(uuid) from public, anon;
grant execute on function sos_map(uuid) to authenticated, service_role;
