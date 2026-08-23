-- ===========================================================================
-- Move btree_gist out of `public`.
--
-- Installing it in `public` brought roughly 180 support functions with it —
-- gbt_*, *_dist, gbtreekey*. PostgREST publishes every function in `public` as
-- an RPC endpoint, so all of them became callable over the REST API, and they
-- bury this schema's own six functions in the dashboard's list.
--
-- `extensions` is where Supabase puts extensions by convention, and it is not
-- exposed by PostgREST. The exclusion constraint that stops a guard being
-- rostered to two places at once keeps working either way: an index records
-- its operator class by OID, not by name, so the reference survives the move.
-- ===========================================================================

create schema if not exists extensions;

alter extension btree_gist set schema extensions;

-- The operator class is now outside the default search path. Anything that
-- names it explicitly in future DDL needs the schema qualified, so make it
-- reachable rather than leaving a trap for the next migration.
grant usage on schema extensions to postgres, anon, authenticated, service_role;
