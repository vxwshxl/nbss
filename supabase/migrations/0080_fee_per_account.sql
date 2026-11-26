-- ===========================================================================
-- Software fee: ₹30 a month for every active account, from December 2026.
--
-- Who is billed: every account that is switched on, used or not, except clients
-- and developers: guards, housekeepers, supervisors, administrators and field
-- officers. An account an administrator switches off stops counting from the next
-- month that is still open. Test accounts are billed only on the Test side.
--
-- November 2026 carries one line only: the app's Google Play listing, ₹1,000
-- once. GST is added on everything at the settings' rate (18%).
--
-- How a month's amount is fixed: while the month runs, its accounts are counted
-- live. It is locked when it is paid, or when the month ends (the first sync after
-- midnight IST on the 1st), and from then on keeps its count and lines for ever.
-- Paid and skipped months never change.
--
-- The rate is software_fee_settings.per_guard_paise (now "per account").
--
-- To lock months at midnight without waiting for someone to open the page, add
-- this once from the cluster's `postgres` database (pg_cron lives there):
--   select cron.schedule_in_database('nbss-fee-close-months', '5 18 * * *',
--          'select software_fee_close_months()', 'tenant_nbss');
-- ===========================================================================

alter table software_fee_settings
  add column if not exists account_billing_from date not null default '2026-12-01';

alter table software_fee_invoices
  add column if not exists lines jsonb not null default '[]'::jsonb,
  add column if not exists accounts jsonb,
  add column if not exists locked_at timestamptz;

comment on column software_fee_invoices.lines is
  'The invoice lines: [{label, tag?, qty, rate_paise, amount_paise}], frozen once the month is locked.';
comment on column software_fee_invoices.accounts is
  'Billed accounts by kind when the month was counted: {"guard":52,"housekeeping":2,...}.';

-- One-time or extra charges agreed for a month, each shown as its own line.
create table if not exists software_fee_extras (
  id           uuid primary key default gen_random_uuid(),
  period       date not null,
  is_test      boolean not null default false,
  label        text not null,
  tag          text,
  amount_paise integer not null check (amount_paise >= 0),
  created_at   timestamptz not null default now()
);
alter table software_fee_extras enable row level security;
drop policy if exists fee_extras_read on software_fee_extras;
create policy fee_extras_read on software_fee_extras for select to authenticated using (is_billing_viewer());

insert into software_fee_extras (period, is_test, label, tag, amount_paise)
select '2026-11-01', false, 'App publish on Google Play Store', 'One-time', 100000
where not exists (select 1 from software_fee_extras where period = '2026-11-01' and not is_test);

-- The billable accounts on one side, by kind.
create or replace function software_fee_accounts(p_test boolean)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
  from (
    select case when role = 'guard' and trade = 'housekeeping' then 'housekeeping' else role::text end as k,
           count(*) as n
    from profiles
    where active and is_test = p_test and role not in ('developer', 'client')
    group by 1
  ) t
$$;
revoke all on function software_fee_accounts(boolean) from public, anon;
grant execute on function software_fee_accounts(boolean) to authenticated, service_role;

