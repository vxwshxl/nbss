-- A month can be skipped (a free or trial month): it stays on the list as "Skipped",
-- owes nothing, and can be un-skipped. Months keep coming: the next one appears on its
-- first day as before. Developer only.

alter table software_fee_invoices drop constraint if exists software_fee_invoices_status_check;
alter table software_fee_invoices add constraint software_fee_invoices_status_check check (status in ('unpaid', 'paid', 'skipped'));
alter table software_fee_invoices add column if not exists skip_note text;
