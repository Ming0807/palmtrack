begin;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'farmer')
    or not exists (select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'farm')
    or not exists (select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'plot') then
    raise exception using errcode = 'P0001', message = 'farm ledger tables do not exist; refusing rollback';
  end if;
end;
$$;

revoke all on function
  public.create_farmer_profile(text),
  public.create_farm(text, numeric),
  public.list_farms(),
  public.delete_farm(uuid, text),
  public.create_plot(uuid, text, numeric)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

drop function if exists public.create_plot(uuid, text, numeric);
drop function if exists public.delete_farm(uuid, text);
drop function if exists public.list_farms();
drop function if exists public.create_farm(text, numeric);
drop function if exists public.create_farmer_profile(text);

drop trigger if exists plot_truncate_guard on public.plot;
drop trigger if exists plot_delete_guard on public.plot;
drop trigger if exists plot_update_guard on public.plot;
drop trigger if exists farm_truncate_guard on public.farm;
drop trigger if exists farm_delete_guard on public.farm;
drop trigger if exists farm_update_guard on public.farm;
drop trigger if exists farmer_truncate_guard on public.farmer;
drop trigger if exists farmer_delete_guard on public.farmer;
drop trigger if exists farmer_update_guard on public.farmer;
drop function if exists private.reject_farm_mutation();
drop function if exists private.guard_plot_update();
drop function if exists private.guard_farm_update();
drop function if exists private.guard_farmer_update();

drop table if exists public.plot;
drop table if exists public.farm;
drop table if exists public.farmer;

commit;
