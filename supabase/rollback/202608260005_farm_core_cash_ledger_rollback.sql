begin;

drop trigger if exists sale_hard_delete_guard on public.sale;
drop trigger if exists expense_hard_delete_guard on public.expense;
drop trigger if exists plot_hard_delete_guard on public.plot;
drop trigger if exists farm_hard_delete_guard on public.farm;
drop trigger if exists farmer_hard_delete_guard on public.farmer;

drop function if exists private.reject_hard_deletion();

drop function if exists public.get_my_cash_ledger_summary(uuid, date, date);
drop function if exists public.soft_delete_sale(uuid, text);
drop function if exists public.create_sale(uuid, uuid, date, text, numeric, numeric, numeric, text);
drop function if exists public.list_my_sales(uuid, date, date, boolean);
drop function if exists public.soft_delete_expense(uuid, text);
drop function if exists public.create_expense(uuid, uuid, text, numeric, date, text);
drop function if exists public.list_my_expenses(uuid, date, date, boolean);
drop function if exists public.soft_delete_plot(uuid, text);
drop function if exists public.update_plot(uuid, text, text, numeric);
drop function if exists public.create_plot(uuid, text, text, numeric);
drop function if exists public.list_my_plots(uuid);
drop function if exists public.soft_delete_farm(uuid, text);
drop function if exists public.update_farm(uuid, text, text, numeric);
drop function if exists public.create_farm(text, text, numeric);
drop function if exists public.list_my_farms();
drop function if exists public.ensure_farmer_profile(text, text);

drop table if exists public.sale cascade;
drop table if exists public.expense cascade;
drop table if exists public.plot cascade;
drop table if exists public.farm cascade;
drop table if exists public.farmer cascade;

commit;
