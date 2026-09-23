begin;

create type public.sampling_run_status as enum ('draft', 'locked', 'active', 'superseded', 'cancelled');

create table public.sampling_run (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  population_import_id uuid not null,
  version integer not null check (version > 0),
  population_size integer not null check (population_size > 0),
  margin_of_error numeric not null check (margin_of_error > 0 and margin_of_error < 1),
  target_n integer not null check (target_n > 0),
  formula_version text not null check (formula_version = 'yamane-v1'),
  seed_text text not null check (char_length(seed_text) between 1 and 200),
  seed_normalized text not null check (char_length(seed_normalized) between 1 and 200),
  seed_digest_hex text not null check (seed_digest_hex ~ '^[0-9a-f]{64}$'),
  seed_u32 bigint not null check (seed_u32 >= 0 and seed_u32 <= 4294967295),
  algorithm_version text not null check (algorithm_version = 'sha256-mulberry32-fy-v1'),
  ordered_candidate_set_hash text not null check (ordered_candidate_set_hash ~ '^[0-9a-f]{64}$'),
  allocation jsonb not null,
  status public.sampling_run_status not null default 'draft',
  locked_at timestamptz,
  cancel_reason text,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  locked_by uuid,
  activated_by uuid,
  constraint sampling_run_id_workspace_unique unique (id, workspace_id),
  constraint sampling_run_workspace_version_unique unique (workspace_id, version),
  constraint sampling_run_population_workspace_fk
    foreign key (population_import_id, workspace_id)
    references public.population_import (id, workspace_id)
    on delete restrict,
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
  constraint sampling_run_target_lte_population_check check (target_n <= population_size),
  constraint sampling_run_lock_state_check check (
    (status = 'draft' and locked_at is null)
    or (status = 'cancelled')
    or (status in ('locked', 'active', 'superseded') and locked_at is not null)
  ),
  constraint sampling_run_cancel_reason_check check (
    (status = 'cancelled' and cancel_reason is not null)
    or (status <> 'cancelled' and cancel_reason is null)
  ),
  constraint sampling_run_terminal_actor_check check (
    (status in ('active', 'superseded') and locked_by is not null and activated_by is not null)
    or (status = 'locked' and locked_by is not null and activated_by is null)
    or (status in ('draft', 'cancelled') and activated_by is null)
  )
);

create unique index sampling_run_workspace_single_active_uniq
  on public.sampling_run (workspace_id)
  where status = 'active';

alter table public.population_member
  add constraint population_member_id_workspace_unique unique (id, workspace_id);

create table public.sample_member (
  id uuid primary key default gen_random_uuid(),
  sampling_run_id uuid not null,
  workspace_id uuid not null,
  population_member_id uuid not null,
  stratum_code text not null check (stratum_code ~ '^[A-Z0-9_-]{1,24}$'),
  selection_order integer not null check (selection_order > 0),
  constraint sample_member_run_workspace_fk
    foreign key (sampling_run_id, workspace_id)
    references public.sampling_run (id, workspace_id)
    on delete restrict,
  constraint sample_member_population_workspace_fk
    foreign key (population_member_id, workspace_id)
    references public.population_member (id, workspace_id)
    on delete restrict,
  constraint sample_member_run_member_unique unique (sampling_run_id, population_member_id),
  constraint sample_member_run_order_unique unique (sampling_run_id, selection_order)
);

create index sampling_run_workspace_created_idx
  on public.sampling_run (workspace_id, created_at desc);
create index sample_member_run_stratum_idx
  on public.sample_member (sampling_run_id, stratum_code, selection_order);

alter table public.sampling_run enable row level security;
alter table public.sampling_run force row level security;
alter table public.sample_member enable row level security;
alter table public.sample_member force row level security;

revoke all on table public.sampling_run, public.sample_member
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.sampling_run
  to palmtrack_transaction_owner;
grant select, insert on table public.sample_member
  to palmtrack_transaction_owner;

