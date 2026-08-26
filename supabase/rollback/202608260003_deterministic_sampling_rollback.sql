begin;

drop function if exists public.get_sampling_candidates(uuid);
drop function if exists public.get_sampling_run_evidence(uuid);
drop function if exists public.regenerate_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid);
drop function if exists public.update_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid);
drop function if exists public.list_sampling_runs();
drop function if exists public.cancel_sampling_run(uuid, text);
drop function if exists public.activate_sampling_run(uuid);
drop function if exists public.lock_sampling_run(uuid);
drop function if exists public.create_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid);
drop function if exists private.sampling_run_result(uuid);
drop function if exists private.validate_sampling_evidence_shape(jsonb, jsonb);

drop trigger if exists sampling_draft_update_truncate_guard on public.sampling_draft_update;
drop trigger if exists sampling_draft_update_delete_guard on public.sampling_draft_update;
drop trigger if exists sampling_draft_update_update_guard on public.sampling_draft_update;
drop trigger if exists sampling_draft_update_insert_guard on public.sampling_draft_update;

drop trigger if exists sample_member_truncate_guard on public.sample_member;
drop trigger if exists sample_member_delete_guard on public.sample_member;
drop trigger if exists sample_member_update_guard on public.sample_member;
drop trigger if exists sample_member_insert_guard on public.sample_member;
drop trigger if exists sampling_allocation_truncate_guard on public.sampling_allocation;
drop trigger if exists sampling_allocation_delete_guard on public.sampling_allocation;
drop trigger if exists sampling_allocation_update_guard on public.sampling_allocation;
drop trigger if exists sampling_allocation_insert_guard on public.sampling_allocation;
drop trigger if exists sampling_run_truncate_guard on public.sampling_run;
drop trigger if exists sampling_run_delete_guard on public.sampling_run;
drop trigger if exists sampling_run_update_guard on public.sampling_run;
drop trigger if exists sampling_run_insert_guard on public.sampling_run;

drop function if exists private.guard_sampling_run_update();
drop function if exists private.guard_sampling_insert();
drop function if exists private.reject_sampling_mutation();

drop table if exists public.sample_member;
drop table if exists public.sampling_allocation;
drop table if exists public.sampling_draft_update;
drop table if exists public.sampling_run;

alter table public.population_member
  drop constraint if exists population_member_id_workspace_unique;

drop type if exists public.sampling_run_status;

set local role palmtrack_audit_writer;

