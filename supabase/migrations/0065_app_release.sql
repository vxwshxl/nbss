-- ===========================================================================
-- The app's latest release, set from the console (App updates).
--
-- One row. The office enters the newest build on the Play Store — its version
-- code (the build number Android compares), the version name people see, the
-- store link and what changed. The app reads it at launch and whenever it comes
-- back to the front; when its own build number is lower, it shows the update
-- screen with a button to the store.
--
-- Readable by anyone, signed in or not: the update screen has to reach a phone
-- still on the sign-in page. Written only by the server, for administrators.
-- ===========================================================================

create table if not exists app_release (
  id           smallint primary key default 1 check (id = 1),
  version_code integer not null default 0 check (version_code >= 0),
  version_name text,
  store_url    text,
  notes        text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles (id) on delete set null
);

insert into app_release (id) values (1) on conflict (id) do nothing;

alter table app_release enable row level security;

drop policy if exists app_release_read on app_release;
create policy app_release_read on app_release for select using (true);

grant select on app_release to anon, authenticated;
