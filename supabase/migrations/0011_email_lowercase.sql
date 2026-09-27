-- Sign-in looks addresses up by exact match on the lowercase form, and every
-- write path lowercases first. This makes that a rule rather than a habit, so
-- a mixed-case address can never be stored and then silently fail to match.
update profiles set email = lower(email) where email <> lower(email);

alter table profiles drop constraint if exists profiles_email_lowercase;
alter table profiles add constraint profiles_email_lowercase check (email = lower(email));