create or replace function private.append_audit_event(
  p_workspace_id uuid,
  p_actor_profile_id uuid,
  p_action_code text,
  p_entity_type text,
  p_entity_id uuid,
  p_result text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event_id uuid;
  v_allowed_keys text[];
begin
  v_allowed_keys := case p_action_code
    when 'workspace.bootstrap' then array['status']::text[]
    when 'identity.profile_access_updated' then array[
      'before_role', 'after_role', 'before_status', 'after_status'
    ]::text[]
    when 'workspace.name_updated' then array['before_name', 'after_name']::text[]
    when 'identity.auth_user_relinked' then array[
      'reason_digest', 'recovery_reference_digest'
    ]::text[]
    when 'population.import_created' then array[
      'before_status', 'after_status', 'total_count', 'eligible_count',
      'excluded_count', 'input_digest', 'schema_version',
      'eligibility_rule_version', 'source_authorization_ref_digest'
    ]::text[]
    when 'population.import_accepted' then array[
      'before_status', 'after_status', 'total_count', 'eligible_count',
      'excluded_count', 'input_digest', 'schema_version',
      'eligibility_rule_version', 'source_authorization_ref_digest'
    ]::text[]
    else null
  end;

  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'audit details must be an object';
  end if;

  if v_allowed_keys is null
    or (
      select count(*)
      from pg_catalog.jsonb_object_keys(coalesce(p_details, '{}'::jsonb))
    ) <> cardinality(v_allowed_keys)
    or exists (
      select 1
      from jsonb_object_keys(coalesce(p_details, '{}'::jsonb)) as detail_key
      where detail_key <> all(v_allowed_keys)
    )
  then
    raise exception using
      errcode = '22023',
      message = 'audit action or detail keys are not allowlisted';
  end if;

  if (case p_action_code
    when 'workspace.bootstrap' then
      p_details <> '{"status":"active"}'::jsonb
    when 'identity.profile_access_updated' then
      coalesce(p_details ->> 'before_role', '') <> all(array[
        'admin', 'research_manager', 'field_collector', 'farmer', 'evaluator_readonly'
      ]::text[])
      or coalesce(p_details ->> 'after_role', '') <> all(array[
        'admin', 'research_manager', 'field_collector', 'farmer', 'evaluator_readonly'
      ]::text[])
      or coalesce(p_details ->> 'before_status', '') <> all(array['active', 'inactive']::text[])
      or coalesce(p_details ->> 'after_status', '') <> all(array['active', 'inactive']::text[])
    when 'workspace.name_updated' then
      jsonb_typeof(p_details -> 'before_name') is distinct from 'string'
      or jsonb_typeof(p_details -> 'after_name') is distinct from 'string'
      or char_length(p_details ->> 'before_name') not between 1 and 120
      or char_length(p_details ->> 'after_name') not between 1 and 120
    when 'identity.auth_user_relinked' then
      coalesce(p_details ->> 'reason_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'recovery_reference_digest', '') !~ '^[0-9a-f]{64}$'
    when 'population.import_created' then
      p_entity_type <> 'population_import'
      or coalesce(p_details ->> 'before_status', '') <> 'none'
      or coalesce(p_details ->> 'after_status', '') <> 'validated'
      or coalesce(p_details ->> 'total_count', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'eligible_count', '') !~ '^[0-9]+$'
      or coalesce(p_details ->> 'excluded_count', '') !~ '^[0-9]+$'
      or (p_details ->> 'eligible_count')::integer + (p_details ->> 'excluded_count')::integer <> (p_details ->> 'total_count')::integer
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'schema_version', '') <> 'synthetic-population-v1'
      or coalesce(p_details ->> 'eligibility_rule_version', '') <> 'synthetic-eligibility-v1'
      or coalesce(p_details ->> 'source_authorization_ref_digest', '') !~ '^[0-9a-f]{64}$'
    when 'population.import_accepted' then
      p_entity_type <> 'population_import'
      or coalesce(p_details ->> 'before_status', '') <> 'validated'
      or coalesce(p_details ->> 'after_status', '') <> 'accepted'
      or coalesce(p_details ->> 'total_count', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'eligible_count', '') !~ '^[0-9]+$'
      or coalesce(p_details ->> 'excluded_count', '') !~ '^[0-9]+$'
      or (p_details ->> 'eligible_count')::integer + (p_details ->> 'excluded_count')::integer <> (p_details ->> 'total_count')::integer
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'schema_version', '') <> 'synthetic-population-v1'
      or coalesce(p_details ->> 'eligibility_rule_version', '') <> 'synthetic-eligibility-v1'
      or coalesce(p_details ->> 'source_authorization_ref_digest', '') !~ '^[0-9a-f]{64}$'
    else true
  end) then
    raise exception using errcode = '22023', message = 'audit detail values are invalid';
  end if;

  v_event_id := gen_random_uuid();
  insert into public.audit_event (
    id, workspace_id, actor_profile_id, action_code,
    entity_type, entity_id, result, details
  ) values (
    v_event_id, p_workspace_id, p_actor_profile_id, p_action_code,
    p_entity_type, p_entity_id, p_result, coalesce(p_details, '{}'::jsonb)
  );
  return v_event_id;
end;
$$;

reset role;
alter function private.append_audit_event(uuid, uuid, text, text, uuid, text, jsonb)
  owner to palmtrack_audit_writer;

commit;
