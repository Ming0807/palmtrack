begin;

do $$
begin
  if to_regclass('public.population_import') is null
    or to_regclass('public.population_member') is null
  then
    raise exception 'population import rollback requires migration 202608250002';
  end if;
end
$$;

set local role palmtrack_transaction_owner;
drop function public.create_population_import(text, text, date, text, text, text, jsonb, uuid);
drop function public.accept_population_import(uuid);
drop function public.list_population_imports();
reset role;

drop table public.population_member;
drop table public.population_import;
drop type public.population_import_status;

set local role palmtrack_transaction_owner;
drop function private.guard_population_import_update();
drop function private.reject_population_mutation();
reset role;

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
    else null
  end;

  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'audit details must be an object';
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
    else true
  end) then
    raise exception using
      errcode = '22023',
      message = 'audit detail values are invalid';
  end if;

  v_event_id := gen_random_uuid();
  insert into public.audit_event (
    id,
    workspace_id,
    actor_profile_id,
    action_code,
    entity_type,
    entity_id,
    result,
    details
  ) values (
    v_event_id,
    p_workspace_id,
    p_actor_profile_id,
    p_action_code,
    p_entity_type,
    p_entity_id,
    p_result,
    coalesce(p_details, '{}'::jsonb)
  );

  return v_event_id;
end;
$$;

reset role;

commit;
