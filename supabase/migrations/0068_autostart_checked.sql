-- ===========================================================================
-- Autostart, checked on the phone by a supervisor.
--
-- Android has no way for an app to read the Autostart switch on Xiaomi, Vivo,
-- Oppo, Realme and the like, so the app could only ask the guard to say it was on,
-- and almost nobody did. A supervisor who has looked at the phone in person now
-- records that here. It is kept apart from `autostart`, which the app rewrites
-- from its own state every time it opens.
-- ===========================================================================

alter table guard_devices
  add column if not exists autostart_checked_at timestamptz,
  add column if not exists autostart_checked_by uuid references profiles(id) on delete set null;

comment on column guard_devices.autostart_checked_at is 'When a supervisor saw Autostart switched on, on the phone itself.';
comment on column guard_devices.autostart_checked_by is 'The supervisor who checked it.';
