-- ===========================================================================
-- A client sees, on their map, the guards on duty at their own sites.
--
-- The client's home screen says "2 guards on duty" over a map of the site, and
-- the map showed nobody: guard_positions was readable by the guard, the office
-- and the site's supervisor only. Now a client may read the current position of
-- a guard who is checked in, right now, at a site that client owns.
--
-- Nothing more: no position once the guard has checked out, none at another
-- client's site, no route history (guard_location_history is unchanged). The
-- Test / Live restriction (nbss_test_live) still applies on top.
-- ===========================================================================

-- Security definer: a client cannot read attendance directly (they read the
-- client_attendance view), so the check runs with the owner's rights.
create or replace function client_sees_position(p_site_id uuid, p_attendance_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from sites s
    join attendance a on a.id = p_attendance_id
    where s.id = p_site_id
      and s.client_id = auth.uid()
      and a.site_id = s.id
      and a.check_out_at is null
  )
$$;

revoke all on function client_sees_position(uuid, uuid) from public;
grant execute on function client_sees_position(uuid, uuid) to authenticated;

drop policy if exists positions_client_read on guard_positions;
create policy positions_client_read on guard_positions
  for select to authenticated
  using ((select my_role()) = 'client' and client_sees_position(site_id, attendance_id));
