begin;

create type public.sampling_run_status as enum (
  'draft',
  'locked',
  'active',
  'superseded',
  'cancelled'
);

alter table public.population_member
  add constraint population_member_id_workspace_unique unique (id, workspace_id);

create table public.sampling_run (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  version bigint not null check (version > 0),
  population_import_id uuid not null,
  population_size bigint not null check (population_size > 0),
  margin_of_error numeric not null check (margin_of_error > 0 and margin_of_error < 1),
  unrounded_result numeric not null check (unrounded_result > 0),
  rounding_rule text not null check (rounding_rule = 'ceil'),
  target_n bigint not null check (target_n > 0 and target_n <= population_size),
  formula_version text not null check (formula_version = 'yamane-v1'),
  stratum_definition_version text not null check (stratum_definition_version ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  seed_text text not null check (char_length(seed_text) between 1 and 200),
  seed_normalized text not null check (char_length(seed_normalized) between 1 and 200),
  seed_normalized_utf8_hex text not null check (seed_normalized_utf8_hex ~ '^(?:[0-9a-f]{2})+$'),
  seed_digest_hex text not null check (seed_digest_hex ~ '^[0-9a-f]{64}$'),
  seed_u32 bigint not null check (seed_u32 between 0 and 4294967295),
  algorithm_version text not null check (algorithm_version = 'sha256-mulberry32-fy-v1'),
  ordered_candidate_set_hash text not null check (ordered_candidate_set_hash ~ '^[0-9a-f]{64}$'),
  allocation_evidence jsonb not null check (jsonb_typeof(allocation_evidence) = 'array'),
  result_evidence jsonb not null check (jsonb_typeof(result_evidence) = 'object'),
  status public.sampling_run_status not null default 'draft',
  idempotency_key uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  locked_by uuid,
  locked_at timestamptz,
  activated_by uuid,
  activated_at timestamptz,
  superseded_by uuid,
  superseded_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancellation_reason_digest text check (cancellation_reason_digest is null or cancellation_reason_digest ~ '^[0-9a-f]{64}$'),
  constraint sampling_run_population_workspace_fk
    foreign key (population_import_id, workspace_id)
    references public.population_import (id, workspace_id)
    on delete restrict,
  constraint sampling_run_id_workspace_unique unique (id, workspace_id),
  constraint sampling_run_workspace_version_unique unique (workspace_id, version),
  constraint sampling_run_idempotency_unique unique (workspace_id, idempotency_key),
  constraint sampling_run_created_by_workspace_fk
    foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint sampling_run_locked_by_workspace_fk
    foreign key (locked_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint sampling_run_activated_by_workspace_fk
    foreign key (activated_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint sampling_run_superseded_by_workspace_fk
    foreign key (superseded_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint sampling_run_cancelled_by_workspace_fk
    foreign key (cancelled_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint sampling_run_state_metadata_check check (
    (status = 'draft' and locked_by is null and locked_at is null and activated_by is null and activated_at is null and superseded_by is null and superseded_at is null and cancelled_by is null and cancelled_at is null and cancellation_reason_digest is null)
    or
    (status = 'locked' and locked_by is not null and locked_at is not null and activated_by is null and activated_at is null and superseded_by is null and superseded_at is null and cancelled_by is null and cancelled_at is null and cancellation_reason_digest is null)
    or
    (status = 'active' and locked_by is not null and locked_at is not null and activated_by is not null and activated_at is not null and superseded_by is null and superseded_at is null and cancelled_by is null and cancelled_at is null and cancellation_reason_digest is null)
    or
    (status = 'superseded' and locked_by is not null and locked_at is not null and activated_by is not null and activated_at is not null and superseded_by is not null and superseded_at is not null and cancelled_by is null and cancelled_at is null and cancellation_reason_digest is null)
    or
    (status = 'cancelled' and cancelled_by is not null and cancelled_at is not null and cancellation_reason_digest is not null)
  )
);

create unique index sampling_run_one_active_workspace_idx
  on public.sampling_run (workspace_id)
  where status = 'active';

create index sampling_run_workspace_created_idx
  on public.sampling_run (workspace_id, created_at desc, id);

create table public.sampling_allocation (
  id uuid primary key default gen_random_uuid(),
  sampling_run_id uuid not null,
  workspace_id uuid not null,
  stratum_code text not null check (stratum_code ~ '^[A-Z0-9_-]{1,24}$'),
  eligible_count bigint not null check (eligible_count >= 0),
  quota numeric not null check (quota >= 0),
  floor_allocation bigint not null check (floor_allocation >= 0),
  remainder numeric not null check (remainder >= 0 and remainder < 1),
  final_allocation bigint not null check (final_allocation >= 0 and final_allocation <= eligible_count),
  constraint sampling_allocation_run_workspace_fk
    foreign key (sampling_run_id, workspace_id)
    references public.sampling_run (id, workspace_id)
    on delete restrict,
  constraint sampling_allocation_run_stratum_unique unique (sampling_run_id, stratum_code),
  constraint sampling_allocation_id_workspace_unique unique (id, workspace_id)
);

create index sampling_allocation_run_order_idx
  on public.sampling_allocation (sampling_run_id, stratum_code);

create table public.sample_member (
  id uuid primary key default gen_random_uuid(),
  sampling_run_id uuid not null,
  workspace_id uuid not null,
  population_member_id uuid not null,
  stratum_code text not null check (stratum_code ~ '^[A-Z0-9_-]{1,24}$'),
  selection_order bigint not null check (selection_order > 0),
  constraint sample_member_run_workspace_fk
    foreign key (sampling_run_id, workspace_id)
    references public.sampling_run (id, workspace_id)
    on delete restrict,
  constraint sample_member_population_workspace_fk
    foreign key (population_member_id, workspace_id)
    references public.population_member (id, workspace_id)
    on delete restrict,
  constraint sample_member_run_member_unique unique (sampling_run_id, population_member_id),
  constraint sample_member_run_order_unique unique (sampling_run_id, selection_order),
  constraint sample_member_id_workspace_unique unique (id, workspace_id)
);

create index sample_member_run_stratum_idx
  on public.sample_member (sampling_run_id, stratum_code, selection_order);

create table public.sampling_draft_update (
  id uuid primary key default gen_random_uuid(),
  sampling_run_id uuid not null,
  workspace_id uuid not null,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint sampling_draft_update_run_workspace_fk
    foreign key (sampling_run_id, workspace_id)
    references public.sampling_run (id, workspace_id)
    on delete restrict,
  constraint sampling_draft_update_actor_workspace_fk
    foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint sampling_draft_update_run_key_unique unique (sampling_run_id, idempotency_key),
  constraint sampling_draft_update_workspace_key_unique unique (workspace_id, idempotency_key),
  constraint sampling_draft_update_id_workspace_unique unique (id, workspace_id)
);

create index sampling_draft_update_run_created_idx
  on public.sampling_draft_update (sampling_run_id, created_at desc);

alter table public.sampling_run enable row level security;
alter table public.sampling_run force row level security;
alter table public.sampling_allocation enable row level security;
alter table public.sampling_allocation force row level security;
alter table public.sample_member enable row level security;
alter table public.sample_member force row level security;
alter table public.sampling_draft_update enable row level security;
alter table public.sampling_draft_update force row level security;

revoke all on table public.sampling_run, public.sampling_allocation, public.sample_member
  from public, anon, authenticated, service_role;
revoke all on table public.sampling_draft_update
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.sampling_run to palmtrack_transaction_owner;
grant select, insert, delete on table public.sampling_allocation, public.sample_member to palmtrack_transaction_owner;
grant select, insert on table public.sampling_draft_update to palmtrack_transaction_owner;

create policy sampling_run_internal_transactions
  on public.sampling_run for all to palmtrack_transaction_owner using (true) with check (true);
create policy sampling_allocation_internal_transactions
  on public.sampling_allocation for all to palmtrack_transaction_owner using (true) with check (true);
create policy sample_member_internal_transactions
  on public.sample_member for all to palmtrack_transaction_owner using (true) with check (true);
create policy sampling_draft_update_internal_transactions
  on public.sampling_draft_update for all to palmtrack_transaction_owner using (true) with check (true);

create or replace function private.reject_sampling_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_setting('palmtrack.sampling_transition', true) = 'regenerate'
    and tg_op in ('UPDATE', 'DELETE')
    and (
      (tg_table_name = 'sampling_allocation' and exists (
        select 1 from public.sampling_run as run
        where run.id = old.sampling_run_id
          and run.workspace_id = old.workspace_id
          and run.status = 'draft'
      ))
      or
      (tg_table_name = 'sample_member' and exists (
        select 1 from public.sampling_run as run
        where run.id = old.sampling_run_id
          and run.workspace_id = old.workspace_id
          and run.status = 'draft'
      ))
    ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception using errcode = '42501', message = 'sampling evidence is immutable';
end;
$$;

create or replace function private.guard_sampling_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_setting('palmtrack.sampling_transition', true) not in ('create', 'regenerate') then
    raise exception using errcode = '42501', message = 'sampling writes must use an approved transaction';
  end if;
  return new;
end;
$$;

create or replace function private.guard_sampling_run_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_transition text := current_setting('palmtrack.sampling_transition', true);
begin
  if v_transition = 'lock'
    and old.status = 'draft' and new.status = 'locked'
    and new.locked_by is not null and new.locked_at is not null
    and new.activated_by is null and new.activated_at is null
    and new.superseded_by is null and new.superseded_at is null
    and new.cancelled_by is null and new.cancelled_at is null
    and new.cancellation_reason_digest is null
    and (to_jsonb(new) - array['status', 'locked_by', 'locked_at', 'updated_at']::text[])
      = (to_jsonb(old) - array['status', 'locked_by', 'locked_at', 'updated_at']::text[])
  then
    return new;
  end if;

  if v_transition = 'regenerate'
    and old.status = 'draft' and new.status = 'draft'
    and new.workspace_id = old.workspace_id
    and new.population_import_id = old.population_import_id
    and new.version = old.version
    and new.idempotency_key = old.idempotency_key
    and new.created_by = old.created_by
    and new.created_at = old.created_at
    and new.locked_by is null and new.locked_at is null
    and new.activated_by is null and new.activated_at is null
    and new.superseded_by is null and new.superseded_at is null
    and new.cancelled_by is null and new.cancelled_at is null
    and new.cancellation_reason_digest is null
    and (to_jsonb(new) - array[
      'margin_of_error', 'unrounded_result', 'target_n', 'formula_version',
      'stratum_definition_version', 'seed_text', 'seed_normalized',
      'seed_normalized_utf8_hex', 'seed_digest_hex', 'seed_u32',
      'algorithm_version', 'ordered_candidate_set_hash', 'allocation_evidence',
      'result_evidence', 'updated_at'
    ]::text[])
      = (to_jsonb(old) - array[
        'margin_of_error', 'unrounded_result', 'target_n', 'formula_version',
        'stratum_definition_version', 'seed_text', 'seed_normalized',
        'seed_normalized_utf8_hex', 'seed_digest_hex', 'seed_u32',
        'algorithm_version', 'ordered_candidate_set_hash', 'allocation_evidence',
        'result_evidence', 'updated_at'
      ]::text[])
  then
    return new;
  end if;

  if v_transition = 'activate'
    and old.status = 'locked' and new.status = 'active'
    and new.locked_by = old.locked_by and new.locked_at = old.locked_at
    and new.activated_by is not null and new.activated_at is not null
    and new.superseded_by is null and new.superseded_at is null
    and new.cancelled_by is null and new.cancelled_at is null
    and new.cancellation_reason_digest is null
    and (to_jsonb(new) - array['status', 'activated_by', 'activated_at', 'updated_at']::text[])
      = (to_jsonb(old) - array['status', 'activated_by', 'activated_at', 'updated_at']::text[])
  then
    return new;
  end if;

  if v_transition = 'supersede'
    and old.status = 'active' and new.status = 'superseded'
    and new.locked_by = old.locked_by and new.locked_at = old.locked_at
    and new.activated_by = old.activated_by and new.activated_at = old.activated_at
    and new.superseded_by is not null and new.superseded_at is not null
    and new.cancelled_by is null and new.cancelled_at is null
    and new.cancellation_reason_digest is null
    and (to_jsonb(new) - array['status', 'superseded_by', 'superseded_at', 'updated_at']::text[])
      = (to_jsonb(old) - array['status', 'superseded_by', 'superseded_at', 'updated_at']::text[])
  then
    return new;
  end if;

  if v_transition = 'cancel'
    and old.status in ('draft', 'locked') and new.status = 'cancelled'
    and new.cancelled_by is not null and new.cancelled_at is not null
    and new.cancellation_reason_digest is not null
    and new.activated_by is null and new.activated_at is null
    and new.superseded_by is null and new.superseded_at is null
    and (to_jsonb(new) - array['status', 'cancelled_by', 'cancelled_at', 'cancellation_reason_digest', 'updated_at']::text[])
      = (to_jsonb(old) - array['status', 'cancelled_by', 'cancelled_at', 'cancellation_reason_digest', 'updated_at']::text[])
  then
    return new;
  end if;

  raise exception using errcode = '42501', message = 'sampling run lifecycle transition is not permitted';
end;
$$;

revoke all on function private.reject_sampling_mutation(), private.guard_sampling_insert(), private.guard_sampling_run_update()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

create trigger sampling_run_insert_guard
before insert on public.sampling_run for each row execute function private.guard_sampling_insert();
create trigger sampling_run_update_guard
before update on public.sampling_run for each row execute function private.guard_sampling_run_update();
create trigger sampling_run_delete_guard
before delete on public.sampling_run for each row execute function private.reject_sampling_mutation();
create trigger sampling_run_truncate_guard
before truncate on public.sampling_run for each statement execute function private.reject_sampling_mutation();
create trigger sampling_allocation_insert_guard
before insert on public.sampling_allocation for each row execute function private.guard_sampling_insert();
create trigger sampling_allocation_update_guard
before update on public.sampling_allocation for each row execute function private.reject_sampling_mutation();
create trigger sampling_allocation_delete_guard
before delete on public.sampling_allocation for each row execute function private.reject_sampling_mutation();
create trigger sampling_allocation_truncate_guard
before truncate on public.sampling_allocation for each statement execute function private.reject_sampling_mutation();
create trigger sample_member_insert_guard
before insert on public.sample_member for each row execute function private.guard_sampling_insert();
create trigger sample_member_update_guard
before update on public.sample_member for each row execute function private.reject_sampling_mutation();
create trigger sample_member_delete_guard
before delete on public.sample_member for each row execute function private.reject_sampling_mutation();
create trigger sample_member_truncate_guard
before truncate on public.sample_member for each statement execute function private.reject_sampling_mutation();
create trigger sampling_draft_update_insert_guard
before insert on public.sampling_draft_update for each row execute function private.guard_sampling_insert();
create trigger sampling_draft_update_update_guard
before update on public.sampling_draft_update for each row execute function private.reject_sampling_mutation();
create trigger sampling_draft_update_delete_guard
before delete on public.sampling_draft_update for each row execute function private.reject_sampling_mutation();
create trigger sampling_draft_update_truncate_guard
before truncate on public.sampling_draft_update for each statement execute function private.reject_sampling_mutation();

alter function private.reject_sampling_mutation() owner to palmtrack_transaction_owner;
alter function private.guard_sampling_insert() owner to palmtrack_transaction_owner;
alter function private.guard_sampling_run_update() owner to palmtrack_transaction_owner;

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
    when 'sampling.run_created' then array[
      'before_status', 'after_status', 'population_size', 'target_n',
      'input_digest', 'candidate_set_hash', 'algorithm_version'
    ]::text[]
    when 'sampling.run_locked' then array[
      'before_status', 'after_status', 'input_digest', 'candidate_set_hash',
      'result_digest'
    ]::text[]
    when 'sampling.run_activated' then array[
      'before_status', 'after_status', 'candidate_set_hash'
    ]::text[]
    when 'sampling.run_superseded' then array[
      'before_status', 'after_status', 'candidate_set_hash'
    ]::text[]
    when 'sampling.run_cancelled' then array[
      'before_status', 'after_status', 'reason_digest'
    ]::text[]
    when 'sampling.run_regenerated' then array[
      'before_status', 'after_status', 'input_digest', 'candidate_set_hash',
      'result_digest'
    ]::text[]
    else null
  end;

  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'audit details must be an object';
  end if;

  if v_allowed_keys is null
    or (select count(*) from pg_catalog.jsonb_object_keys(coalesce(p_details, '{}'::jsonb))) <> cardinality(v_allowed_keys)
    or exists (
      select 1 from jsonb_object_keys(coalesce(p_details, '{}'::jsonb)) as detail_key
      where detail_key <> all(v_allowed_keys)
    )
  then
    raise exception using errcode = '22023', message = 'audit action or detail keys are not allowlisted';
  end if;

  if (case p_action_code
    when 'workspace.bootstrap' then p_details <> '{"status":"active"}'::jsonb
    when 'identity.profile_access_updated' then
      coalesce(p_details ->> 'before_role', '') <> all(array['admin', 'research_manager', 'field_collector', 'farmer', 'evaluator_readonly']::text[])
      or coalesce(p_details ->> 'after_role', '') <> all(array['admin', 'research_manager', 'field_collector', 'farmer', 'evaluator_readonly']::text[])
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
    when 'sampling.run_created' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'none'
      or coalesce(p_details ->> 'after_status', '') <> 'draft'
      or coalesce(p_details ->> 'population_size', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
    when 'sampling.run_locked' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'draft'
      or coalesce(p_details ->> 'after_status', '') <> 'locked'
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'result_digest', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_activated' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'locked'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_superseded' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'superseded'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_cancelled' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') not in ('draft', 'locked')
      or coalesce(p_details ->> 'after_status', '') <> 'cancelled'
      or coalesce(p_details ->> 'reason_digest', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_regenerated' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'draft'
      or coalesce(p_details ->> 'after_status', '') <> 'draft'
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'result_digest', '') !~ '^[0-9a-f]{64}$'
    else true
  end) then
    raise exception using errcode = '22023', message = 'audit detail values are invalid';
  end if;

  v_event_id := gen_random_uuid();
  insert into public.audit_event (
    id, workspace_id, actor_profile_id, action_code, entity_type, entity_id, result, details
  ) values (
    v_event_id, p_workspace_id, p_actor_profile_id, p_action_code, p_entity_type, p_entity_id, p_result, coalesce(p_details, '{}'::jsonb)
  );
  return v_event_id;
end;
$$;

reset role;

create or replace function private.validate_sampling_evidence_shape(
  p_allocation_evidence jsonb,
  p_result_evidence jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_key text;
begin
  if jsonb_typeof(p_allocation_evidence) is distinct from 'array'
    or jsonb_typeof(p_result_evidence) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'sampling evidence shape is invalid';
  end if;

  if (select count(*) from jsonb_object_keys(p_result_evidence)) <> 17
    or exists (
      select 1 from jsonb_object_keys(p_result_evidence) as key
      where key <> all(array[
        'formula_version', 'population_size', 'margin_of_error', 'unrounded',
        'rounding_rule', 'target_n', 'seed_normalized', 'seed_normalized_utf8_hex',
        'seed_digest_hex', 'seed_u32', 'ordered_candidate_set_byte_stream_hex',
        'ordered_candidate_set_hash', 'initial_candidate_member_ids', 'swap_trace',
        'shuffled_member_ids', 'ordered_selected_members', 'ordered_selected_member_ids'
      ]::text[])
    ) then
    raise exception using errcode = '22023', message = 'result evidence keys are not allowlisted';
  end if;

  foreach v_key in array array[
    'population_size', 'target_n', 'seed_u32'
  ] loop
    if jsonb_typeof(p_result_evidence -> v_key) is distinct from 'number'
      or (p_result_evidence ->> v_key)::numeric <> trunc((p_result_evidence ->> v_key)::numeric)
      or (p_result_evidence ->> v_key)::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric then
      raise exception using errcode = '22023', message = 'result evidence integer field is invalid';
    end if;
  end loop;

  foreach v_key in array array[
    'formula_version', 'rounding_rule', 'seed_normalized', 'seed_normalized_utf8_hex',
    'seed_digest_hex', 'ordered_candidate_set_byte_stream_hex', 'ordered_candidate_set_hash'
  ] loop
    if jsonb_typeof(p_result_evidence -> v_key) is distinct from 'string' then
      raise exception using errcode = '22023', message = 'result evidence text field is invalid';
    end if;
  end loop;

  foreach v_key in array array[
    'margin_of_error', 'unrounded'
  ] loop
    if jsonb_typeof(p_result_evidence -> v_key) is distinct from 'number' then
      raise exception using errcode = '22023', message = 'result evidence numeric field is invalid';
    end if;
  end loop;

  foreach v_key in array array[
    'initial_candidate_member_ids', 'swap_trace', 'shuffled_member_ids',
    'ordered_selected_members', 'ordered_selected_member_ids'
  ] loop
    if jsonb_typeof(p_result_evidence -> v_key) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'result evidence array field is invalid';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'initial_candidate_member_ids') as item
    where jsonb_typeof(item) is distinct from 'string'
      or item #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'shuffled_member_ids') as item
    where jsonb_typeof(item) is distinct from 'string'
      or item #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'ordered_selected_member_ids') as item
    where jsonb_typeof(item) is distinct from 'string'
      or item #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception using errcode = '22023', message = 'result evidence member identifiers are invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'swap_trace') as item
    where jsonb_typeof(item) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(item)) <> 2
      or exists (select 1 from jsonb_object_keys(item) as key where key <> all(array['i', 'j']::text[]))
      or jsonb_typeof(item -> 'i') is distinct from 'number'
      or jsonb_typeof(item -> 'j') is distinct from 'number'
      or (item ->> 'i')::numeric <> trunc((item ->> 'i')::numeric)
      or (item ->> 'j')::numeric <> trunc((item ->> 'j')::numeric)
      or (item ->> 'i')::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric
      or (item ->> 'j')::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric
  ) then
    raise exception using errcode = '22023', message = 'swap trace evidence is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'ordered_selected_members') as item
    where jsonb_typeof(item) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(item)) <> 3
      or exists (select 1 from jsonb_object_keys(item) as key where key <> all(array['member_id', 'stratum_code', 'selection_order']::text[]))
      or jsonb_typeof(item -> 'member_id') is distinct from 'string'
      or item ->> 'member_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item -> 'stratum_code') is distinct from 'string'
      or jsonb_typeof(item -> 'selection_order') is distinct from 'number'
      or (item ->> 'selection_order')::numeric <> trunc((item ->> 'selection_order')::numeric)
      or (item ->> 'selection_order')::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric
  ) then
    raise exception using errcode = '22023', message = 'selected member evidence is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_allocation_evidence) as item
    where jsonb_typeof(item) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(item)) <> 6
      or exists (select 1 from jsonb_object_keys(item) as key where key <> all(array['stratum_code', 'eligible_count', 'quota', 'floor_allocation', 'remainder', 'final_allocation']::text[]))
      or jsonb_typeof(item -> 'stratum_code') is distinct from 'string'
      or jsonb_typeof(item -> 'eligible_count') is distinct from 'number'
      or jsonb_typeof(item -> 'quota') is distinct from 'number'
      or jsonb_typeof(item -> 'floor_allocation') is distinct from 'number'
      or jsonb_typeof(item -> 'remainder') is distinct from 'number'
      or jsonb_typeof(item -> 'final_allocation') is distinct from 'number'
      or (item ->> 'eligible_count')::numeric <> trunc((item ->> 'eligible_count')::numeric)
      or (item ->> 'floor_allocation')::numeric <> trunc((item ->> 'floor_allocation')::numeric)
      or (item ->> 'final_allocation')::numeric <> trunc((item ->> 'final_allocation')::numeric)
      or (item ->> 'eligible_count')::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric
      or (item ->> 'floor_allocation')::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric
      or (item ->> 'final_allocation')::numeric not between -9223372036854775808::numeric and 9223372036854775807::numeric
  ) then
    raise exception using errcode = '22023', message = 'allocation evidence shape is invalid';
  end if;

  if jsonb_array_length(p_result_evidence -> 'initial_candidate_member_ids')::numeric
      <> (p_result_evidence ->> 'population_size')::numeric
    or jsonb_array_length(p_result_evidence -> 'shuffled_member_ids')::numeric
      <> (p_result_evidence ->> 'population_size')::numeric
    or jsonb_array_length(p_result_evidence -> 'swap_trace')::numeric
      <> greatest((p_result_evidence ->> 'population_size')::numeric - 1, 0)
    or jsonb_array_length(p_result_evidence -> 'ordered_selected_members')::numeric
      <> (p_result_evidence ->> 'target_n')::numeric
    or jsonb_array_length(p_result_evidence -> 'ordered_selected_member_ids')::numeric
      <> (p_result_evidence ->> 'target_n')::numeric then
    raise exception using errcode = '22023', message = 'result evidence array lengths are invalid';
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(p_result_evidence -> 'initial_candidate_member_ids') as member_id
    group by member_id having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements_text(p_result_evidence -> 'shuffled_member_ids') as member_id
    group by member_id having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements_text(p_result_evidence -> 'ordered_selected_member_ids') as member_id
    group by member_id having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'result evidence member identifiers are not unique';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'swap_trace') with ordinality as trace(item, position)
    where (item ->> 'i')::numeric <> (p_result_evidence ->> 'population_size')::numeric - trace.position
      or (item ->> 'j')::numeric < 0
      or (item ->> 'j')::numeric > (item ->> 'i')::numeric
  ) then
    raise exception using errcode = '22023', message = 'shuffle trace order or range is invalid';
  end if;

  if (select jsonb_agg(item -> 'member_id' order by position)
      from jsonb_array_elements(p_result_evidence -> 'ordered_selected_members') with ordinality as selected(item, position))
      is distinct from p_result_evidence -> 'ordered_selected_member_ids' then
    raise exception using errcode = '22023', message = 'selected member identifiers are inconsistent';
  end if;
