-- ===========================================================================
-- The field officer role.
--
-- The field officer runs the whole area: supervisors, guards, housekeepers and
-- clients, at every site. That is what a supervisor could do until now; from 0077
-- a supervisor sees only the sites they are posted to.
--
-- On its own file because Postgres will not use an enum value in the same
-- transaction that adds it; 0077 is where it is put to work.
-- ===========================================================================

alter type user_role add value if not exists 'field_officer' before 'supervisor';
