-- ===========================================================================
-- PIN resets and impersonation.
--
-- An existing PIN can never be shown. Supabase stores it bcrypt-hashed in
-- auth.users, which is the correct design and is not reversible — so "see a
-- guard's PIN" is replaced by "issue a new one and show it once". What the
-- admin reads off the screen is a value that has just been set, not one that
-- was retrieved.
-- ===========================================================================

alter table profiles
  add column if not exists must_change_pin boolean not null default false,
  add column if not exists pin_reset_at    timestamptz,
  add column if not exists pin_reset_by    uuid references profiles (id) on delete set null,
  add column if not exists last_seen_at    timestamptz;

comment on column profiles.must_change_pin is
  'Set when an admin issues a temporary PIN. The guard is asked to choose their own on next sign-in.';

-- Impersonation is recorded against the real administrator, never the person
-- being viewed. `entity_id` holds whose account was opened.
create index if not exists audit_log_action_idx on audit_log (action, created_at desc);