-- Brings one side's invoices up to date: one per month from billing_start to this
-- month. Open months are recounted; ended months are locked; paid, skipped and
-- locked months are left exactly as they are.
create or replace function software_fee_sync_side(p_test boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s        software_fee_settings%rowtype;
  v_now    date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  v_month  date;
  v_acc    jsonb := software_fee_accounts(p_test);
  v_n      integer;
  v_inv    software_fee_invoices%rowtype;
  v_exists boolean;
  v_lines  jsonb;
  v_amount integer;
  v_gst    integer;
  v_billed boolean;
  x        record;
begin
  select * into s from software_fee_settings where id;
  select coalesce(sum(value::int), 0) into v_n from jsonb_each_text(v_acc);

  v_month := s.billing_start;
  while v_month <= v_now loop
    select * into v_inv from software_fee_invoices where period = v_month and is_test = p_test;
    v_exists := found;

    if not v_exists or (v_inv.status = 'unpaid' and v_inv.locked_at is null) then
      v_billed := v_month >= s.account_billing_from;
      v_lines := '[]'::jsonb;
      v_amount := 0;
      if v_billed then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'label', 'NBSS software · per active account', 'qty', v_n,
          'rate_paise', s.per_guard_paise, 'amount_paise', v_n * s.per_guard_paise));
        v_amount := v_n * s.per_guard_paise;
      end if;
      for x in select * from software_fee_extras where period = v_month and is_test = p_test order by created_at loop
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'label', x.label, 'tag', x.tag, 'qty', 1, 'rate_paise', x.amount_paise, 'amount_paise', x.amount_paise));
        v_amount := v_amount + x.amount_paise;
      end loop;
      v_gst := round(v_amount * s.gst_percent / 100);

      if not v_exists then
        insert into software_fee_invoices (number, period, is_test, guards, per_guard_paise, amount_paise, gst_percent,
                                           gst_paise, total_paise, due_on, lines, accounts, locked_at)
        values ('BKT-NBSS-' || to_char(v_month, 'YYYYMM'), v_month, p_test,
                case when v_billed then v_n else 0 end, case when v_billed then s.per_guard_paise else 0 end,
                v_amount, s.gst_percent, v_gst, v_amount + v_gst, v_month + (s.due_day - 1),
                v_lines, case when v_billed then v_acc end, case when v_month < v_now then now() end);
      else
        update software_fee_invoices
        set guards = case when v_billed then v_n else 0 end,
            per_guard_paise = case when v_billed then s.per_guard_paise else 0 end,
            amount_paise = v_amount, gst_percent = s.gst_percent, gst_paise = v_gst, total_paise = v_amount + v_gst,
            due_on = v_month + (s.due_day - 1), lines = v_lines, accounts = case when v_billed then v_acc end,
            locked_at = case when v_month < v_now then now() end, updated_at = now()
        where id = v_inv.id and status = 'unpaid' and locked_at is null;
      end if;
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
end;
$$;
revoke all on function software_fee_sync_side(boolean) from public, anon, authenticated;

-- The page's call: the viewer's own side.
create or replace function software_fee_sync()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_billing_viewer() and auth.uid() is not null then
    raise exception 'Only an administrator can see the software fee.' using errcode = '42501';
  end if;
  perform software_fee_sync_side(data_test_view());
end;
$$;

-- The nightly close (cron): both sides, so a month locks at midnight even unopened.
create or replace function software_fee_close_months()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform software_fee_sync_side(false);
  perform software_fee_sync_side(true);
end;
$$;
revoke all on function software_fee_close_months() from public, anon, authenticated;

-- A month paid keeps the figures it was paid on.
create or replace function software_fee_lock_on_pay()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.status = 'paid' and old.status <> 'paid' and new.locked_at is null then
    new.locked_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists software_fee_lock_on_pay on software_fee_invoices;
create trigger software_fee_lock_on_pay before update on software_fee_invoices
  for each row execute function software_fee_lock_on_pay();

-- Sign-in: a name and mobile that match an account that is switched off, so the
-- app and website can say "inactive" rather than "no account".
create or replace function worker_inactive_for_sign_in(p_name text, p_mobile text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where not p.active
      and p.role <> 'client'
      and lower(regexp_replace(regexp_replace(p.full_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
        = lower(regexp_replace(regexp_replace(p_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
      and length(p_mobile) = 10
      and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = p_mobile
  )
$$;
revoke all on function worker_inactive_for_sign_in(text, text) from public, anon, authenticated;
grant execute on function worker_inactive_for_sign_in(text, text) to service_role;

-- Bring the live side up to date now: November becomes the Play listing line.
select software_fee_sync_side(false);
