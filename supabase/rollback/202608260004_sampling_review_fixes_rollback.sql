begin;

drop function if exists public.create_sampling_draft(uuid, text, text, text, text, bigint, text, jsonb, jsonb, uuid);

drop trigger if exists sampling_run_replay_guard on public.sampling_run;
drop trigger if exists sampling_margin_text_guard on public.sampling_run;
drop function if exists private.guard_sampling_replay();
drop function if exists private.set_sampling_margin_text();
drop function if exists private.replay_sampling_contract(uuid, uuid, text, text, bigint, text, text, jsonb, jsonb);
drop function if exists private.uint32_imul(bigint, bigint);
drop function if exists private.canonical_margin_of_error_text(text);

-- Restore the pre-review lock body. Dropping the replay helper without this
-- replacement would leave the existing public signature pointing at a missing
-- private function.
set local role palmtrack_transaction_owner;

drop function public.list_sampling_runs();

create function public.list_sampling_runs()
returns table (
  id uuid, version bigint, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, algorithm_version text,
  ordered_result_hash text,
  status public.sampling_run_status,
  created_at timestamptz, updated_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, allocation_evidence jsonb
)
language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager', 'evaluator_readonly') or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  return query
  select run.id, run.version, run.population_size,
    run.margin_of_error, run.unrounded_result, run.rounding_rule, run.target_n,
    run.formula_version, run.stratum_definition_version, run.algorithm_version,
    run.ordered_result_hash,
    run.status, run.created_at, run.updated_at, run.locked_at, run.activated_at,
    run.superseded_at, run.cancelled_at,
    coalesce((select jsonb_agg(to_jsonb(allocation) - 'id' - 'sampling_run_id' - 'workspace_id' order by allocation.stratum_code)
      from public.sampling_allocation allocation where allocation.sampling_run_id = run.id), '[]'::jsonb)
  from public.sampling_run run
  where run.workspace_id = v_workspace
  order by run.version desc;
end;
$$;

revoke all on function public.list_sampling_runs()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function public.list_sampling_runs() to authenticated;

create or replace function public.lock_sampling_run(p_run_id uuid, p_expected_updated_at timestamptz)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, ordered_result_hash text, status public.sampling_run_status,
  created_at timestamptz, updated_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_workspace uuid := public.current_workspace_id();
  v_run public.sampling_run%rowtype;
begin
  if public.current_role() is distinct from 'research_manager'::public.app_role or v_actor is null or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select run.* into v_run
  from public.sampling_run as run
  where run.id = p_run_id and run.workspace_id = v_workspace
  for update;
  if not found or v_run.status is distinct from 'draft' then
    raise exception using errcode = '42501', message = 'sampling run transition is not permitted';
  end if;
  if p_expected_updated_at is null or v_run.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'sampling run changed since evidence read';
  end if;
  perform set_config('palmtrack.sampling_transition', 'lock', true);
  update public.sampling_run set status = 'locked', locked_by = v_actor, locked_at = statement_timestamp(), updated_at = statement_timestamp() where public.sampling_run.id = v_run.id;
  perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_locked', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', 'draft', 'after_status', 'locked', 'input_digest', (select population_import.input_digest from public.population_import as population_import where population_import.id = v_run.population_import_id),
    'population_size', v_run.population_size, 'target_n', v_run.target_n, 'algorithm_version', v_run.algorithm_version,
    'candidate_set_hash', v_run.ordered_candidate_set_hash,
    'ordered_result_digest_version', v_run.result_evidence ->> 'ordered_result_digest_version',
    'ordered_result_hash', v_run.ordered_result_hash
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;
alter function public.lock_sampling_run(uuid, timestamptz) owner to palmtrack_transaction_owner;
revoke all on function public.lock_sampling_run(uuid, timestamptz) from public, anon, service_role, palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function public.lock_sampling_run(uuid, timestamptz) to authenticated;

reset role;

alter table public.sampling_run
  drop constraint if exists sampling_run_margin_of_error_text_check,
  drop column if exists margin_of_error_text;

commit;
