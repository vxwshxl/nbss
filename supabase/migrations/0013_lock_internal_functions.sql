-- ===========================================================================
-- Internal functions were callable by anyone holding the publishable key.
--
-- 0006 and 0012 ran `revoke all … from anon, authenticated` on the functions
-- only the database itself should call — the secret store, the push sender,
-- the cron housekeeping, the roster filler. That is not enough: Postgres grants
-- EXECUTE on every new function to PUBLIC, and anon and authenticated inherit
-- it through PUBLIC. So `get_secret` and `set_secret` in particular could be
-- called by a visitor who was not even signed in.
--
-- Revoked from PUBLIC here. Nothing legitimate loses access: every caller is a
-- security-definer function (raise_sos, punch_in, handle_new_auth_user, …) or
-- pg_cron, both of which run as the owner. service_role keeps it for
-- maintenance from the server.
-- ===========================================================================

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'get_secret', 'set_secret',
        'drain_push_outbox', 'collect_push_responses', 'enqueue_sos_push',
        'renotify_unanswered_sos', 'expire_stale_sos', 'prune_push_outbox',
        'broadcast_positions', 'prune_location_history', 'sos_recipients',
        'next_client_code', 'next_service_reference',
        'roster_fill', 'roster_fill_guard', 'roster_mark_missed'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