end;
$$;

revoke all on function private.validate_sampling_evidence_shape(jsonb, jsonb)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function private.validate_sampling_evidence_shape(jsonb, jsonb)
  to palmtrack_transaction_owner;
alter function private.validate_sampling_evidence_shape(jsonb, jsonb)
  owner to palmtrack_transaction_owner;

create or replace function private.sampling_run_result(p_run_id uuid)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    run.id, run.version, run.population_import_id, run.population_size,
    run.margin_of_error, run.unrounded_result, run.rounding_rule, run.target_n,
    run.formula_version, run.stratum_definition_version, run.seed_text, run.seed_normalized, run.seed_normalized_utf8_hex,
    run.seed_digest_hex, run.seed_u32, run.algorithm_version,
    run.ordered_candidate_set_hash, run.status, run.created_at, run.locked_at,
    run.activated_at, run.superseded_at, run.cancelled_at, run.cancellation_reason_digest,
    coalesce((select jsonb_agg(to_jsonb(allocation) - 'id' - 'sampling_run_id' - 'workspace_id' order by allocation.stratum_code) from public.sampling_allocation allocation where allocation.sampling_run_id = run.id), '[]'::jsonb),
    run.result_evidence
  from public.sampling_run run
  where run.id = p_run_id;
$$;

