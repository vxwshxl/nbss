-- The console's direction arrow follows the phone's compass.
--
-- A guard standing still sends no new points (the outbox drops anything too close
-- to the last one), so the heading stored with the last point froze while they
-- turned on the spot. record_heading() updates only the live row's heading: no
-- history row, no fence check. The next broadcast_positions() batch (15 s) carries it.

create or replace function record_heading(p_heading double precision)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or p_heading is null or p_heading < 0 or p_heading > 360 then
    return false;
  end if;
  update guard_positions gp
  set heading = p_heading, received_at = now()
  where gp.guard_id = auth.uid()
    and gp.attendance_id is not null
    and exists (select 1 from attendance a where a.id = gp.attendance_id and a.check_out_at is null);
  return found;
end;
$$;

revoke all on function record_heading(double precision) from public, anon;
grant execute on function record_heading(double precision) to authenticated;
