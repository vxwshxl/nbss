-- ===========================================================================
-- The guard who raised an SOS could not see who was coming.
--
-- `sos_ack_read` (0006) let staff, the responder and everyone the alert was
-- sent to read the answers — but the guard who pressed the button is not sent
-- their own alert, so the one person who most needs "Ranjit is on the way,
-- 400 m out" read nothing, and the app's alarm screen stayed on "waiting".
-- ===========================================================================

drop policy if exists sos_ack_read on sos_acknowledgements;
create policy sos_ack_read on sos_acknowledgements
  for select using (
    is_staff()
    or profile_id = auth.uid()
    or exists (select 1 from sos_notifications n where n.alert_id = sos_acknowledgements.alert_id and n.profile_id = auth.uid())
    or exists (select 1 from sos_alerts a where a.id = sos_acknowledgements.alert_id and a.raised_by = auth.uid())
  );
