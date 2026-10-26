-- Test / Live reaches the realtime feed.
--
-- A developer's side came only from the x-nbss-mode request header. Realtime's change
-- feed checks row-level security with no request headers at all, so a developer
-- looking at Test data was treated as Live there and never heard about a test SOS
-- being raised or resolved (the page caught up only on a refresh). The side last
-- chosen is now kept on the profile and used whenever there is no header; the header,
-- when present, still decides.

alter table profiles add column dev_view_test boolean not null default false;

create or replace function data_test_view() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case
      when p.role = 'developer'
        then coalesce(
          (nullif(current_setting('request.headers', true), '')::json ->> 'x-nbss-mode') = 'test',
          p.dev_view_test
        )
      else p.is_test
    end
    from profiles p where p.id = auth.uid()
  ), false)
$$;
