-- The software fee on both sides of Test / Live, like everything else (0036).
--
-- Test invoices count test guards and are paid through Razorpay's test keys; live
-- invoices count real guards and are paid for real. Each side has its own months,
-- numbers (BKT-NBSS-TEST-… for test) and payments, so a developer can try paying in Test
-- without touching the real bill. And the seller's registration on every invoice.

alter table software_fee_invoices add column if not exists is_test boolean not null default false;
alter table software_fee_invoices drop constraint if exists software_fee_invoices_period_key;
create unique index if not exists software_fee_invoices_period_side on software_fee_invoices (period, is_test);

update software_fee_settings
set seller_name    = 'Bodookhrang Tech Private Limited',
    seller_gstin   = '18AAMCB2128H1ZP',
    seller_address = coalesce(seller_address, 'Kokrajhar, Assam');
alter table software_fee_settings add column if not exists seller_cin text default 'U58202AS2024PTC025748';
update software_fee_settings set seller_cin = 'U58202AS2024PTC025748' where seller_cin is null;

drop policy if exists nbss_test_live on software_fee_invoices;
create policy nbss_test_live on software_fee_invoices as restrictive for select to authenticated
  using (is_test = (select data_test_view()));

-- Brings one side's invoices up to date (the side the caller is looking at).
create or replace function software_fee_sync() returns void
language plpgsql security definer set search_path = public
as $$
declare
  s        software_fee_settings%rowtype;
  v_test   boolean := data_test_view();
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
  select count(*) into v_guards from profiles where role = 'guard' and active and is_test = v_test;

  v_month := s.billing_start;
  while v_month <= v_now loop
    if not exists (select 1 from software_fee_invoices where period = v_month and is_test = v_test) then
      v_amount := v_guards * s.per_guard_paise;
      v_gst := round(v_amount * s.gst_percent / 100);
      insert into software_fee_invoices (number, period, is_test, guards, per_guard_paise, amount_paise, gst_percent, gst_paise, total_paise, due_on)
      values ('BKT-NBSS-' || case when v_test then 'TEST-' else '' end || to_char(v_month, 'YYYYMM'), v_month, v_test,
              v_guards, s.per_guard_paise, v_amount, s.gst_percent, v_gst, v_amount + v_gst, v_month + (s.due_day - 1));
    elsif v_month = v_now then
      update software_fee_invoices
      set guards = v_guards, per_guard_paise = s.per_guard_paise, amount_paise = v_guards * s.per_guard_paise,
          gst_percent = s.gst_percent, gst_paise = round(v_guards * s.per_guard_paise * s.gst_percent / 100),
          total_paise = v_guards * s.per_guard_paise + round(v_guards * s.per_guard_paise * s.gst_percent / 100),
          due_on = v_month + (s.due_day - 1), updated_at = now()
      where period = v_month and is_test = v_test and status = 'unpaid';
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
end;
$$;
