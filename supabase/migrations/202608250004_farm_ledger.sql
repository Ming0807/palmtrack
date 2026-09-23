begin;

create table public.farmer (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  owner_user_id uuid not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  updated_at timestamptz,
  constraint farmer_id_workspace_unique unique (id, workspace_id),
  constraint farmer_workspace_owner_unique unique (workspace_id, owner_user_id),
  constraint farmer_owner_workspace_fk
    foreign key (owner_user_id, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint farmer_created_by_workspace_fk
    foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict
);

create table public.farm (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  farmer_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  area_rai numeric(14,3) not null check (area_rai > 0),
  deleted_at timestamptz,
  delete_reason text,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  updated_at timestamptz,
  constraint farm_id_workspace_unique unique (id, workspace_id),
  constraint farm_farmer_name_unique unique (farmer_id, name),
  constraint farm_farmer_workspace_fk
    foreign key (farmer_id, workspace_id)
    references public.farmer (id, workspace_id)
    on delete restrict,
  constraint farm_created_by_workspace_fk
    foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint farm_delete_state_check check (
    (deleted_at is null and delete_reason is null)
    or (deleted_at is not null and char_length(btrim(delete_reason)) between 1 and 200)
  )
);

create table public.plot (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  farm_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  area_rai numeric(14,3) not null check (area_rai > 0),
  deleted_at timestamptz,
  delete_reason text,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  updated_at timestamptz,
  constraint plot_id_workspace_unique unique (id, workspace_id),
  constraint plot_farm_name_unique unique (farm_id, name),
  constraint plot_farm_workspace_fk
    foreign key (farm_id, workspace_id)
    references public.farm (id, workspace_id)
    on delete restrict,
  constraint plot_created_by_workspace_fk
    foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint plot_delete_state_check check (
    (deleted_at is null and delete_reason is null)
    or (deleted_at is not null and char_length(btrim(delete_reason)) between 1 and 200)
  )
);

create index farm_workspace_farmer_idx
  on public.farm (workspace_id, farmer_id, created_at);
create index plot_workspace_farm_idx
  on public.plot (workspace_id, farm_id, created_at);

alter table public.farmer enable row level security;
alter table public.farmer force row level security;
alter table public.farm enable row level security;
alter table public.farm force row level security;
alter table public.plot enable row level security;
alter table public.plot force row level security;

revoke all on table public.farmer, public.farm, public.plot
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.farmer, public.farm, public.plot
  to palmtrack_transaction_owner;

create policy farmer_internal_transactions
  on public.farmer
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create policy farm_internal_transactions
  on public.farm
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create policy plot_internal_transactions
  on public.plot
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create or replace function private.guard_farmer_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (to_jsonb(new) - array['display_name', 'updated_by', 'updated_at']::text[])
    = (to_jsonb(old) - array['display_name', 'updated_by', 'updated_at']::text[])
    and new.updated_by is not null
  then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'farmer profile transition is not permitted';
end;
$$;

create or replace function private.guard_farm_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.deleted_at is null
    and new.deleted_at is null
    and (to_jsonb(new) - array['name', 'area_rai', 'updated_by', 'updated_at']::text[])
      = (to_jsonb(old) - array['name', 'area_rai', 'updated_by', 'updated_at']::text[])
    and new.updated_by is not null
  then
    return new;
  end if;

  if old.deleted_at is null
    and new.deleted_at is not null
    and new.delete_reason is not null
    and (to_jsonb(new) - array['deleted_at', 'delete_reason', 'updated_by', 'updated_at']::text[])
      = (to_jsonb(old) - array['deleted_at', 'delete_reason', 'updated_by', 'updated_at']::text[])
    and new.updated_by is not null
  then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'farm transition is not permitted';
end;
$$;

create or replace function private.guard_plot_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.deleted_at is null
    and new.deleted_at is null
    and (to_jsonb(new) - array['name', 'area_rai', 'updated_by', 'updated_at']::text[])
      = (to_jsonb(old) - array['name', 'area_rai', 'updated_by', 'updated_at']::text[])
    and new.updated_by is not null
  then
    return new;
  end if;

  if old.deleted_at is null
    and new.deleted_at is not null
    and new.delete_reason is not null
    and (to_jsonb(new) - array['deleted_at', 'delete_reason', 'updated_by', 'updated_at']::text[])
      = (to_jsonb(old) - array['deleted_at', 'delete_reason', 'updated_by', 'updated_at']::text[])
    and new.updated_by is not null
  then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'plot transition is not permitted';
end;
$$;

create or replace function private.reject_farm_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'farm records are immutable outside audited transitions';
end;
$$;

revoke all on function private.guard_farmer_update(),
  private.guard_farm_update(),
  private.guard_plot_update(),
  private.reject_farm_mutation()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

create trigger farmer_update_guard
before update on public.farmer
for each row execute function private.guard_farmer_update();
create trigger farmer_delete_guard
before delete on public.farmer
for each row execute function private.reject_farm_mutation();
create trigger farmer_truncate_guard
before truncate on public.farmer
for each statement execute function private.reject_farm_mutation();

create trigger farm_update_guard
before update on public.farm
for each row execute function private.guard_farm_update();
create trigger farm_delete_guard
before delete on public.farm
for each row execute function private.reject_farm_mutation();
create trigger farm_truncate_guard
before truncate on public.farm
for each statement execute function private.reject_farm_mutation();

create trigger plot_update_guard
before update on public.plot
for each row execute function private.guard_plot_update();
create trigger plot_delete_guard
before delete on public.plot
for each row execute function private.reject_farm_mutation();
create trigger plot_truncate_guard
before truncate on public.plot
for each statement execute function private.reject_farm_mutation();

alter function private.guard_farmer_update()
  owner to palmtrack_transaction_owner;
alter function private.guard_farm_update()
  owner to palmtrack_transaction_owner;
alter function private.guard_plot_update()
  owner to palmtrack_transaction_owner;
alter function private.reject_farm_mutation()
  owner to palmtrack_transaction_owner;

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
    when 'sampling.draft_created' then array[
      'before_status', 'after_status', 'target_n', 'population_digest',
      'seed_digest', 'candidate_hash', 'algorithm_version'
    ]::text[]
    when 'sampling.locked' then array[
      'before_status', 'after_status', 'target_n', 'population_digest',
      'seed_digest', 'candidate_hash', 'algorithm_version'
    ]::text[]
    when 'sampling.activated' then array[
      'before_status', 'after_status', 'target_n', 'population_digest',
      'seed_digest', 'candidate_hash', 'algorithm_version'
    ]::text[]
    when 'sampling.superseded' then array[
      'before_status', 'after_status', 'target_n', 'population_digest',
      'seed_digest', 'candidate_hash', 'algorithm_version'
    ]::text[]
    when 'sampling.cancelled' then array[
      'before_status', 'after_status', 'target_n', 'population_digest',
      'seed_digest', 'candidate_hash', 'algorithm_version', 'cancel_reason_digest'
    ]::text[]
    when 'farm.farmer_created' then array[
      'before_status', 'after_status', 'display_name_digest'
    ]::text[]
    when 'farm.farm_created' then array[
      'before_status', 'after_status', 'area_rai', 'name_digest'
    ]::text[]
    when 'farm.farm_updated' then array[
      'before_status', 'after_status', 'area_rai', 'name_digest'
    ]::text[]
    when 'farm.farm_deleted' then array[
      'before_status', 'after_status', 'delete_reason_digest'
    ]::text[]
    when 'farm.plot_created' then array[
      'before_status', 'after_status', 'area_rai', 'name_digest'
    ]::text[]
    when 'farm.plot_updated' then array[
      'before_status', 'after_status', 'area_rai', 'name_digest'
    ]::text[]
    when 'farm.plot_deleted' then array[
      'before_status', 'after_status', 'delete_reason_digest'
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
      or (p_details ->> 'eligible_count')::integer
        + (p_details ->> 'excluded_count')::integer
        <> (p_details ->> 'total_count')::integer
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
      or (p_details ->> 'eligible_count')::integer
        + (p_details ->> 'excluded_count')::integer
        <> (p_details ->> 'total_count')::integer
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'schema_version', '') <> 'synthetic-population-v1'
      or coalesce(p_details ->> 'eligibility_rule_version', '') <> 'synthetic-eligibility-v1'
      or coalesce(p_details ->> 'source_authorization_ref_digest', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.draft_created' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'none'
      or coalesce(p_details ->> 'after_status', '') <> 'draft'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'population_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'seed_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
    when 'sampling.locked' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'draft'
      or coalesce(p_details ->> 'after_status', '') <> 'locked'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'population_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'seed_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
    when 'sampling.activated' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'locked'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'population_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'seed_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
    when 'sampling.superseded' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'superseded'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'population_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'seed_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
    when 'sampling.cancelled' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> all(array['draft', 'locked']::text[])
      or coalesce(p_details ->> 'after_status', '') <> 'cancelled'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'population_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'seed_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
      or coalesce(p_details ->> 'cancel_reason_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.farmer_created' then
      p_entity_type <> 'farmer'
      or coalesce(p_details ->> 'before_status', '') <> 'none'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'display_name_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.farm_created' then
      p_entity_type <> 'farm'
      or coalesce(p_details ->> 'before_status', '') <> 'none'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'area_rai', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or coalesce(p_details ->> 'name_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.farm_updated' then
      p_entity_type <> 'farm'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'area_rai', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or coalesce(p_details ->> 'name_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.farm_deleted' then
      p_entity_type <> 'farm'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'deleted'
      or coalesce(p_details ->> 'delete_reason_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.plot_created' then
      p_entity_type <> 'plot'
      or coalesce(p_details ->> 'before_status', '') <> 'none'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'area_rai', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or coalesce(p_details ->> 'name_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.plot_updated' then
      p_entity_type <> 'plot'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'area_rai', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or coalesce(p_details ->> 'name_digest', '') !~ '^[0-9a-f]{64}$'
    when 'farm.plot_deleted' then
      p_entity_type <> 'plot'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'deleted'
      or coalesce(p_details ->> 'delete_reason_digest', '') !~ '^[0-9a-f]{64}$'
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

create or replace function public.create_farmer_profile(p_display_name text)
returns table (
  id uuid,
  workspace_id uuid,
  display_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_farmer public.farmer%rowtype;
begin
  if v_role is null or v_role <> 'farmer' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if v_actor_profile_id is null or v_workspace_id is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'farmer display name is invalid';
  end if;

  select * into v_farmer
  from public.farmer
  where farmer.owner_user_id = v_actor_profile_id
    and farmer.workspace_id = v_workspace_id;
  if found then
    raise exception using errcode = '23505', message = 'farmer profile already exists';
  end if;

  insert into public.farmer (workspace_id, owner_user_id, display_name, created_by)
  values (v_workspace_id, v_actor_profile_id, v_name, v_actor_profile_id)
  returning * into v_farmer;

  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'farm.farmer_created', 'farmer', v_farmer.id, 'success',
    jsonb_build_object(
      'before_status', 'none', 'after_status', 'active',
      'display_name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex')
    )
  );

  return query select v_farmer.id, v_farmer.workspace_id, v_farmer.display_name, v_farmer.created_at;
end;
$$;

create or replace function public.create_farm(p_name text, p_area_rai numeric)
returns table (
  id uuid,
  farmer_id uuid,
  name text,
  area_rai numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_name text := btrim(coalesce(p_name, ''));
  v_farmer public.farmer%rowtype;
  v_farm public.farm%rowtype;
begin
  if v_role is null or v_role <> 'farmer' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if v_actor_profile_id is null or v_workspace_id is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select * into v_farmer
  from public.farmer
  where farmer.owner_user_id = v_actor_profile_id
    and farmer.workspace_id = v_workspace_id;
  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'farm name is invalid';
  end if;
  if p_area_rai is null or p_area_rai <= 0 or p_area_rai >= 100000000000
    or p_area_rai <> round(p_area_rai, 3) then
    raise exception using errcode = '22023', message = 'farm area is invalid';
  end if;

  insert into public.farm (workspace_id, farmer_id, name, area_rai, created_by)
  values (v_workspace_id, v_farmer.id, v_name, p_area_rai, v_actor_profile_id)
  returning * into v_farm;

  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'farm.farm_created', 'farm', v_farm.id, 'success',
    jsonb_build_object(
      'before_status', 'none', 'after_status', 'active',
      'area_rai', v_farm.area_rai::text,
      'name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex')
    )
  );

  return query select v_farm.id, v_farm.farmer_id, v_farm.name, v_farm.area_rai, v_farm.created_at;
end;
$$;

create or replace function public.list_farms()
returns table (
  id uuid,
  name text,
  area_rai numeric,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_farmer public.farmer%rowtype;
begin
  if v_role is null or v_role <> 'farmer' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select * into v_farmer
  from public.farmer
  where farmer.owner_user_id = v_actor_profile_id
    and farmer.workspace_id = v_workspace_id;
  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select farm.id, farm.name, farm.area_rai, farm.created_at
  from public.farm as farm
  where farm.farmer_id = v_farmer.id
    and farm.workspace_id = v_workspace_id
    and farm.deleted_at is null
  order by farm.created_at, farm.id;
end;
$$;

create or replace function public.delete_farm(p_farm_id uuid, p_reason text)
returns table (
  id uuid,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_farmer public.farmer%rowtype;
  v_farm public.farm%rowtype;
begin
  if v_role is null or v_role <> 'farmer' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select * into v_farmer
  from public.farmer
  where farmer.owner_user_id = v_actor_profile_id
    and farmer.workspace_id = v_workspace_id;
  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if char_length(v_reason) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'farm delete reason is invalid';
  end if;

  select * into v_farm
  from public.farm
  where farm.id = p_farm_id
    and farm.farmer_id = v_farmer.id
    and farm.workspace_id = v_workspace_id
    and farm.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  update public.farm
  set deleted_at = statement_timestamp(), delete_reason = v_reason,
    updated_by = v_actor_profile_id, updated_at = statement_timestamp()
  where farm.id = v_farm.id
  returning * into v_farm;

  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'farm.farm_deleted', 'farm', v_farm.id, 'success',
    jsonb_build_object(
      'before_status', 'active', 'after_status', 'deleted',
      'delete_reason_digest', encode(extensions.digest(convert_to(v_reason, 'UTF8'), 'sha256'), 'hex')
    )
  );

  return query select v_farm.id, v_farm.deleted_at;
end;
$$;

create or replace function public.create_plot(p_farm_id uuid, p_name text, p_area_rai numeric)
returns table (
  id uuid,
  farm_id uuid,
  name text,
  area_rai numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_name text := btrim(coalesce(p_name, ''));
  v_farmer public.farmer%rowtype;
  v_farm public.farm%rowtype;
  v_plot public.plot%rowtype;
begin
  if v_role is null or v_role <> 'farmer' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select * into v_farmer
  from public.farmer
  where farmer.owner_user_id = v_actor_profile_id
    and farmer.workspace_id = v_workspace_id;
  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select * into v_farm
  from public.farm
  where farm.id = p_farm_id
    and farm.farmer_id = v_farmer.id
    and farm.workspace_id = v_workspace_id
    and farm.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'plot name is invalid';
  end if;
  if p_area_rai is null or p_area_rai <= 0 or p_area_rai >= 100000000000
    or p_area_rai <> round(p_area_rai, 3) then
    raise exception using errcode = '22023', message = 'plot area is invalid';
  end if;

  insert into public.plot (workspace_id, farm_id, name, area_rai, created_by)
  values (v_workspace_id, v_farm.id, v_name, p_area_rai, v_actor_profile_id)
  returning * into v_plot;

  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'farm.plot_created', 'plot', v_plot.id, 'success',
    jsonb_build_object(
      'before_status', 'none', 'after_status', 'active',
      'area_rai', v_plot.area_rai::text,
      'name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex')
    )
  );

  return query select v_plot.id, v_plot.farm_id, v_plot.name, v_plot.area_rai, v_plot.created_at;
end;
$$;

comment on function public.create_farmer_profile(text)
  is 'Registers the caller farmer profile exactly once per workspace.';
comment on function public.create_farm(text, numeric)
  is 'Creates one owner farm with decimal area for the caller farmer only.';
comment on function public.list_farms()
  is 'Returns the caller farmer active farms in creation order.';
comment on function public.delete_farm(uuid, text)
  is 'Soft-deletes one owner farm with a required reason and audit.';
comment on function public.create_plot(uuid, text, numeric)
  is 'Creates one owner plot inside an active owner farm.';

revoke all on function
  public.create_farmer_profile(text),
  public.create_farm(text, numeric),
  public.list_farms(),
  public.delete_farm(uuid, text),
  public.create_plot(uuid, text, numeric)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function
  public.create_farmer_profile(text),
  public.create_farm(text, numeric),
  public.list_farms(),
  public.delete_farm(uuid, text),
  public.create_plot(uuid, text, numeric)
  to authenticated;
alter function public.create_farmer_profile(text)
  owner to palmtrack_transaction_owner;
alter function public.create_farm(text, numeric)
  owner to palmtrack_transaction_owner;
alter function public.list_farms()
  owner to palmtrack_transaction_owner;
alter function public.delete_farm(uuid, text)
  owner to palmtrack_transaction_owner;
alter function public.create_plot(uuid, text, numeric)
  owner to palmtrack_transaction_owner;

commit;
