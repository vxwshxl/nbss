-- ===========================================================================
-- Location pins: a place sent from the field, for a site to be registered at.
--
-- Some sites are hard to find on a map: a new campus, a farm, a gate down an
-- unnamed lane. Whoever is standing there (a guard, a housekeeper, a supervisor)
-- presses "Pin my location" in the app, and the phone's own GPS fix goes to the
-- office. An administrator sees the pins on Sites & geofences, registers a site
-- at one, or deletes it.
--
-- A pin is where the phone is, never a point picked on a map: it is written only
-- through send_location_pin(), which refuses a fix that is stale, imprecise or
-- reported as mocked by the phone. A person may send several.
-- ===========================================================================

create table if not exists location_pins (
  id           uuid primary key default gen_random_uuid(),
  sent_by      uuid not null references profiles (id) on delete cascade,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  accuracy_m   real not null check (accuracy_m >= 0),
  note         text check (char_length(note) <= 200),
  -- When the phone took the fix (the server's clock minus the fix's age, so a
  -- phone with the wrong time cannot misdate it).
  captured_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  -- The site registered from this pin, once there is one.
  site_id      uuid references sites (id) on delete set null,
  is_test      boolean not null default false
);
create index if not exists location_pins_created on location_pins (created_at desc);
create index if not exists location_pins_sent_by on location_pins (sent_by);

alter table location_pins enable row level security;

-- Staff read every pin; anyone reads the ones they sent.
drop policy if exists "staff and sender read pins" on location_pins;
create policy "staff and sender read pins" on location_pins for select to authenticated
  using (is_staff() or sent_by = auth.uid());

-- Test / Live, as everywhere else (0036). The sender always sees their own.
drop policy if exists nbss_test_live on location_pins;
create policy nbss_test_live on location_pins as restrictive for select to authenticated
  using (sent_by = auth.uid() or is_test = (select data_test_view()));

-- Linking a pin to the site registered from it.
drop policy if exists "admins link pins" on location_pins;
create policy "admins link pins" on location_pins for update to authenticated
  using (is_admin()) with check (is_admin());

-- Deleting: staff any pin, the sender their own.
drop policy if exists "staff and sender delete pins" on location_pins;
create policy "staff and sender delete pins" on location_pins for delete to authenticated
  using (is_staff() or sent_by = auth.uid());

-- No insert policy: pins arrive only through this.
create or replace function send_location_pin(
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy_m real,
  p_age_s      integer,
  p_note       text default null,
  p_mocked     boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_id   uuid;
begin
  select role into v_role from profiles where id = auth.uid() and active;
  if v_role is null or v_role not in ('guard', 'supervisor', 'admin', 'developer') then
    raise exception 'Only staff can send a location.' using errcode = '42501';
  end if;
  if coalesce(p_mocked, false) then
    raise exception 'This phone reports a fake location. Turn off any mock-location app and try again.';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'The phone sent no usable location.';
  end if;
  if p_accuracy_m is null or p_accuracy_m > 100 then
    raise exception 'GPS is not precise enough yet (±% m). Step into the open and try again.', round(coalesce(p_accuracy_m, 0));
  end if;
  if p_age_s is null or p_age_s < 0 or p_age_s > 120 then
    raise exception 'That location is out of date. Try again.';
  end if;
  if (select count(*) from location_pins where sent_by = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Twenty locations sent in the last hour is the limit. Try again later.';
  end if;

  insert into location_pins (sent_by, lat, lng, accuracy_m, note, captured_at, is_test)
  values (auth.uid(), p_lat, p_lng, p_accuracy_m, nullif(left(btrim(p_note), 200), ''),
          now() - make_interval(secs => p_age_s), acting_as_test())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function send_location_pin(double precision, double precision, real, integer, text, boolean) from public, anon;
grant execute on function send_location_pin(double precision, double precision, real, integer, text, boolean) to authenticated;

-- Sites & geofences refreshes when a pin arrives or goes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'location_pins') then
    alter publication supabase_realtime add table public.location_pins;
  end if;
end $$;

notify pgrst, 'reload schema';
