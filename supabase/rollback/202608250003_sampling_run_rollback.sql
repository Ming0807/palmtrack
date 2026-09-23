begin;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'sampling_run')
    or not exists (select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'sample_member') then
    raise exception using errcode = 'P0001', message = 'sampling run tables do not exist; refusing rollback';
  end if;
end;
$$;

revoke all on function
  public.create_sampling_draft(uuid, numeric, text, text, text, bigint, text, jsonb, jsonb),
  public.lock_sampling_run(uuid, text, text),
  public.activate_sampling_run(uuid),
  public.cancel_sampling_run(uuid, text),
  public.list_sampling_runs(),
  public.get_sampling_run(uuid),
  public.list_sampling_members(uuid),
  public.list_population_members(uuid)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

drop function if exists public.list_population_members(uuid);
drop function if exists public.list_sampling_members(uuid);
drop function if exists public.get_sampling_run(uuid);
drop function if exists public.list_sampling_runs();
drop function if exists public.cancel_sampling_run(uuid, text);
drop function if exists public.activate_sampling_run(uuid);
drop function if exists public.lock_sampling_run(uuid, text, text);
drop function if exists public.create_sampling_draft(uuid, numeric, text, text, text, bigint, text, jsonb, jsonb);

drop trigger if exists sample_member_truncate_guard on public.sample_member;
drop trigger if exists sample_member_delete_guard on public.sample_member;
drop trigger if exists sample_member_update_guard on public.sample_member;
drop trigger if exists sampling_run_truncate_guard on public.sampling_run;
drop trigger if exists sampling_run_delete_guard on public.sampling_run;
drop trigger if exists sampling_run_update_guard on public.sampling_run;
drop function if exists private.reject_sampling_mutation();
drop function if exists private.guard_sampling_run_update();

drop table if exists public.sample_member;
drop table if exists public.sampling_run;
drop type if exists public.sampling_run_status;
alter table if exists public.population_member
  drop constraint if exists population_member_id_workspace_unique;

commit;
