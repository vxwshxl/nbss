-- ===========================================================================
-- Push delivery moves out of the database.
--
-- 0006 sent pushes with pg_net and read Expo's reply back with a second cron
-- job. On the self-hosted cluster pg_net's background worker serves a single
-- database, and it is not this one: `net.http_post` here queues a request that
-- is never sent. So the outbox stays exactly as it was, and the sending is done
-- by `apps/web/scripts/push-worker.mjs` (PM2 `nbss-push`) through two functions:
--
--   claim_push_batch()     marks a batch in flight and hands it over
--   record_push_tickets()  writes Expo's per-message answer back
--
-- `request_id` keeps its meaning from 0006/0007 (null = not dispatched yet);
-- it now holds a claim number rather than a pg_net request id.
--
-- The cron jobs 'nbss-drain-push' and 'nbss-collect-push' are unscheduled in
-- the cluster's `postgres` database (pg_cron lives there, see README → Database).
-- ===========================================================================

alter table push_outbox add column if not exists claimed_at timestamptz;

create sequence if not exists push_claim_seq;

-- What raise_sos and renotify_unanswered_sos call. Sending is the worker's job
-- now; this only wakes it, and reports what is waiting.
create or replace function drain_push_outbox(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_pending integer;
begin
  select count(*) into v_pending from push_outbox
  where sent_at is null and failed_at is null and request_id is null and attempts < 3;
  if v_pending > 0 then perform pg_notify('nbss_push', ''); end if;
  return jsonb_build_object('pending', v_pending);
end;
$$;

-- Nothing to collect: the worker records tickets as Expo answers.
create or replace function collect_push_responses() returns jsonb
language sql security definer set search_path = public
as $$ select jsonb_build_object('responses', 0) $$;

create or replace function claim_push_batch(p_limit integer default 100)
returns table (id bigint, message jsonb)
language plpgsql security definer set search_path = public
as $$
declare v_claim bigint := nextval('push_claim_seq');
begin
  -- A claim the worker never answered (it crashed, or Expo hung past its timeout)
  -- goes back in the queue; `attempts` already counted it.
  update push_outbox o
  set request_id = null, claimed_at = null, error = coalesce(o.error, 'worker did not answer')
  where o.request_id is not null and o.sent_at is null and o.failed_at is null
    and o.claimed_at < now() - interval '2 minutes';

  update push_outbox o set failed_at = now()
  where o.request_id is null and o.attempts >= 3 and o.sent_at is null and o.failed_at is null;

  -- SKIP LOCKED so two overlapping claims can never send the same push twice.
  return query
  with batch as (
    select b.id from push_outbox b
    where b.sent_at is null and b.failed_at is null and b.request_id is null and b.attempts < 3
    order by b.queued_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update push_outbox o
    set request_id = v_claim, claimed_at = now(), attempts = o.attempts + 1
    from batch where o.id = batch.id
    returning o.*
  )
  select c.id,
         jsonb_strip_nulls(jsonb_build_object(
           'to', c.token,
           'title', c.title,
           'body', c.body,
           'data', c.data,
           'sound', c.sound,
           'priority', c.priority,
           'channelId', c.channel_id,
           'ttl', c.ttl_seconds,
           -- iOS: surfaces the alert on a phone in a focus mode without needing the
           -- critical-alerts entitlement, which Apple grants case by case.
           'interruptionLevel', 'time-sensitive',
           '_contentAvailable', true
         ))
  from claimed c
  order by c.queued_at, c.id;
end;
$$;

-- p_results: [{ "id": 12, "status": "ok" | "error" | "retry", "error": "…" }]
--   ok     Expo accepted the message
--   error  Expo refused it for good (DeviceNotRegistered, MessageTooBig, …)
--   retry  transient (network, 5xx, timeout): back in the queue until 3 attempts
create or replace function record_push_tickets(p_results jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_ok integer; v_failed integer; v_retry integer;
begin
  with r as (
    select (x ->> 'id')::bigint id, x ->> 'status' status, left(x ->> 'error', 500) error
    from jsonb_array_elements(p_results) x
  )
  update push_outbox o
  set sent_at    = case when r.status = 'ok' then now() end,
      failed_at  = case when r.status = 'error' or (r.status = 'retry' and o.attempts >= 3) then now() end,
      request_id = case when r.status = 'retry' and o.attempts < 3 then null else o.request_id end,
      claimed_at = case when r.status = 'retry' and o.attempts < 3 then null else o.claimed_at end,
      error      = case when r.status = 'ok' then null else r.error end
  from r
  where o.id = r.id and o.sent_at is null and o.failed_at is null;

  -- A token Expo says is dead is disabled rather than deleted, so the console
  -- can explain an unanswered alert.
  update device_tokens d
  set disabled_at = now(), disabled_reason = 'DeviceNotRegistered'
  from push_outbox o
  where o.token = d.token
    and o.id in (select (x ->> 'id')::bigint from jsonb_array_elements(p_results) x)
    and o.error = 'DeviceNotRegistered'
    and d.disabled_at is null;

  select count(*) filter (where x ->> 'status' = 'ok'),
         count(*) filter (where x ->> 'status' = 'error'),
         count(*) filter (where x ->> 'status' = 'retry')
  into v_ok, v_failed, v_retry
  from jsonb_array_elements(p_results) x;

  return jsonb_build_object('ok', v_ok, 'failed', v_failed, 'retry', v_retry);
end;
$$;

revoke all on function claim_push_batch(integer)   from public, anon, authenticated;
revoke all on function record_push_tickets(jsonb)  from public, anon, authenticated;
grant execute on function claim_push_batch(integer)  to service_role;
grant execute on function record_push_tickets(jsonb) to service_role;