create policy sampling_run_internal_transactions
  on public.sampling_run
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create policy sample_member_internal_transactions
  on public.sample_member
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create or replace function private.guard_sampling_run_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'draft'
    and new.status = 'locked'
    and new.locked_at is not null
    and old.locked_at is null
    and new.locked_by is not null
    and (to_jsonb(new) - array['status', 'locked_at', 'locked_by']::text[])
      = (to_jsonb(old) - array['status', 'locked_at', 'locked_by']::text[])
  then
    return new;
  end if;

  if old.status = 'locked'
    and new.status = 'active'
    and new.activated_by is not null
    and new.locked_at = old.locked_at
    and (to_jsonb(new) - array['status', 'activated_by']::text[])
      = (to_jsonb(old) - array['status', 'activated_by']::text[])
  then
    return new;
  end if;

  if old.status = 'active'
    and new.status = 'superseded'
    and (to_jsonb(new) - array['status']::text[])
      = (to_jsonb(old) - array['status']::text[])
  then
    return new;
  end if;

  if old.status in ('draft', 'locked')
    and new.status = 'cancelled'
    and new.cancel_reason is not null
    and old.cancel_reason is null
    and (to_jsonb(new) - array['status', 'cancel_reason']::text[])
      = (to_jsonb(old) - array['status', 'cancel_reason']::text[])
  then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'sampling run transition is not permitted';
end;
$$;

create or replace function private.reject_sampling_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'sampling records are immutable outside audited transitions';
end;
$$;

revoke all on function private.guard_sampling_run_update(),
  private.reject_sampling_mutation()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

create trigger sampling_run_update_guard
before update on public.sampling_run
for each row execute function private.guard_sampling_run_update();

create trigger sampling_run_delete_guard
before delete on public.sampling_run
for each row execute function private.reject_sampling_mutation();

create trigger sampling_run_truncate_guard
before truncate on public.sampling_run
for each statement execute function private.reject_sampling_mutation();

create trigger sample_member_update_guard
before update on public.sample_member
for each row execute function private.reject_sampling_mutation();

create trigger sample_member_delete_guard
before delete on public.sample_member
for each row execute function private.reject_sampling_mutation();

create trigger sample_member_truncate_guard
before truncate on public.sample_member
for each statement execute function private.reject_sampling_mutation();

alter function private.guard_sampling_run_update()
  owner to palmtrack_transaction_owner;
alter function private.reject_sampling_mutation()
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

