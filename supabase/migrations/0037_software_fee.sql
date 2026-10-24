-- The software fee: what NBSS pays BODOOKHRANG TECH PVT. LTD. for this software.
--
-- Billed monthly per guard: every active live guard (test accounts never count) at
-- the month's rate, ₹15 by default. A developer can change the rate (and GST); a month
-- already paid keeps the figures it was paid on. The current month's guard count is
-- live until it is paid; earlier unpaid months were frozen when the month ended.

create table if not exists software_fee_settings (
  id              boolean primary key default true check (id),
  per_guard_paise integer not null default 1500 check (per_guard_paise >= 0),
  gst_percent     numeric(5,2) not null default 0 check (gst_percent >= 0 and gst_percent <= 50),
  billing_start   date not null default date_trunc('month', now() at time zone 'Asia/Kolkata')::date,
  due_day         smallint not null default 15 check (due_day between 1 and 28),
  seller_name     text not null default 'BODOOKHRANG TECH PVT. LTD.',
  seller_gstin    text,
  seller_address  text,
  buyer_name      text not null default 'National Bodo Security Service (NBSS)',
  buyer_gstin     text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references profiles (id) on delete set null
);
insert into software_fee_settings (id) values (true) on conflict do nothing;

create table if not exists software_fee_invoices (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  period              date not null unique,            -- first day of the month billed
  guards              integer not null default 0,
  per_guard_paise     integer not null,
  amount_paise        integer not null,
  gst_percent         numeric(5,2) not null default 0,
  gst_paise           integer not null default 0,
  total_paise         integer not null,
  status              text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  due_on              date not null,
  paid_at             timestamptz,
  paid_by             uuid references profiles (id) on delete set null,
  razorpay_order_id   text,
  razorpay_payment_id text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table software_fee_settings enable row level security;
alter table software_fee_invoices enable row level security;

create or replace function is_billing_viewer() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and active and role in ('developer', 'admin')) $$;

drop policy if exists fee_settings_read on software_fee_settings;
create policy fee_settings_read on software_fee_settings for select to authenticated using (is_billing_viewer());
drop policy if exists fee_invoices_read on software_fee_invoices;
create policy fee_invoices_read on software_fee_invoices for select to authenticated using (is_billing_viewer());

-- Brings the invoices up to date: one per month from billing_start to this month.
-- Unpaid months are recomputed (the current one from today's guard count; earlier ones
-- from the count frozen at month end, i.e. left as they are once the month is over).
create or replace function software_fee_sync() returns void
language plpgsql security definer set search_path = public
as $$
declare
  s        software_fee_settings%rowtype;
  v_month  date;
  v_now    date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  v_guards integer;
  v_amount integer;
  v_gst    integer;
begin
  if not is_billing_viewer() and auth.uid() is not null then
    raise exception 'Only an administrator can see the software fee.' using errcode = '42501';
  end if;
  select * into s from software_fee_settings where id;
  select count(*) into v_guards from profiles where role = 'guard' and active and not is_test;

  v_month := s.billing_start;
  while v_month <= v_now loop
    if not exists (select 1 from software_fee_invoices where period = v_month) then
      v_amount := v_guards * s.per_guard_paise;
      v_gst := round(v_amount * s.gst_percent / 100);
      insert into software_fee_invoices (number, period, guards, per_guard_paise, amount_paise, gst_percent, gst_paise, total_paise, due_on)
      values ('BKT-NBSS-' || to_char(v_month, 'YYYYMM'), v_month, v_guards, s.per_guard_paise, v_amount, s.gst_percent, v_gst, v_amount + v_gst,
              v_month + (s.due_day - 1));
    elsif v_month = v_now then
      -- This month, unpaid: today's count and the current rate.
      update software_fee_invoices
      set guards = v_guards, per_guard_paise = s.per_guard_paise, amount_paise = v_guards * s.per_guard_paise,
          gst_percent = s.gst_percent, gst_paise = round(v_guards * s.per_guard_paise * s.gst_percent / 100),
          total_paise = v_guards * s.per_guard_paise + round(v_guards * s.per_guard_paise * s.gst_percent / 100),
          due_on = v_month + (s.due_day - 1), updated_at = now()
      where period = v_month and status = 'unpaid';
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
end;
$$;
revoke all on function software_fee_sync() from public, anon;
grant execute on function software_fee_sync() to authenticated;
