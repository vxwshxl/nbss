-- ===========================================================================
-- A live signal for clients.
--
-- The console refreshes a page when a table it shows changes, using Postgres
-- change events filtered by RLS. That reaches staff and guards, but never a
-- client: clients deliberately have no read policy on `attendance` (they see
-- the column-limited `client_attendance` view instead, with no coordinates),
-- so no attendance event is ever delivered to them and "My site" would only
-- catch up on reload.
--
-- So attendance at a client's site sends a small private broadcast to that
-- client's own topic — which site, and nothing else. It is a doorbell, not a
-- copy of the row: the page then re-reads through the view it already uses.
-- ===========================================================================

create or replace function notify_client_attendance() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from sites where id = new.site_id;
  if v_client is not null then
    perform realtime.send(
      jsonb_build_object('site_id', new.site_id, 'op', tg_op),
      'attendance',
      'client:' || v_client::text,
      true
    );
  end if;
  return new;
exception when others then
  -- A missed doorbell must never cost a guard their check-in.
  return new;
end;
$$;

drop trigger if exists attendance_client_signal on attendance;
create trigger attendance_client_signal
  after insert or update on attendance
  for each row execute function notify_client_attendance();

-- A client may listen on their own topic and no other.
drop policy if exists nbss_client_channel_read on realtime.messages;
create policy nbss_client_channel_read on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'client:' || auth.uid()::text);