revoke all on function private.sampling_run_result(uuid) from public, anon, authenticated, service_role,
  palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function private.sampling_run_result(uuid) to palmtrack_transaction_owner;
alter function private.sampling_run_result(uuid) owner to palmtrack_transaction_owner;

create or replace function public.create_sampling_draft(
  p_population_import_id uuid,
  p_seed_text text,
  p_margin_of_error numeric,
  p_stratum_definition_version text,
  p_algorithm_version text,
  p_target_n bigint,
  p_ordered_candidate_set_hash text,
  p_allocation_evidence jsonb,
  p_result_evidence jsonb,
  p_idempotency_key uuid
)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_import public.population_import%rowtype;
  v_run public.sampling_run%rowtype;
  v_n bigint;
  v_unrounded numeric;
  v_expected_target bigint;
  v_seed_normalized text;
  v_seed_digest bytea;
  v_seed_digest_hex text;
  v_seed_u32 bigint;
  v_seed_utf8_hex text;
  v_candidate_stream_hex text;
  v_candidate_hash text;
  v_input_digest text;
  v_allocation_count integer;
  v_selected_count integer;
begin
  if v_role is distinct from 'research_manager'::public.app_role
    or v_actor_profile_id is null or v_workspace_id is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if p_population_import_id is null or p_idempotency_key is null
    or p_seed_text is null or char_length(p_seed_text) not between 1 and 200
    or p_margin_of_error is null or p_margin_of_error::text = 'NaN'
    or p_margin_of_error <= 0 or p_margin_of_error >= 1
    or p_stratum_definition_version is null
    or p_stratum_definition_version !~ '^[a-z0-9][a-z0-9._-]{2,63}$'
    or p_algorithm_version is distinct from 'sha256-mulberry32-fy-v1'
    or p_target_n is null or p_target_n <= 0
    or p_ordered_candidate_set_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_allocation_evidence) is distinct from 'array'
    or jsonb_typeof(p_result_evidence) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'sampling input is invalid';
  end if;
  select population_import.* into v_import
  from public.population_import as population_import
  where population_import.id = p_population_import_id
    and population_import.workspace_id = v_workspace_id
    and population_import.status = 'accepted';
  if not found then
    raise exception using errcode = '42501', message = 'accepted population snapshot is required';
  end if;
  perform private.validate_sampling_evidence_shape(p_allocation_evidence, p_result_evidence);

  select count(*)::bigint into v_n
  from public.population_member as eligible_member
  where eligible_member.population_import_id = v_import.id
    and eligible_member.workspace_id = v_workspace_id
    and eligible_member.eligible;
  if v_n <= 0 or v_n <> v_import.eligible_count then
    raise exception using errcode = '22023', message = 'population evidence is invalid';
  end if;
  v_unrounded := v_n::numeric / (1 + v_n::numeric * p_margin_of_error * p_margin_of_error);
  v_expected_target := ceil(v_unrounded)::bigint;
  if p_target_n <> v_expected_target or p_target_n > v_n then
    raise exception using errcode = '22023', message = 'sampling target is invalid';
  end if;

  select normalize(p_seed_text, NFC) into v_seed_normalized;
  v_seed_digest := extensions.digest(convert_to(v_seed_normalized, 'UTF8'), 'sha256');
  v_seed_digest_hex := encode(v_seed_digest, 'hex');
  v_seed_utf8_hex := encode(convert_to(v_seed_normalized, 'UTF8'), 'hex');
  v_seed_u32 := get_byte(v_seed_digest, 0)::bigint * 16777216
    + get_byte(v_seed_digest, 1)::bigint * 65536
    + get_byte(v_seed_digest, 2)::bigint * 256
    + get_byte(v_seed_digest, 3)::bigint;

  select
    string_agg(
      encode(
        pg_catalog.int4send(octet_length(convert_to(member.farmer_code, 'UTF8')))
        || convert_to(member.farmer_code, 'UTF8')
        || pg_catalog.int4send(octet_length(convert_to(member.stratum_code, 'UTF8')))
        || convert_to(member.stratum_code, 'UTF8'),
        'hex'
      ), '' order by convert_to(member.farmer_code, 'UTF8')
    )
  into v_candidate_stream_hex
  from public.population_member member
  where member.population_import_id = v_import.id and member.workspace_id = v_workspace_id and member.eligible;
  v_candidate_stream_hex := coalesce(v_candidate_stream_hex, '');
  v_candidate_hash := encode(extensions.digest(decode(v_candidate_stream_hex, 'hex'), 'sha256'), 'hex');
  if p_ordered_candidate_set_hash <> v_candidate_hash then
    raise exception using errcode = '22023', message = 'candidate set hash is invalid';
  end if;

  if p_result_evidence ->> 'formula_version' is distinct from 'yamane-v1'
    or (p_result_evidence ->> 'population_size')::bigint is distinct from v_n
    or (p_result_evidence ->> 'margin_of_error')::numeric is distinct from p_margin_of_error
    or (p_result_evidence ->> 'unrounded') is null
    or abs((p_result_evidence ->> 'unrounded')::numeric - v_unrounded) > 0.000000000000001
    or (p_result_evidence ->> 'target_n')::bigint is distinct from p_target_n
    or p_result_evidence ->> 'rounding_rule' is distinct from 'ceil'
    or p_result_evidence ->> 'seed_normalized' is distinct from v_seed_normalized
    or p_result_evidence ->> 'seed_normalized_utf8_hex' is distinct from v_seed_utf8_hex
    or p_result_evidence ->> 'seed_digest_hex' is distinct from v_seed_digest_hex
    or (p_result_evidence ->> 'seed_u32')::bigint is distinct from v_seed_u32
    or p_result_evidence ->> 'ordered_candidate_set_byte_stream_hex' is distinct from v_candidate_stream_hex
    or p_result_evidence ->> 'ordered_candidate_set_hash' is distinct from v_candidate_hash then
    raise exception using errcode = '22023', message = 'sampling result evidence is invalid';
  end if;

  if (select jsonb_agg(to_jsonb(member.id) order by convert_to(member.farmer_code, 'UTF8')) from public.population_member member where member.population_import_id = v_import.id and member.workspace_id = v_workspace_id and member.eligible)
      is distinct from p_result_evidence -> 'initial_candidate_member_ids' then
    raise exception using errcode = '22023', message = 'initial candidate evidence is invalid';
  end if;

  if jsonb_array_length(p_allocation_evidence) = 0
    or exists (
      select 1 from jsonb_array_elements(p_allocation_evidence) as row_item
      where jsonb_typeof(row_item) is distinct from 'object'
        or (select count(*) from jsonb_object_keys(row_item)) <> 6
        or exists (select 1 from jsonb_object_keys(row_item) as key where key <> all(array['stratum_code','eligible_count','quota','floor_allocation','remainder','final_allocation']::text[]))
    ) then
    raise exception using errcode = '22023', message = 'allocation evidence is invalid';
  end if;

  select count(*) into v_allocation_count
  from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint);
  if v_allocation_count <> (
      select count(distinct eligible_member.stratum_code)
      from public.population_member as eligible_member
      where eligible_member.population_import_id = v_import.id
        and eligible_member.workspace_id = v_workspace_id
        and eligible_member.eligible
    )
    or v_allocation_count <> (
      select count(distinct allocation.stratum_code)
      from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
    )
    or (select sum(allocation.eligible_count) from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)) <> v_n
    or (select sum(allocation.final_allocation) from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)) <> p_target_n
    or exists (
      select 1 from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
      where allocation.eligible_count < 0 or allocation.floor_allocation < 0 or allocation.final_allocation < 0
        or allocation.final_allocation > allocation.eligible_count
        or allocation.remainder < 0 or allocation.remainder >= 1
        or not exists (select 1 from public.population_member member where member.population_import_id = v_import.id and member.workspace_id = v_workspace_id and member.eligible and member.stratum_code = allocation.stratum_code)
    ) then
      raise exception using errcode = '22023', message = 'allocation totals or membership are invalid';
  end if;

  if exists (
    with allocation as (
      select row_number() over (
        order by
          (p_target_n::numeric * allocation.eligible_count::numeric) % v_n::numeric desc,
          convert_to(allocation.stratum_code, 'UTF8')
      ) as remainder_rank,
      allocation.stratum_code,
      allocation.eligible_count,
      allocation.quota,
      allocation.floor_allocation,
      allocation.remainder,
      allocation.final_allocation,
      floor(p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric)::bigint as expected_floor,
      (p_target_n - sum(floor(p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric)::bigint) over ())::bigint as remaining_seats
      from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
    )
    select 1
    from allocation
    where abs(allocation.quota - p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric) > 0.000000000000001
      or allocation.floor_allocation <> allocation.expected_floor
      or abs(allocation.remainder - (p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric - allocation.expected_floor)) > 0.000000000000001
      or allocation.final_allocation <> allocation.expected_floor
        + case when allocation.remainder_rank <= allocation.remaining_seats then 1 else 0 end
  ) then
    raise exception using errcode = '22023', message = 'allocation formula evidence is invalid';
  end if;

  if jsonb_array_length(p_result_evidence -> 'ordered_selected_members') <> p_target_n
    or jsonb_array_length(p_result_evidence -> 'ordered_selected_member_ids') <> p_target_n then
    raise exception using errcode = '22023', message = 'selected member totals are invalid';
  end if;
  select count(*) into v_selected_count
  from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint);
  if v_selected_count <> p_target_n
    or exists (
      select 1 from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)
      where selected.selection_order < 1 or selected.selection_order > p_target_n
        or not exists (select 1 from public.population_member member where member.id = selected.member_id and member.workspace_id = v_workspace_id and member.population_import_id = v_import.id and member.eligible and member.stratum_code = selected.stratum_code)
    )
    or (select count(distinct selected.member_id) from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)) <> p_target_n
    or (select count(distinct selected.selection_order) from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)) <> p_target_n then
    raise exception using errcode = '22023', message = 'selected member membership is invalid';
  end if;
  if (select jsonb_agg(to_jsonb(selected.member_id) order by selected.selection_order) from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint))
      is distinct from p_result_evidence -> 'ordered_selected_member_ids' then
    raise exception using errcode = '22023', message = 'selected member order evidence is invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
    where allocation.final_allocation <> (
      select count(*)
      from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)
      where selected.stratum_code = allocation.stratum_code
    )
  ) then
    raise exception using errcode = '22023', message = 'selected allocation membership is invalid';
  end if;

  if jsonb_array_length(p_result_evidence -> 'shuffled_member_ids') <> v_n
    or (select count(distinct shuffled.member_id) from jsonb_array_elements_text(p_result_evidence -> 'shuffled_member_ids') as shuffled(member_id)) <> v_n
    or exists (
      select 1
      from jsonb_array_elements_text(p_result_evidence -> 'shuffled_member_ids') as shuffled(member_id)
      where not exists (
        select 1 from public.population_member as member
        where member.id = shuffled.member_id::uuid
          and member.population_import_id = v_import.id
          and member.workspace_id = v_workspace_id
          and member.eligible
      )
    ) then
    raise exception using errcode = '22023', message = 'shuffled member evidence is invalid';
  end if;

  if jsonb_array_length(p_result_evidence -> 'swap_trace') <> greatest(v_n - 1, 0)
    or exists (
      select 1
      from jsonb_to_recordset(p_result_evidence -> 'swap_trace') as swap_trace(i bigint, j bigint)
      where swap_trace.i < 1 or swap_trace.i >= v_n or swap_trace.j < 0 or swap_trace.j > swap_trace.i
    ) then
    raise exception using errcode = '22023', message = 'shuffle trace evidence is invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_result_evidence -> 'swap_trace') with ordinality as trace(item, position)
    cross join lateral jsonb_to_record(trace.item) as swap_trace(i bigint, j bigint)
    where swap_trace.i <> v_n - trace.position
  ) then
    raise exception using errcode = '22023', message = 'shuffle trace order is invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || p_idempotency_key::text, 0));
  select existing_run.* into v_run
  from public.sampling_run as existing_run
  where existing_run.workspace_id = v_workspace_id
    and existing_run.idempotency_key = p_idempotency_key;
  if found then
    if v_run.population_import_id <> p_population_import_id or v_run.seed_text <> p_seed_text
      or v_run.margin_of_error <> p_margin_of_error or v_run.target_n <> p_target_n
      or v_run.stratum_definition_version <> p_stratum_definition_version
      or v_run.algorithm_version <> p_algorithm_version
      or v_run.ordered_candidate_set_hash <> p_ordered_candidate_set_hash
      or v_run.allocation_evidence <> p_allocation_evidence or v_run.result_evidence <> p_result_evidence then
      raise exception using errcode = '23505', message = 'idempotency key conflicts';
    end if;
    return query select * from private.sampling_run_result(v_run.id);
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('sampling-version:' || v_workspace_id::text, 0)
  );
  perform set_config('palmtrack.sampling_transition', 'create', true);
  select coalesce(max(run.version), 0) + 1 into v_run.version from public.sampling_run run where run.workspace_id = v_workspace_id;
  v_input_digest := v_import.input_digest;
  insert into public.sampling_run (
    workspace_id, version, population_import_id, population_size, margin_of_error,
    unrounded_result, rounding_rule, target_n, formula_version, seed_text,
    seed_normalized, seed_normalized_utf8_hex, seed_digest_hex, seed_u32,
    algorithm_version, stratum_definition_version, ordered_candidate_set_hash, allocation_evidence, result_evidence,
    idempotency_key, created_by
  ) values (
    v_workspace_id, v_run.version, v_import.id, v_n, p_margin_of_error,
    v_unrounded, 'ceil', p_target_n, 'yamane-v1', p_seed_text,
    v_seed_normalized, v_seed_utf8_hex, v_seed_digest_hex, v_seed_u32,
    p_algorithm_version, p_stratum_definition_version, p_ordered_candidate_set_hash, p_allocation_evidence, p_result_evidence,
    p_idempotency_key, v_actor_profile_id
  ) returning * into v_run;

  insert into public.sampling_allocation (sampling_run_id, workspace_id, stratum_code, eligible_count, quota, floor_allocation, remainder, final_allocation)
  select v_run.id, v_workspace_id, allocation.stratum_code, allocation.eligible_count, allocation.quota, allocation.floor_allocation, allocation.remainder, allocation.final_allocation
  from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint);

  insert into public.sample_member (sampling_run_id, workspace_id, population_member_id, stratum_code, selection_order)
  select v_run.id, v_workspace_id, selected.member_id, selected.stratum_code, selected.selection_order
  from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint);

  perform private.append_audit_event(v_workspace_id, v_actor_profile_id, 'sampling.run_created', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', 'none', 'after_status', 'draft', 'population_size', v_n,
    'target_n', p_target_n, 'input_digest', v_input_digest, 'candidate_set_hash', p_ordered_candidate_set_hash,
    'algorithm_version', p_algorithm_version
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;

create or replace function public.update_sampling_draft(
  p_run_id uuid,
  p_seed_text text,
  p_margin_of_error numeric,
  p_stratum_definition_version text,
  p_algorithm_version text,
  p_target_n bigint,
  p_ordered_candidate_set_hash text,
  p_allocation_evidence jsonb,
  p_result_evidence jsonb,
  p_idempotency_key uuid
)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_workspace uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_run public.sampling_run%rowtype;
  v_import public.population_import%rowtype;
  v_update public.sampling_draft_update%rowtype;
  v_n bigint;
  v_unrounded numeric;
  v_seed_normalized text;
  v_seed_digest bytea;
  v_seed_digest_hex text;
  v_seed_utf8_hex text;
  v_seed_u32 bigint;
  v_candidate_stream_hex text;
  v_candidate_hash text;
  v_request_digest text;
begin
  if v_role is distinct from 'research_manager'::public.app_role
    or v_actor is null or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if p_run_id is null or p_idempotency_key is null
    or p_seed_text is null or char_length(p_seed_text) not between 1 and 200
    or p_margin_of_error is null or p_margin_of_error::text = 'NaN'
    or p_margin_of_error <= 0 or p_margin_of_error >= 1
    or p_stratum_definition_version is null
    or p_stratum_definition_version !~ '^[a-z0-9][a-z0-9._-]{2,63}$'
    or p_algorithm_version is distinct from 'sha256-mulberry32-fy-v1'
    or p_target_n is null or p_target_n <= 0
    or p_ordered_candidate_set_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'sampling input is invalid';
  end if;
  perform private.validate_sampling_evidence_shape(p_allocation_evidence, p_result_evidence);

  select run.* into v_run
  from public.sampling_run as run
  where run.id = p_run_id and run.workspace_id = v_workspace
  for update;
  if not found or v_run.status is distinct from 'draft' then
    raise exception using errcode = '42501', message = 'only a draft sampling run can be regenerated';
  end if;
  select population_import.* into v_import
  from public.population_import as population_import
  where population_import.id = v_run.population_import_id
    and population_import.workspace_id = v_workspace
    and population_import.status = 'accepted';
  if not found then
    raise exception using errcode = '42501', message = 'accepted population snapshot is required';
  end if;

  v_request_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'seed_text', p_seed_text, 'margin_of_error', p_margin_of_error,
    'stratum_definition_version', p_stratum_definition_version,
    'algorithm_version', p_algorithm_version, 'target_n', p_target_n,
    'ordered_candidate_set_hash', p_ordered_candidate_set_hash,
    'allocation_evidence', p_allocation_evidence,
    'result_evidence', p_result_evidence
  )::text, 'UTF8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_workspace::text || ':' || p_run_id::text || ':' || p_idempotency_key::text, 0));
  select update.* into v_update
  from public.sampling_draft_update as update
  where update.workspace_id = v_workspace
    and update.idempotency_key = p_idempotency_key;
  if found then
    if v_update.sampling_run_id <> v_run.id or v_update.request_digest <> v_request_digest then
      raise exception using errcode = '23505', message = 'draft regeneration idempotency key conflicts';
    end if;
    return query select * from private.sampling_run_result(v_run.id);
    return;
  end if;

  select count(*)::bigint into v_n
  from public.population_member as member
  where member.population_import_id = v_import.id
    and member.workspace_id = v_workspace
    and member.eligible;
  if v_n <= 0 or v_n <> v_import.eligible_count then
    raise exception using errcode = '22023', message = 'population evidence is invalid';
  end if;
  v_unrounded := v_n::numeric / (1 + v_n::numeric * p_margin_of_error * p_margin_of_error);
  if p_target_n <> ceil(v_unrounded)::bigint or p_target_n > v_n then
    raise exception using errcode = '22023', message = 'sampling target is invalid';
  end if;
  select normalize(p_seed_text, NFC) into v_seed_normalized;
  v_seed_digest := extensions.digest(convert_to(v_seed_normalized, 'UTF8'), 'sha256');
  v_seed_digest_hex := encode(v_seed_digest, 'hex');
  v_seed_utf8_hex := encode(convert_to(v_seed_normalized, 'UTF8'), 'hex');
  v_seed_u32 := get_byte(v_seed_digest, 0)::bigint * 16777216
    + get_byte(v_seed_digest, 1)::bigint * 65536
    + get_byte(v_seed_digest, 2)::bigint * 256
    + get_byte(v_seed_digest, 3)::bigint;
  select string_agg(
    encode(
      pg_catalog.int4send(octet_length(convert_to(member.farmer_code, 'UTF8')))
      || convert_to(member.farmer_code, 'UTF8')
      || pg_catalog.int4send(octet_length(convert_to(member.stratum_code, 'UTF8')))
      || convert_to(member.stratum_code, 'UTF8'), 'hex'
    ), '' order by convert_to(member.farmer_code, 'UTF8')
  ) into v_candidate_stream_hex
  from public.population_member as member
  where member.population_import_id = v_import.id and member.workspace_id = v_workspace and member.eligible;
  v_candidate_stream_hex := coalesce(v_candidate_stream_hex, '');
  v_candidate_hash := encode(extensions.digest(decode(v_candidate_stream_hex, 'hex'), 'sha256'), 'hex');
  if p_ordered_candidate_set_hash <> v_candidate_hash
    or p_result_evidence ->> 'formula_version' is distinct from 'yamane-v1'
    or (p_result_evidence ->> 'population_size')::bigint is distinct from v_n
    or (p_result_evidence ->> 'margin_of_error')::numeric is distinct from p_margin_of_error
    or abs((p_result_evidence ->> 'unrounded')::numeric - v_unrounded) > 0.000000000000001
    or (p_result_evidence ->> 'target_n')::bigint is distinct from p_target_n
    or p_result_evidence ->> 'rounding_rule' is distinct from 'ceil'
    or p_result_evidence ->> 'seed_normalized' is distinct from v_seed_normalized
    or p_result_evidence ->> 'seed_normalized_utf8_hex' is distinct from v_seed_utf8_hex
    or p_result_evidence ->> 'seed_digest_hex' is distinct from v_seed_digest_hex
    or (p_result_evidence ->> 'seed_u32')::bigint is distinct from v_seed_u32
    or p_result_evidence ->> 'ordered_candidate_set_byte_stream_hex' is distinct from v_candidate_stream_hex
    or p_result_evidence ->> 'ordered_candidate_set_hash' is distinct from v_candidate_hash then
    raise exception using errcode = '22023', message = 'sampling result evidence is invalid';
  end if;
  if (select jsonb_agg(to_jsonb(member.id) order by convert_to(member.farmer_code, 'UTF8'))
      from public.population_member as member
      where member.population_import_id = v_import.id and member.workspace_id = v_workspace and member.eligible)
      is distinct from p_result_evidence -> 'initial_candidate_member_ids' then
    raise exception using errcode = '22023', message = 'initial candidate evidence is invalid';
  end if;
  if (select count(*) from jsonb_to_recordset(p_allocation_evidence)
      as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint))
      <> (select count(distinct member.stratum_code) from public.population_member as member where member.population_import_id = v_import.id and member.workspace_id = v_workspace and member.eligible)
    or (select count(*) from jsonb_to_recordset(p_allocation_evidence)
      as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint))
      <> (select count(distinct allocation.stratum_code) from jsonb_to_recordset(p_allocation_evidence)
      as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint))
    or (select sum(allocation.eligible_count) from jsonb_to_recordset(p_allocation_evidence)
      as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)) <> v_n
    or (select sum(allocation.final_allocation) from jsonb_to_recordset(p_allocation_evidence)
      as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)) <> p_target_n
    or exists (select 1 from jsonb_to_recordset(p_allocation_evidence)
      as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
      where not exists (select 1 from public.population_member as member where member.population_import_id = v_import.id and member.workspace_id = v_workspace and member.eligible and member.stratum_code = allocation.stratum_code)
        or allocation.final_allocation > allocation.eligible_count) then
    raise exception using errcode = '22023', message = 'allocation membership is invalid';
  end if;
  if exists (
    with allocation as (
      select row_number() over (
        order by
          (p_target_n::numeric * allocation.eligible_count::numeric) % v_n::numeric desc,
          convert_to(allocation.stratum_code, 'UTF8')
      ) as remainder_rank,
      allocation.stratum_code,
      allocation.eligible_count,
      allocation.quota,
      allocation.floor_allocation,
      allocation.remainder,
      allocation.final_allocation,
      floor(p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric)::bigint as expected_floor,
      (p_target_n - sum(floor(p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric)::bigint) over ())::bigint as remaining_seats
      from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
    )
    select 1
    from allocation
    where abs(allocation.quota - p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric) > 0.000000000000001
      or allocation.floor_allocation <> allocation.expected_floor
      or abs(allocation.remainder - (p_target_n::numeric * allocation.eligible_count::numeric / v_n::numeric - allocation.expected_floor)) > 0.000000000000001
      or allocation.final_allocation <> allocation.expected_floor
        + case when allocation.remainder_rank <= allocation.remaining_seats then 1 else 0 end
  ) then
    raise exception using errcode = '22023', message = 'allocation formula evidence is invalid';
  end if;
  if jsonb_array_length(p_result_evidence -> 'ordered_selected_members') <> p_target_n
    or jsonb_array_length(p_result_evidence -> 'ordered_selected_member_ids') <> p_target_n
    or exists (select 1 from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members')
      as selected(member_id uuid, stratum_code text, selection_order bigint)
      where not exists (select 1 from public.population_member as member where member.id = selected.member_id and member.population_import_id = v_import.id and member.workspace_id = v_workspace and member.eligible and member.stratum_code = selected.stratum_code))
    or (select count(distinct selected.member_id) from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)) <> p_target_n
    or (select count(distinct selected.selection_order) from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)) <> p_target_n
    or exists (select 1 from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint) where selected.selection_order < 1 or selected.selection_order > p_target_n) then
    raise exception using errcode = '22023', message = 'selected member membership is invalid';
  end if;
  if (select jsonb_agg(to_jsonb(selected.member_id) order by selected.selection_order)
      from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint))
      is distinct from p_result_evidence -> 'ordered_selected_member_ids' then
    raise exception using errcode = '22023', message = 'selected member order evidence is invalid';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
    where allocation.final_allocation <> (
      select count(*)
      from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint)
      where selected.stratum_code = allocation.stratum_code
    )
  ) then
    raise exception using errcode = '22023', message = 'selected allocation membership is invalid';
  end if;
  if jsonb_array_length(p_result_evidence -> 'shuffled_member_ids') <> v_n
    or (select count(distinct shuffled.member_id) from jsonb_array_elements_text(p_result_evidence -> 'shuffled_member_ids') as shuffled(member_id)) <> v_n
    or exists (
      select 1
      from jsonb_array_elements_text(p_result_evidence -> 'shuffled_member_ids') as shuffled(member_id)
      where not exists (
        select 1 from public.population_member as member
        where member.id = shuffled.member_id::uuid
          and member.population_import_id = v_import.id
          and member.workspace_id = v_workspace
          and member.eligible
      )
    ) then
    raise exception using errcode = '22023', message = 'shuffled member evidence is invalid';
  end if;

  perform set_config('palmtrack.sampling_transition', 'regenerate', true);
  insert into public.sampling_draft_update (sampling_run_id, workspace_id, idempotency_key, request_digest, created_by)
  values (v_run.id, v_workspace, p_idempotency_key, v_request_digest, v_actor);
  update public.sampling_run
  set margin_of_error = p_margin_of_error,
      unrounded_result = v_unrounded,
      target_n = p_target_n,
      formula_version = 'yamane-v1',
      stratum_definition_version = p_stratum_definition_version,
      seed_text = p_seed_text,
      seed_normalized = v_seed_normalized,
      seed_normalized_utf8_hex = v_seed_utf8_hex,
      seed_digest_hex = v_seed_digest_hex,
      seed_u32 = v_seed_u32,
      algorithm_version = p_algorithm_version,
      ordered_candidate_set_hash = p_ordered_candidate_set_hash,
      allocation_evidence = p_allocation_evidence,
      result_evidence = p_result_evidence,
      updated_at = statement_timestamp()
  where public.sampling_run.id = v_run.id;
  delete from public.sampling_allocation where sampling_run_id = v_run.id and workspace_id = v_workspace;
  delete from public.sample_member where sampling_run_id = v_run.id and workspace_id = v_workspace;
  insert into public.sampling_allocation (sampling_run_id, workspace_id, stratum_code, eligible_count, quota, floor_allocation, remainder, final_allocation)
  select v_run.id, v_workspace, allocation.stratum_code, allocation.eligible_count, allocation.quota, allocation.floor_allocation, allocation.remainder, allocation.final_allocation
  from jsonb_to_recordset(p_allocation_evidence) as allocation(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint);
  insert into public.sample_member (sampling_run_id, workspace_id, population_member_id, stratum_code, selection_order)
  select v_run.id, v_workspace, selected.member_id, selected.stratum_code, selected.selection_order
  from jsonb_to_recordset(p_result_evidence -> 'ordered_selected_members') as selected(member_id uuid, stratum_code text, selection_order bigint);
  perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_regenerated', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', 'draft', 'after_status', 'draft',
    'input_digest', v_import.input_digest, 'candidate_set_hash', p_ordered_candidate_set_hash,
    'result_digest', encode(extensions.digest(convert_to(p_result_evidence::text, 'UTF8'), 'sha256'), 'hex')
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;