create or replace function public.create_sampling_draft(
  p_population_import_id uuid,
  p_margin_of_error numeric,
  p_seed_text text,
  p_seed_normalized text,
  p_seed_digest_hex text,
  p_seed_u32 bigint,
  p_candidate_hash text,
  p_allocations jsonb,
  p_members jsonb
)
returns table (
  id uuid,
  version integer,
  population_import_id uuid,
  population_size integer,
  target_n integer,
  status public.sampling_run_status,
  seed_digest_hex text,
  ordered_candidate_set_hash text,
  locked_at timestamptz
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
  v_expected_target integer;
  v_version integer;
  v_run public.sampling_run%rowtype;
  v_member_count integer;
  v_allocation_total integer;
  v_seed_digest bytea;
  v_seed_u32 bigint;
  v_cand_ids uuid[];
  v_cand_farmers text[];
  v_cand_strata text[];
  v_cand_count integer;
  v_stream bytea;
  v_chunk bytea;
  v_candidate_hash text;
  v_acode text[];
  v_acnt integer[];
  v_afinal integer[];
  v_counted integer[];
  v_aquota float8;
  v_afloor integer;
  v_aremainder float8;
  v_nstrata integer;
  v_remaining integer;
  v_pick integer;
  v_best_rem float8;
  v_best_code bytea;
  v_pick_code bytea;
  v_found_count integer;
  v_state bigint;
  v_t bigint;
  v_imul bigint;
  v_alo bigint;
  v_ahi bigint;
  v_blo bigint;
  v_bhi bigint;
  v_out bigint;
  v_j integer;
  v_n integer;
  v_pos integer[];
  v_tmp integer;
  v_sel_count integer;
  v_quota_idx integer;
  v_member_item jsonb;
  v_exp_id uuid;
begin
  if v_role is null or v_role <> 'research_manager' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if v_actor_profile_id is null or v_workspace_id is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if v_import.eligible_count <= 0 then
    raise exception using errcode = '22023', message = 'sampling evidence is invalid';
  end if;

  select * into v_import
  from public.population_import as target_import
  where target_import.id = p_population_import_id
    and target_import.workspace_id = v_workspace_id;
  if not found or v_import.status <> 'accepted' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if p_margin_of_error is null or p_margin_of_error <= 0 or p_margin_of_error >= 1 then
    raise exception using errcode = '22023', message = 'sampling margin of error is invalid';
  end if;
  v_expected_target := ceil(
    v_import.eligible_count::numeric / (1 + v_import.eligible_count::numeric * p_margin_of_error * p_margin_of_error)
  );
  if jsonb_typeof(p_allocations) is distinct from 'array'
    or jsonb_typeof(p_members) is distinct from 'array'
    or jsonb_array_length(p_members) <> v_expected_target
  then
    raise exception using errcode = '22023', message = 'sampling evidence is invalid';
  end if;
  select coalesce(sum((item ->> 'final_allocation')::integer), 0)::integer into v_allocation_total
  from jsonb_array_elements(p_allocations) as item;
  if v_allocation_total <> v_expected_target then
    raise exception using errcode = '22023', message = 'sampling allocation total is invalid';
  end if;
  if p_seed_digest_hex !~ '^[0-9a-f]{64}$'
    or p_candidate_hash !~ '^[0-9a-f]{64}$'
    or p_seed_u32 is null or p_seed_u32 < 0 or p_seed_u32 > 4294967295
    or char_length(p_seed_text) not between 1 and 200
    or char_length(p_seed_normalized) not between 1 and 200
  then
    raise exception using errcode = '22023', message = 'sampling seed evidence is invalid';
  end if;

  -- NFR-04 trustless replay: recompute every sampling input from the accepted
  -- snapshot. Caller evidence must match bit-for-bit; anything else is denied.
  -- Seed chain mirrors deriveSeed (NFC text -> UTF-8 -> SHA-256 -> BE u32).
  -- NFC normalization itself is attested by the client and stored for audit;
  -- the digest/u32/hash/selection chain below is fully server-verified.
  v_seed_digest := extensions.digest(convert_to(p_seed_normalized, 'UTF8'), 'sha256');
  if encode(v_seed_digest, 'hex') <> p_seed_digest_hex then
    raise exception using errcode = '22023', message = 'sampling seed evidence is invalid';
  end if;
  v_seed_u32 :=
    (get_byte(v_seed_digest, 0)::bigint << 24)
    | (get_byte(v_seed_digest, 1)::bigint << 16)
    | (get_byte(v_seed_digest, 2)::bigint << 8)
    | get_byte(v_seed_digest, 3)::bigint;
  if p_seed_u32 <> v_seed_u32 then
    raise exception using errcode = '22023', message = 'sampling seed evidence is invalid';
  end if;

  -- Ordered candidate set mirrors sortCandidatesByCode (byte-wise farmer_code).
  select
    coalesce(array_agg(member.id order by convert_to(member.farmer_code, 'UTF8')), '{}'::uuid[]),
    coalesce(array_agg(member.farmer_code order by convert_to(member.farmer_code, 'UTF8')), '{}'::text[]),
    coalesce(array_agg(member.stratum_code order by convert_to(member.farmer_code, 'UTF8')), '{}'::text[]),
    count(*)::integer
  into v_cand_ids, v_cand_farmers, v_cand_strata, v_cand_count
  from public.population_member as member
  where member.population_import_id = v_import.id
    and member.workspace_id = v_workspace_id
    and member.eligible;
  if v_cand_count <> v_import.eligible_count then
    raise exception using errcode = '22023', message = 'sampling candidate evidence is invalid';
  end if;

  -- Candidate hash mirrors hashOrderedCandidateSet (BE length prefixes).
  v_stream := '\x'::bytea;
  for v_i in 1 .. v_cand_count loop
    v_chunk := convert_to(v_cand_farmers[v_i], 'UTF8');
    v_stream := v_stream || decode(lpad(to_hex(octet_length(v_chunk)), 8, '0'), 'hex') || v_chunk;
    v_chunk := convert_to(v_cand_strata[v_i], 'UTF8');
    v_stream := v_stream || decode(lpad(to_hex(octet_length(v_chunk)), 8, '0'), 'hex') || v_chunk;
  end loop;
  v_candidate_hash := encode(extensions.digest(v_stream, 'sha256'), 'hex');
  if v_candidate_hash <> p_candidate_hash then
    raise exception using errcode = '22023', message = 'sampling candidate evidence is invalid';
  end if;

  -- Allocation mirrors allocateLargestRemainder (float8 quota, byte tie-break).
  select
    coalesce(array_agg(t.code order by t.bytecode), '{}'::text[]),
    coalesce(array_agg(t.cnt order by t.bytecode), '{}'::integer[])
  into v_acode, v_acnt
  from (
    select member.stratum_code as code, count(*)::integer as cnt,
      convert_to(member.stratum_code, 'UTF8') as bytecode
    from public.population_member as member
    where member.population_import_id = v_import.id
      and member.workspace_id = v_workspace_id
      and member.eligible
    group by member.stratum_code
  ) as t;
  v_nstrata := coalesce(array_length(v_acode, 1), 0);
  if v_nstrata = 0 then
    raise exception using errcode = '22023', message = 'sampling allocation evidence is invalid';
  end if;
  v_afinal := '{}'::integer[];
  v_remaining := v_expected_target;
  for v_i in 1 .. v_nstrata loop
    if v_acode[v_i] !~ '^[A-Z0-9_-]{1,24}$' then
      raise exception using errcode = '22023', message = 'sampling allocation evidence is invalid';
    end if;
    v_aquota := (v_expected_target::float8 * v_acnt[v_i]::float8) / v_import.eligible_count::float8;
    v_afloor := floor(v_aquota)::integer;
    if v_afloor > v_acnt[v_i] then
      raise exception using errcode = '22023', message = 'sampling allocation evidence is invalid';
    end if;
    v_afinal := v_afinal || v_afloor;
    v_remaining := v_remaining - v_afloor;
  end loop;
  while v_remaining > 0 loop
    v_pick := null;
    v_best_rem := null;
    v_best_code := null;
    for v_i in 1 .. v_nstrata loop
      v_aquota := (v_expected_target::float8 * v_acnt[v_i]::float8) / v_import.eligible_count::float8;
      v_aremainder := v_aquota - floor(v_aquota)::float8;
      v_pick_code := convert_to(v_acode[v_i], 'UTF8');
      if v_afinal[v_i] < v_acnt[v_i]
        and (v_pick is null or v_aremainder > v_best_rem
          or (v_aremainder = v_best_rem and v_pick_code < v_best_code)) then
        v_pick := v_i;
        v_best_rem := v_aremainder;
        v_best_code := v_pick_code;
      end if;
    end loop;
    if v_pick is null then
      raise exception using errcode = '22023', message = 'sampling allocation evidence is invalid';
    end if;
    v_afinal[v_pick] := v_afinal[v_pick] + 1;
    v_remaining := v_remaining - 1;
  end loop;
  if (select count(*)::integer from jsonb_array_elements(p_allocations)) <> v_nstrata then
    raise exception using errcode = '22023', message = 'sampling allocation evidence is invalid';
  end if;
  for v_i in 1 .. v_nstrata loop
    select count(*)::integer into v_found_count
    from jsonb_array_elements(p_allocations) as item
    where (item ->> 'stratum_code') = v_acode[v_i]
      and (item ->> 'final_allocation') ~ '^[0-9]+$'
      and (item ->> 'final_allocation')::integer = v_afinal[v_i];
    if v_found_count <> 1 then
      raise exception using errcode = '22023', message = 'sampling allocation evidence is invalid';
    end if;
  end loop;

  -- Shuffle mirrors createMulberry32 + fisherYatesShuffle (unsigned u32).
  v_pos := '{}'::integer[];
  for v_i in 1 .. v_cand_count loop
    v_pos := v_pos || v_i;
  end loop;
  v_state := v_seed_u32;
  v_n := v_cand_count;
  while v_n >= 2 loop
    v_state := (v_state + 1831565813) & 4294967295;
    v_t := v_state;
    v_alo := ((v_t # (v_t >> 15)) & 65535);
    v_ahi := (((v_t # (v_t >> 15)) >> 16) & 65535);
    v_blo := ((v_t | 1) & 65535);
    v_bhi := (((v_t | 1) >> 16) & 65535);
    v_imul := (v_alo * v_blo + ((v_alo * v_bhi + v_ahi * v_blo) << 16)) & 4294967295;
    v_t := v_imul;
    v_alo := ((v_t # (v_t >> 7)) & 65535);
    v_ahi := (((v_t # (v_t >> 7)) >> 16) & 65535);
    v_blo := ((v_t | 61) & 65535);
    v_bhi := (((v_t | 61) >> 16) & 65535);
    v_imul := (v_alo * v_blo + ((v_alo * v_bhi + v_ahi * v_blo) << 16)) & 4294967295;
    v_t := v_t # ((v_t + v_imul) & 4294967295);
    v_out := v_t # (v_t >> 14);
    v_j := floor(v_out::float8 / 4294967296::float8 * v_n::float8)::integer;
    v_tmp := v_pos[v_n];
    v_pos[v_n] := v_pos[v_j + 1];
    v_pos[v_j + 1] := v_tmp;
    v_n := v_n - 1;
  end loop;

  -- Selection mirrors selectByAllocation; caller rows must match exactly.
  v_counted := '{}'::integer[];
  for v_i in 1 .. v_nstrata loop
    v_counted := v_counted || 0;
  end loop;
  v_sel_count := 0;
  for v_k in 1 .. v_cand_count loop
    v_quota_idx := null;
    for v_i in 1 .. v_nstrata loop
      if v_cand_strata[v_pos[v_k]] = v_acode[v_i] then
        v_quota_idx := v_i;
        exit;
      end if;
    end loop;
    if v_quota_idx is null then
      raise exception using errcode = '22023', message = 'sampling member evidence is invalid';
    end if;
    if v_counted[v_quota_idx] < v_afinal[v_quota_idx] then
      v_sel_count := v_sel_count + 1;
      v_counted[v_quota_idx] := v_counted[v_quota_idx] + 1;
      v_exp_id := v_cand_ids[v_pos[v_k]];
      v_member_item := p_members -> (v_sel_count - 1);
      if v_member_item is null
        or (v_member_item ->> 'population_member_id') is null
        or (v_member_item ->> 'population_member_id') !~ '^[0-9a-fA-F-]{36}$'
        or (v_member_item ->> 'stratum_code') is null
        or (v_member_item ->> 'selection_order') is null
        or (v_member_item ->> 'selection_order') !~ '^[0-9]+$' then
        raise exception using errcode = '22023', message = 'sampling member evidence is invalid';
      end if;
      if (v_member_item ->> 'population_member_id')::uuid <> v_exp_id
        or (v_member_item ->> 'stratum_code') <> v_acode[v_quota_idx]
        or (v_member_item ->> 'selection_order')::integer <> v_sel_count then
        raise exception using errcode = '22023', message = 'sampling member evidence is invalid';
      end if;
      exit when v_sel_count = v_expected_target;
    end if;
  end loop;
  if v_sel_count <> v_expected_target then
    raise exception using errcode = '22023', message = 'sampling member evidence is invalid';
  end if;

  select coalesce(max(target_run.version), 0) + 1 into v_version
  from public.sampling_run as target_run
  where target_run.workspace_id = v_workspace_id;

  insert into public.sampling_run (
    workspace_id, population_import_id, version, population_size,
    margin_of_error, target_n, formula_version,
    seed_text, seed_normalized, seed_digest_hex, seed_u32,
    algorithm_version, ordered_candidate_set_hash, allocation,
    status, created_by
  ) values (
    v_workspace_id, v_import.id, v_version, v_import.eligible_count,
    p_margin_of_error, v_expected_target, 'yamane-v1',
    p_seed_text, p_seed_normalized, p_seed_digest_hex, p_seed_u32,
    'sha256-mulberry32-fy-v1', p_candidate_hash, p_allocations,
    'draft', v_actor_profile_id
  ) returning * into v_run;

  insert into public.sample_member (
    sampling_run_id, workspace_id, population_member_id, stratum_code, selection_order
  )
  select
    v_run.id,
    v_workspace_id,
    (item ->> 'population_member_id')::uuid,
    item ->> 'stratum_code',
    (item ->> 'selection_order')::integer
  from jsonb_array_elements(p_members) as item;

  select count(*)::integer into v_member_count
  from public.sample_member
  where sampling_run_id = v_run.id;
  if v_member_count <> v_expected_target then
    raise exception using errcode = '22023', message = 'sampling member total is invalid';
  end if;

  perform private.append_audit_event(
    v_workspace_id,
    v_actor_profile_id,
    'sampling.draft_created',
    'sampling_run',
    v_run.id,
    'success',
    jsonb_build_object(
      'before_status', 'none',
      'after_status', 'draft',
      'target_n', v_run.target_n,
      'population_digest', v_import.input_digest,
      'seed_digest', v_run.seed_digest_hex,
      'candidate_hash', v_run.ordered_candidate_set_hash,
      'algorithm_version', v_run.algorithm_version
    )
  );

  return query select
    v_run.id, v_run.version, v_run.population_import_id, v_run.population_size,
    v_run.target_n, v_run.status, v_run.seed_digest_hex,
    v_run.ordered_candidate_set_hash, v_run.locked_at;
end;
$$;

create or replace function public.lock_sampling_run(
  p_run_id uuid,
  p_candidate_hash text,
  p_seed_digest_hex text
)
returns table (
  id uuid,
  version integer,
  population_import_id uuid,
  population_size integer,
  target_n integer,
  status public.sampling_run_status,
  seed_digest_hex text,
  ordered_candidate_set_hash text,
  locked_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_run public.sampling_run%rowtype;
  v_import public.population_import%rowtype;
begin
  if v_role is null or v_role <> 'research_manager' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select * into v_run
  from public.sampling_run as target_run
  where target_run.id = p_run_id and target_run.workspace_id = v_workspace_id
  for update;
  if not found or v_run.status <> 'draft' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if p_candidate_hash <> v_run.ordered_candidate_set_hash
    or p_seed_digest_hex <> v_run.seed_digest_hex
  then
    raise exception using errcode = '22023', message = 'sampling replay does not match draft evidence';
  end if;

  select * into v_import
  from public.population_import as target_import
  where target_import.id = v_run.population_import_id and target_import.workspace_id = v_workspace_id;

  update public.sampling_run
  set status = 'locked', locked_at = statement_timestamp(), locked_by = v_actor_profile_id
  where sampling_run.id = v_run.id
  returning * into v_run;

  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'sampling.locked', 'sampling_run', v_run.id, 'success',
    jsonb_build_object(
      'before_status', 'draft', 'after_status', 'locked', 'target_n', v_run.target_n,
      'population_digest', v_import.input_digest, 'seed_digest', v_run.seed_digest_hex,
      'candidate_hash', v_run.ordered_candidate_set_hash, 'algorithm_version', v_run.algorithm_version
    )
  );

  return query select
    v_run.id, v_run.version, v_run.population_import_id, v_run.population_size,
    v_run.target_n, v_run.status, v_run.seed_digest_hex,
    v_run.ordered_candidate_set_hash, v_run.locked_at;
end;
$$;

create or replace function public.activate_sampling_run(p_run_id uuid)
returns table (
  id uuid,
  version integer,
  population_import_id uuid,
  population_size integer,
  target_n integer,
  status public.sampling_run_status,
  seed_digest_hex text,
  ordered_candidate_set_hash text,
  locked_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_run public.sampling_run%rowtype;
  v_prior public.sampling_run%rowtype;
  v_import public.population_import%rowtype;
begin
  if v_role is null or v_role <> 'research_manager' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select * into v_run
  from public.sampling_run as target_run
  where target_run.id = p_run_id and target_run.workspace_id = v_workspace_id
  for update;
  if not found or v_run.status <> 'locked' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select * into v_prior
  from public.sampling_run as prior_run
  where prior_run.workspace_id = v_workspace_id and prior_run.status = 'active'
  for update;

  if found then
    update public.sampling_run
    set status = 'superseded'
    where sampling_run.id = v_prior.id;
    select * into v_import from public.population_import as target_import where target_import.id = v_prior.population_import_id and target_import.workspace_id = v_workspace_id;
    perform private.append_audit_event(
      v_workspace_id, v_actor_profile_id, 'sampling.superseded', 'sampling_run', v_prior.id, 'success',
      jsonb_build_object(
        'before_status', 'active', 'after_status', 'superseded', 'target_n', v_prior.target_n,
        'population_digest', v_import.input_digest, 'seed_digest', v_prior.seed_digest_hex,
        'candidate_hash', v_prior.ordered_candidate_set_hash, 'algorithm_version', v_prior.algorithm_version
      )
    );
  end if;

  update public.sampling_run
  set status = 'active', activated_by = v_actor_profile_id
  where sampling_run.id = v_run.id
  returning * into v_run;

  select * into v_import from public.population_import as target_import where target_import.id = v_run.population_import_id and target_import.workspace_id = v_workspace_id;
  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'sampling.activated', 'sampling_run', v_run.id, 'success',
    jsonb_build_object(
      'before_status', 'locked', 'after_status', 'active', 'target_n', v_run.target_n,
      'population_digest', v_import.input_digest, 'seed_digest', v_run.seed_digest_hex,
      'candidate_hash', v_run.ordered_candidate_set_hash, 'algorithm_version', v_run.algorithm_version
    )
  );

  return query select
    v_run.id, v_run.version, v_run.population_import_id, v_run.population_size,
    v_run.target_n, v_run.status, v_run.seed_digest_hex,
    v_run.ordered_candidate_set_hash, v_run.locked_at;
end;
$$;

create or replace function public.cancel_sampling_run(p_run_id uuid, p_reason text)
returns table (
  id uuid,
  version integer,
  population_import_id uuid,
  population_size integer,
  target_n integer,
  status public.sampling_run_status,
  seed_digest_hex text,
  ordered_candidate_set_hash text,
  locked_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_run public.sampling_run%rowtype;
  v_before text;
  v_import public.population_import%rowtype;
begin
  if v_role is null or v_role <> 'research_manager' then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'sampling cancel reason is invalid';
  end if;

  select * into v_run
  from public.sampling_run as target_run
  where target_run.id = p_run_id and target_run.workspace_id = v_workspace_id
  for update;
  if not found or v_run.status not in ('draft', 'locked') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  v_before := v_run.status::text;

  update public.sampling_run
  set status = 'cancelled', cancel_reason = btrim(p_reason)
  where sampling_run.id = v_run.id
  returning * into v_run;

  select * into v_import from public.population_import as target_import where target_import.id = v_run.population_import_id and target_import.workspace_id = v_workspace_id;
  perform private.append_audit_event(
    v_workspace_id, v_actor_profile_id, 'sampling.cancelled', 'sampling_run', v_run.id, 'success',
    jsonb_build_object(
      'before_status', v_before, 'after_status', 'cancelled', 'target_n', v_run.target_n,
      'population_digest', v_import.input_digest, 'seed_digest', v_run.seed_digest_hex,
      'candidate_hash', v_run.ordered_candidate_set_hash, 'algorithm_version', v_run.algorithm_version,
      'cancel_reason_digest', encode(extensions.digest(convert_to(btrim(p_reason), 'UTF8'), 'sha256'), 'hex')
    )
  );

  return query select
    v_run.id, v_run.version, v_run.population_import_id, v_run.population_size,
    v_run.target_n, v_run.status, v_run.seed_digest_hex,
    v_run.ordered_candidate_set_hash, v_run.locked_at;
end;
$$;

create or replace function public.list_sampling_runs()
returns table (
  id uuid,
  version integer,
  population_import_id uuid,
  population_size integer,
  target_n integer,
  status public.sampling_run_status,
  seed_digest_hex text,
  ordered_candidate_set_hash text,
  locked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager', 'evaluator_readonly') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    sampling_run.id, sampling_run.version, sampling_run.population_import_id,
    sampling_run.population_size, sampling_run.target_n, sampling_run.status,
    sampling_run.seed_digest_hex, sampling_run.ordered_candidate_set_hash, sampling_run.locked_at
  from public.sampling_run
  where sampling_run.workspace_id = v_workspace_id
  order by sampling_run.version desc, sampling_run.id;
end;
$$;

create or replace function public.get_sampling_run(p_run_id uuid)
returns table (
  id uuid,
  version integer,
  population_import_id uuid,
  population_size integer,
  margin_of_error numeric,
  target_n integer,
  formula_version text,
  seed_text text,
  seed_normalized text,
  seed_digest_hex text,
  seed_u32 bigint,
  algorithm_version text,
  ordered_candidate_set_hash text,
  allocation jsonb,
  status public.sampling_run_status,
  locked_at timestamptz,
  cancel_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager', 'evaluator_readonly') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    sampling_run.id, sampling_run.version, sampling_run.population_import_id,
    sampling_run.population_size, sampling_run.margin_of_error, sampling_run.target_n,
    sampling_run.formula_version, sampling_run.seed_text, sampling_run.seed_normalized,
    sampling_run.seed_digest_hex, sampling_run.seed_u32, sampling_run.algorithm_version,
    sampling_run.ordered_candidate_set_hash, sampling_run.allocation, sampling_run.status,
    sampling_run.locked_at, sampling_run.cancel_reason, sampling_run.created_at
  from public.sampling_run
  where sampling_run.id = p_run_id
    and sampling_run.workspace_id = v_workspace_id;
end;
$$;

create or replace function public.list_sampling_members(p_run_id uuid)
returns table (
  population_member_id uuid,
  farmer_code text,
  stratum_code text,
  selection_order integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager', 'evaluator_readonly') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if not exists (
    select 1 from public.sampling_run
    where sampling_run.id = p_run_id and sampling_run.workspace_id = v_workspace_id
  ) then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    sample_member.population_member_id,
    population_member.farmer_code,
    sample_member.stratum_code,
    sample_member.selection_order
  from public.sample_member
  join public.population_member
    on population_member.id = sample_member.population_member_id
    and population_member.workspace_id = sample_member.workspace_id
  where sample_member.sampling_run_id = p_run_id
    and sample_member.workspace_id = v_workspace_id
  order by sample_member.selection_order, sample_member.population_member_id;
end;
$$;

comment on function public.create_sampling_draft(uuid, numeric, text, text, text, bigint, text, jsonb, jsonb)
  is 'Creates one draft sampling run from an accepted population snapshot for research manager only.';
comment on function public.lock_sampling_run(uuid, text, text)
  is 'Replays draft evidence hashes then freezes the sampling run.';
comment on function public.activate_sampling_run(uuid)
  is 'Activates one locked run and supersedes the prior active run in a single transaction.';
comment on function public.cancel_sampling_run(uuid, text)
  is 'Cancels a draft or locked run with a required reason.';
comment on function public.list_sampling_runs()
  is 'Returns the current-workspace sampling run evidence projection.';
comment on function public.get_sampling_run(uuid)
  is 'Returns one sampling run with full frozen evidence for an authorized viewer.';
comment on function public.list_sampling_members(uuid)
  is 'Returns the ordered selected members of one sampling run.';

create or replace function public.list_population_members(p_import_id uuid)
returns table (
  id uuid,
  row_number integer,
  farmer_code text,
  stratum_code text,
  eligible boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'research_manager', 'evaluator_readonly') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if not exists (
    select 1 from public.population_import
    where population_import.id = p_import_id
      and population_import.workspace_id = v_workspace_id
      and population_import.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    population_member.id,
    population_member.row_number,
    population_member.farmer_code,
    population_member.stratum_code,
    population_member.eligible
  from public.population_member
  where population_member.population_import_id = p_import_id
    and population_member.workspace_id = v_workspace_id
  order by population_member.row_number;
end;
$$;

comment on function public.list_population_members(uuid)
  is 'Returns the frozen member rows of one accepted population snapshot for sampling preview.';

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
grant execute on function
  public.create_sampling_draft(uuid, numeric, text, text, text, bigint, text, jsonb, jsonb),
  public.lock_sampling_run(uuid, text, text),
  public.activate_sampling_run(uuid),
  public.cancel_sampling_run(uuid, text),
  public.list_sampling_runs(),
  public.get_sampling_run(uuid),
  public.list_sampling_members(uuid),
  public.list_population_members(uuid)
  to authenticated;
alter function public.create_sampling_draft(uuid, numeric, text, text, text, bigint, text, jsonb, jsonb)
  owner to palmtrack_transaction_owner;
alter function public.lock_sampling_run(uuid, text, text)
  owner to palmtrack_transaction_owner;
alter function public.activate_sampling_run(uuid)
  owner to palmtrack_transaction_owner;
alter function public.cancel_sampling_run(uuid, text)
  owner to palmtrack_transaction_owner;
alter function public.list_sampling_runs()
  owner to palmtrack_transaction_owner;
alter function public.get_sampling_run(uuid)
  owner to palmtrack_transaction_owner;
alter function public.list_sampling_members(uuid)
  owner to palmtrack_transaction_owner;
alter function public.list_population_members(uuid)
  owner to palmtrack_transaction_owner;

commit;
