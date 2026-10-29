-- ===========================================================================
-- Test data does not buzz real phones.
--
-- Test and Live are kept apart on every screen by RLS (nbss_test_live), but the
-- push queue is filled by functions that run as the owner: a test guard raising an
-- SOS, asking for cover or registering a phone pushed to the real supervisors, and
-- the SOS repeat (cron, no signed-in person) kept doing it every 30 seconds.
--
-- One rule at the queue, so every sender is covered, old and new: a push set off by
-- test data — the person acting is a test account, or the push is about a test
-- guard (its data names them as raised_by or guard_id) — is delivered only to test
-- accounts and developers. Everything live is untouched.
-- ===========================================================================

create or replace function push_outbox_keep_test_apart() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_test boolean;
begin
  v_test := exists (select 1 from profiles where id = auth.uid() and is_test);
  if not v_test and new.data is not null then
    v_test := exists (
      select 1 from profiles
      where is_test
        and id::text in (new.data ->> 'raised_by', new.data ->> 'guard_id')
    );
  end if;
  if v_test and not exists (select 1 from profiles where id = new.profile_id and (is_test or role = 'developer')) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists push_outbox_keep_test_apart on push_outbox;
create trigger push_outbox_keep_test_apart
  before insert on push_outbox
  for each row execute function push_outbox_keep_test_apart();