create or replace function public.regenerate_sampling_draft(
  p_run_id uuid, p_seed_text text, p_margin_of_error numeric,
  p_stratum_definition_version text, p_algorithm_version text, p_target_n bigint,
  p_ordered_candidate_set_hash text, p_allocation_evidence jsonb,
  p_result_evidence jsonb, p_idempotency_key uuid
)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select * from public.update_sampling_draft(
    p_run_id, p_seed_text, p_margin_of_error, p_stratum_definition_version,
    p_algorithm_version, p_target_n, p_ordered_candidate_set_hash,
    p_allocation_evidence, p_result_evidence, p_idempotency_key
  );
$$;

create or replace function public.lock_sampling_run(p_run_id uuid)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
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
  perform set_config('palmtrack.sampling_transition', 'lock', true);
  update public.sampling_run set status = 'locked', locked_by = v_actor, locked_at = statement_timestamp(), updated_at = statement_timestamp() where public.sampling_run.id = v_run.id;
  perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_locked', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', 'draft', 'after_status', 'locked', 'input_digest', (select population_import.input_digest from public.population_import as population_import where population_import.id = v_run.population_import_id),
    'candidate_set_hash', v_run.ordered_candidate_set_hash,
    'result_digest', encode(extensions.digest(convert_to(v_run.result_evidence::text, 'UTF8'), 'sha256'), 'hex')
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;

