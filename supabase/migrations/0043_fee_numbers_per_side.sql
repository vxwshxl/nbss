-- Test invoices read exactly like live ones (BKT-NBSS-202610 on both sides): the
-- developer is already in Test and wants to see what production will look like.
-- So an invoice number is unique per side, not across both.

alter table software_fee_invoices drop constraint if exists software_fee_invoices_number_key;
create unique index if not exists software_fee_invoices_number_side on software_fee_invoices (number, is_test);
update software_fee_invoices set number = replace(number, 'BKT-NBSS-TEST-', 'BKT-NBSS-') where number like 'BKT-NBSS-TEST-%';

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
      values ('BKT-NBSS-' || to_char(v_month, 'YYYYMM'), v_month, v_test,
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
