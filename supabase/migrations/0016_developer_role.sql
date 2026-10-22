-- ===========================================================================
-- The developer role.
--
-- On its own file because Postgres will not use an enum value in the same
-- transaction that adds it; 0017 is where it is put to work.
-- ===========================================================================

alter type user_role add value if not exists 'developer' before 'admin';