create or replace function public.activate_sampling_run(p_run_id uuid)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
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
  v_previous public.sampling_run%rowtype;
begin
  if public.current_role() is distinct from 'research_manager'::public.app_role or v_actor is null or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  select run.* into v_run
  from public.sampling_run as run
  where run.id = p_run_id and run.workspace_id = v_workspace
  for update;
  if not found or v_run.status is distinct from 'locked' then
    raise exception using errcode = '42501', message = 'sampling run transition is not permitted';
  end if;
  select run.* into v_previous
  from public.sampling_run as run
  where run.workspace_id = v_workspace and run.status = 'active'
  for update;
  perform set_config('palmtrack.sampling_transition', 'supersede', true);
  if v_previous.id is not null then
    update public.sampling_run set status = 'superseded', superseded_by = v_actor, superseded_at = statement_timestamp(), updated_at = statement_timestamp() where public.sampling_run.id = v_previous.id;
    perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_superseded', 'sampling_run', v_previous.id, 'success', jsonb_build_object(
      'before_status', 'active', 'after_status', 'superseded', 'candidate_set_hash', v_previous.ordered_candidate_set_hash
    ));
  end if;
  perform set_config('palmtrack.sampling_transition', 'activate', true);
  update public.sampling_run set status = 'active', activated_by = v_actor, activated_at = statement_timestamp(), updated_at = statement_timestamp() where public.sampling_run.id = v_run.id;
  perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_activated', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', 'locked', 'after_status', 'active', 'candidate_set_hash', v_run.ordered_candidate_set_hash
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;

create or replace function public.cancel_sampling_run(p_run_id uuid, p_reason text)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
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
  v_reason_digest text;
begin
  if public.current_role() is distinct from 'research_manager'::public.app_role or v_actor is null or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'cancellation reason is required';
  end if;
  select run.* into v_run
  from public.sampling_run as run
  where run.id = p_run_id and run.workspace_id = v_workspace
  for update;
  if not found or v_run.status not in ('draft', 'locked') then
    raise exception using errcode = '42501', message = 'sampling run transition is not permitted';
  end if;
  v_reason_digest := encode(extensions.digest(convert_to(btrim(p_reason), 'UTF8'), 'sha256'), 'hex');
  perform set_config('palmtrack.sampling_transition', 'cancel', true);
  update public.sampling_run set status = 'cancelled', cancelled_by = v_actor, cancelled_at = statement_timestamp(), cancellation_reason_digest = v_reason_digest, updated_at = statement_timestamp() where public.sampling_run.id = v_run.id;
  perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_cancelled', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', v_run.status::text, 'after_status', 'cancelled', 'reason_digest', v_reason_digest
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;

create or replace function public.list_sampling_runs()
returns table (
  id uuid, version bigint, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, algorithm_version text,
  status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
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
    run.status, run.created_at, run.locked_at, run.activated_at,
    run.superseded_at, run.cancelled_at,
    coalesce((select jsonb_agg(to_jsonb(allocation) - 'id' - 'sampling_run_id' - 'workspace_id' order by allocation.stratum_code)
      from public.sampling_allocation allocation where allocation.sampling_run_id = run.id), '[]'::jsonb)
  from public.sampling_run run
  where run.workspace_id = v_workspace
  order by run.version desc;
end;
$$;

create or replace function public.get_sampling_candidates(p_run_id uuid)
returns table (
  sample_member_id uuid,
  population_member_id uuid,
  farmer_code text,
  stratum_code text,
  selection_order bigint
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager') or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if not exists (
    select 1 from public.sampling_run
    where id = p_run_id and workspace_id = v_workspace and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  return query
  select sample.id, sample.population_member_id, member.farmer_code, sample.stratum_code, sample.selection_order
  from public.sample_member sample
  join public.population_member member on member.id = sample.population_member_id and member.workspace_id = sample.workspace_id
  where sample.sampling_run_id = p_run_id and sample.workspace_id = v_workspace
  order by sample.selection_order;
end;
$$;

create or replace function public.get_sampling_run_evidence(p_run_id uuid)
returns table (
  id uuid, version bigint, population_import_id uuid, population_size bigint,
  margin_of_error numeric, unrounded_result numeric, rounding_rule text, target_n bigint,
  formula_version text, stratum_definition_version text, seed_text text, seed_normalized text, seed_normalized_utf8_hex text,
  seed_digest_hex text, seed_u32 bigint, algorithm_version text,
  ordered_candidate_set_hash text, status public.sampling_run_status,
  created_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager') or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if not exists (select 1 from public.sampling_run as run where run.id = p_run_id and run.workspace_id = v_workspace) then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  return query select receipt.* from private.sampling_run_result(p_run_id) as receipt;
end;
$$;

revoke all on function
  public.create_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid),
  public.lock_sampling_run(uuid), public.activate_sampling_run(uuid),
  public.cancel_sampling_run(uuid, text), public.list_sampling_runs(),
  public.get_sampling_candidates(uuid), public.get_sampling_run_evidence(uuid),
  public.update_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid),
  public.regenerate_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function
  public.create_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid),
  public.lock_sampling_run(uuid), public.activate_sampling_run(uuid),
  public.cancel_sampling_run(uuid, text), public.list_sampling_runs(),
  public.get_sampling_candidates(uuid), public.get_sampling_run_evidence(uuid),
  public.update_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid),
  public.regenerate_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid)
  to authenticated;

alter function public.create_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid) owner to palmtrack_transaction_owner;
alter function public.lock_sampling_run(uuid) owner to palmtrack_transaction_owner;
alter function public.activate_sampling_run(uuid) owner to palmtrack_transaction_owner;
alter function public.cancel_sampling_run(uuid, text) owner to palmtrack_transaction_owner;
alter function public.list_sampling_runs() owner to palmtrack_transaction_owner;
alter function public.get_sampling_candidates(uuid) owner to palmtrack_transaction_owner;
alter function public.get_sampling_run_evidence(uuid) owner to palmtrack_transaction_owner;
alter function public.update_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid) owner to palmtrack_transaction_owner;
alter function public.regenerate_sampling_draft(uuid, text, numeric, text, text, bigint, text, jsonb, jsonb, uuid) owner to palmtrack_transaction_owner;

commit;
