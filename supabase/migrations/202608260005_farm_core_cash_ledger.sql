begin;

-- 1. Create Tables

create table public.farmer (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  profile_id uuid not null,
  farmer_code text check (farmer_code is null or farmer_code ~ '^FMR-[0-9]{3,8}$'),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone_number text check (phone_number is null or phone_number ~ '^\+66[0-9]{8,9}$'),
  status public.record_status not null default 'active',
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null,
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text check (
    (deleted_at is null and deleted_by is null and delete_reason is null)
    or
    (deleted_at is not null and deleted_by is not null and delete_reason is not null and char_length(btrim(delete_reason)) between 3 and 500)
  ),
  constraint farmer_id_workspace_unique unique (id, workspace_id),
  constraint farmer_workspace_profile_unique unique (workspace_id, profile_id),
  constraint farmer_profile_fk foreign key (profile_id, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint farmer_created_by_fk foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint farmer_updated_by_fk foreign key (updated_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint farmer_deleted_by_fk foreign key (deleted_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict
);

create table public.farm (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  farmer_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  location_label text check (location_label is null or char_length(btrim(location_label)) between 1 and 200),
  total_area numeric(14,3) not null check (total_area >= 0.000),
  status public.record_status not null default 'active',
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null,
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text check (
    (deleted_at is null and deleted_by is null and delete_reason is null)
    or
    (deleted_at is not null and deleted_by is not null and delete_reason is not null and char_length(btrim(delete_reason)) between 3 and 500)
  ),
  constraint farm_id_workspace_unique unique (id, workspace_id),
  constraint farm_farmer_fk foreign key (farmer_id, workspace_id)
    references public.farmer (id, workspace_id) on delete restrict,
  constraint farm_created_by_fk foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint farm_updated_by_fk foreign key (updated_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint farm_deleted_by_fk foreign key (deleted_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict
);

create table public.plot (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  farm_id uuid not null,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  area numeric(14,3) not null check (area >= 0.000),
  status public.record_status not null default 'active',
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null,
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text check (
    (deleted_at is null and deleted_by is null and delete_reason is null)
    or
    (deleted_at is not null and deleted_by is not null and delete_reason is not null and char_length(btrim(delete_reason)) between 3 and 500)
  ),
  constraint plot_id_workspace_unique unique (id, workspace_id),
  constraint plot_id_farm_unique unique (id, farm_id),
  constraint plot_farm_fk foreign key (farm_id, workspace_id)
    references public.farm (id, workspace_id) on delete restrict,
  constraint plot_farm_code_unique unique (farm_id, code),
  constraint plot_created_by_fk foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint plot_updated_by_fk foreign key (updated_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint plot_deleted_by_fk foreign key (deleted_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict
);

create table public.expense (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  farm_id uuid not null,
  plot_id uuid,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  amount numeric(14,2) not null check (amount >= 0.00),
  expense_date date not null,
  notes text check (notes is null or char_length(btrim(notes)) <= 500),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null,
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text check (
    (deleted_at is null and deleted_by is null and delete_reason is null)
    or
    (deleted_at is not null and deleted_by is not null and delete_reason is not null and char_length(btrim(delete_reason)) between 3 and 500)
  ),
  constraint expense_id_workspace_unique unique (id, workspace_id),
  constraint expense_farm_fk foreign key (farm_id, workspace_id)
    references public.farm (id, workspace_id) on delete restrict,
  constraint expense_plot_farm_fk foreign key (plot_id, farm_id)
    references public.plot (id, farm_id) on delete restrict,
  constraint expense_created_by_fk foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint expense_updated_by_fk foreign key (updated_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint expense_deleted_by_fk foreign key (deleted_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict
);

create table public.sale (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  farm_id uuid not null,
  plot_id uuid,
  sale_date date not null,
  buyer_name text check (buyer_name is null or char_length(btrim(buyer_name)) between 1 and 120),
  quantity numeric(14,3) not null check (quantity > 0.000),
  unit_price numeric(14,2) not null check (unit_price >= 0.00),
  gross_amount numeric(14,2) not null check (gross_amount >= 0.00),
  deductions numeric(14,2) not null default 0.00 check (deductions >= 0.00),
  net_amount numeric(14,2) not null check (net_amount >= 0.00),
  notes text check (notes is null or char_length(btrim(notes)) <= 500),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null,
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text check (
    (deleted_at is null and deleted_by is null and delete_reason is null)
    or
    (deleted_at is not null and deleted_by is not null and delete_reason is not null and char_length(btrim(delete_reason)) between 3 and 500)
  ),
  constraint sale_id_workspace_unique unique (id, workspace_id),
  constraint sale_farm_fk foreign key (farm_id, workspace_id)
    references public.farm (id, workspace_id) on delete restrict,
  constraint sale_plot_farm_fk foreign key (plot_id, farm_id)
    references public.plot (id, farm_id) on delete restrict,
  constraint sale_created_by_fk foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint sale_updated_by_fk foreign key (updated_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint sale_deleted_by_fk foreign key (deleted_by, workspace_id)
    references public.user_profile (id, workspace_id) on delete restrict,
  constraint sale_gross_amount_formula_check check (gross_amount = round(quantity * unit_price, 2)),
  constraint sale_net_amount_formula_check check (net_amount = gross_amount - deductions)
);

-- Indexes
create index farmer_workspace_profile_idx on public.farmer (workspace_id, profile_id);
create index farm_workspace_farmer_idx on public.farm (workspace_id, farmer_id, created_at desc);
create index plot_workspace_farm_idx on public.plot (workspace_id, farm_id, code);
create index expense_workspace_farm_date_idx on public.expense (workspace_id, farm_id, expense_date desc);
create index sale_workspace_farm_date_idx on public.sale (workspace_id, farm_id, sale_date desc);

-- 2. RLS Enable & Grant to transaction owner

alter table public.farmer enable row level security;
alter table public.farmer force row level security;
alter table public.farm enable row level security;
alter table public.farm force row level security;
alter table public.plot enable row level security;
alter table public.plot force row level security;
alter table public.expense enable row level security;
alter table public.expense force row level security;
alter table public.sale enable row level security;
alter table public.sale force row level security;

revoke all on table public.farmer, public.farm, public.plot, public.expense, public.sale
  from public, anon, authenticated, service_role;

grant select, insert, update on table public.farmer, public.farm, public.plot, public.expense, public.sale
  to palmtrack_transaction_owner;

create policy farmer_internal_transactions on public.farmer
  for all to palmtrack_transaction_owner using (true) with check (true);
create policy farm_internal_transactions on public.farm
  for all to palmtrack_transaction_owner using (true) with check (true);
create policy plot_internal_transactions on public.plot
  for all to palmtrack_transaction_owner using (true) with check (true);
create policy expense_internal_transactions on public.expense
  for all to palmtrack_transaction_owner using (true) with check (true);
create policy sale_internal_transactions on public.sale
  for all to palmtrack_transaction_owner using (true) with check (true);

-- 3. Hard Delete Prevention Triggers

create or replace function private.reject_hard_deletion()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'hard deletion is prohibited for farm ledger entities';
end;
$$;

revoke all on function private.reject_hard_deletion()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

create trigger farmer_hard_delete_guard
before delete on public.farmer
for each row execute function private.reject_hard_deletion();

create trigger farm_hard_delete_guard
before delete on public.farm
for each row execute function private.reject_hard_deletion();

create trigger plot_hard_delete_guard
before delete on public.plot
for each row execute function private.reject_hard_deletion();

create trigger expense_hard_delete_guard
before delete on public.expense
for each row execute function private.reject_hard_deletion();

create trigger sale_hard_delete_guard
before delete on public.sale
for each row execute function private.reject_hard_deletion();

-- 4. Extend Audit Allowlist in private.append_audit_event

create table private.migration_202608260005_function_backup (
  function_identity text primary key,
  function_definition text not null
);

insert into private.migration_202608260005_function_backup (
  function_identity,
  function_definition
)
select
  'private.append_audit_event(uuid,uuid,text,text,uuid,text,jsonb)',
  pg_get_functiondef(
    'private.append_audit_event(uuid,uuid,text,text,uuid,text,jsonb)'::regprocedure
  );

revoke all on table private.migration_202608260005_function_backup
  from public, anon, authenticated, service_role,
    palmtrack_transaction_owner, palmtrack_recovery_executor;
grant select on table private.migration_202608260005_function_backup
  to palmtrack_audit_writer;

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
      'input_digest', 'candidate_set_hash', 'algorithm_version',
      'ordered_result_digest_version', 'ordered_result_hash'
    ]::text[]
    when 'sampling.run_locked' then array[
      'before_status', 'after_status', 'population_size', 'target_n', 'input_digest', 'candidate_set_hash', 'algorithm_version',
      'ordered_result_digest_version', 'ordered_result_hash'
    ]::text[]
    when 'sampling.run_activated' then array[
      'before_status', 'after_status', 'population_size', 'target_n', 'candidate_set_hash', 'algorithm_version',
      'ordered_result_digest_version', 'ordered_result_hash'
    ]::text[]
    when 'sampling.run_superseded' then array[
      'before_status', 'after_status', 'population_size', 'target_n', 'candidate_set_hash', 'algorithm_version',
      'ordered_result_digest_version', 'ordered_result_hash'
    ]::text[]
    when 'sampling.run_cancelled' then array[
      'before_status', 'after_status', 'population_size', 'target_n', 'reason_digest', 'candidate_set_hash', 'algorithm_version',
      'ordered_result_digest_version', 'ordered_result_hash'
    ]::text[]
    when 'sampling.run_regenerated' then array[
      'before_status', 'after_status', 'population_size', 'target_n', 'input_digest', 'candidate_set_hash', 'algorithm_version',
      'ordered_result_digest_version', 'ordered_result_hash'
    ]::text[]
    when 'farmer.profile_created' then array['full_name_digest', 'phone_number_present']::text[]
    when 'farm.created' then array['farmer_id', 'name_digest', 'total_area']::text[]
    when 'farm.updated' then array['before_name_digest', 'after_name_digest', 'before_total_area', 'after_total_area']::text[]
    when 'farm.soft_deleted' then array['before_status', 'after_status', 'delete_reason_digest']::text[]
    when 'plot.created' then array['farm_id', 'code_digest', 'name_digest', 'area']::text[]
    when 'plot.updated' then array['before_code_digest', 'after_code_digest', 'before_name_digest', 'after_name_digest', 'before_area', 'after_area']::text[]
    when 'plot.soft_deleted' then array['before_status', 'after_status', 'delete_reason_digest']::text[]
    when 'expense.created' then array['farm_id', 'category_digest', 'amount', 'expense_date']::text[]
    when 'expense.soft_deleted' then array['farm_id', 'amount', 'delete_reason_digest']::text[]
    when 'sale.created' then array['farm_id', 'quantity', 'unit_price', 'gross_amount', 'deductions', 'net_amount', 'sale_date']::text[]
    when 'sale.soft_deleted' then array['farm_id', 'net_amount', 'delete_reason_digest']::text[]
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
      or coalesce(p_details ->> 'ordered_result_digest_version', '') <> 'ordered-result-sha256-v1'
      or coalesce(p_details ->> 'ordered_result_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_locked' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'draft'
      or coalesce(p_details ->> 'after_status', '') <> 'locked'
      or coalesce(p_details ->> 'population_size', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
      or coalesce(p_details ->> 'ordered_result_digest_version', '') <> 'ordered-result-sha256-v1'
      or coalesce(p_details ->> 'ordered_result_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_activated' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'locked'
      or coalesce(p_details ->> 'after_status', '') <> 'active'
      or coalesce(p_details ->> 'population_size', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
      or coalesce(p_details ->> 'ordered_result_digest_version', '') <> 'ordered-result-sha256-v1'
      or coalesce(p_details ->> 'ordered_result_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_superseded' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'superseded'
      or coalesce(p_details ->> 'population_size', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
      or coalesce(p_details ->> 'ordered_result_digest_version', '') <> 'ordered-result-sha256-v1'
      or coalesce(p_details ->> 'ordered_result_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_cancelled' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> all(array['draft', 'locked']::text[])
      or coalesce(p_details ->> 'after_status', '') <> 'cancelled'
      or coalesce(p_details ->> 'population_size', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'reason_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
      or coalesce(p_details ->> 'ordered_result_digest_version', '') <> 'ordered-result-sha256-v1'
      or coalesce(p_details ->> 'ordered_result_hash', '') !~ '^[0-9a-f]{64}$'
    when 'sampling.run_regenerated' then
      p_entity_type <> 'sampling_run'
      or coalesce(p_details ->> 'before_status', '') <> 'draft'
      or coalesce(p_details ->> 'after_status', '') <> 'draft'
      or coalesce(p_details ->> 'population_size', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'target_n', '') !~ '^[1-9][0-9]*$'
      or coalesce(p_details ->> 'input_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'candidate_set_hash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'algorithm_version', '') <> 'sha256-mulberry32-fy-v1'
      or coalesce(p_details ->> 'ordered_result_digest_version', '') <> 'ordered-result-sha256-v1'
      or coalesce(p_details ->> 'ordered_result_hash', '') !~ '^[0-9a-f]{64}$'
    when 'farmer.profile_created' then
      p_entity_type <> 'farmer'
      or coalesce(p_details ->> 'full_name_digest', '') !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(p_details -> 'phone_number_present') is distinct from 'boolean'
    when 'farm.created' then
      p_entity_type <> 'farm'
      or coalesce(p_details ->> 'name_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'total_area', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
    when 'farm.updated' then
      p_entity_type <> 'farm'
      or coalesce(p_details ->> 'before_name_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'after_name_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'after_total_area', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
    when 'farm.soft_deleted' then
      p_entity_type <> 'farm'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'inactive'
      or coalesce(p_details ->> 'delete_reason_digest', '') !~ '^[0-9a-f]{64}$'
    when 'plot.created' then
      p_entity_type <> 'plot'
      or coalesce(p_details ->> 'code_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'name_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'area', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
    when 'plot.updated' then
      p_entity_type <> 'plot'
      or coalesce(p_details ->> 'before_code_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'after_code_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'before_name_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'after_name_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'after_area', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
    when 'plot.soft_deleted' then
      p_entity_type <> 'plot'
      or coalesce(p_details ->> 'before_status', '') <> 'active'
      or coalesce(p_details ->> 'after_status', '') <> 'inactive'
      or coalesce(p_details ->> 'delete_reason_digest', '') !~ '^[0-9a-f]{64}$'
    when 'expense.created' then
      p_entity_type <> 'expense'
      or coalesce(p_details ->> 'category_digest', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_details ->> 'amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'expense_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    when 'expense.soft_deleted' then
      p_entity_type <> 'expense'
      or coalesce(p_details ->> 'amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'delete_reason_digest', '') !~ '^[0-9a-f]{64}$'
    when 'sale.created' then
      p_entity_type <> 'sale'
      or coalesce(p_details ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or coalesce(p_details ->> 'unit_price', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'gross_amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'deductions', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'net_amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'sale_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    when 'sale.soft_deleted' then
      p_entity_type <> 'sale'
      or coalesce(p_details ->> 'net_amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(p_details ->> 'delete_reason_digest', '') !~ '^[0-9a-f]{64}$'
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

-- 5. Helper & Business Functions for Farmer

create or replace function public.ensure_farmer_profile(
  p_full_name text default null,
  p_phone_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_farmer_id uuid;
  v_name text := coalesce(btrim(p_full_name), 'เกษตรกรผู้ใช้งาน');
  v_phone text := nullif(btrim(p_phone_number), '');
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select id into v_farmer_id
  from public.farmer
  where workspace_id = v_workspace_id
    and profile_id = v_profile_id
    and deleted_at is null;

  if found then
    return v_farmer_id;
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'farmer name is invalid';
  end if;

  if v_phone is not null and v_phone !~ '^\+66[0-9]{8,9}$' then
    raise exception using errcode = '22023', message = 'phone number is invalid';
  end if;

  v_farmer_id := gen_random_uuid();

  insert into public.farmer (
    id, workspace_id, profile_id, full_name, phone_number,
    status, created_by, updated_by
  ) values (
    v_farmer_id, v_workspace_id, v_profile_id, v_name, v_phone,
    'active', v_profile_id, v_profile_id
  );

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'farmer.profile_created',
    'farmer',
    v_farmer_id,
    'success',
    jsonb_build_object(
      'full_name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex'),
      'phone_number_present', v_phone is not null
    )
  );

  return v_farmer_id;
end;
$$;

create or replace function public.list_my_farms()
returns table (
  id uuid,
  farmer_id uuid,
  name text,
  location_label text,
  total_area text,
  plot_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    f.id,
    f.farmer_id,
    f.name,
    f.location_label,
    f.total_area::text,
    count(p.id) filter (where p.deleted_at is null)::integer as plot_count,
    f.created_at
  from public.farm as f
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  left join public.plot as p
    on p.farm_id = f.id
   and p.workspace_id = v_workspace_id
  where f.workspace_id = v_workspace_id
    and f.deleted_at is null
  group by f.id, f.farmer_id, f.name, f.location_label, f.total_area, f.created_at
  order by f.created_at desc, f.id;
end;
$$;

create or replace function public.create_farm(
  p_name text,
  p_location_label text,
  p_total_area numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_farmer_id uuid;
  v_farm_id uuid;
  v_name text := btrim(p_name);
  v_location text := nullif(btrim(p_location_label), '');
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  v_farmer_id := public.ensure_farmer_profile();

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'farm name is invalid';
  end if;

  if p_total_area is null or p_total_area < 0.000 then
    raise exception using errcode = '22023', message = 'total area must be non-negative';
  end if;

  v_farm_id := gen_random_uuid();

  insert into public.farm (
    id, workspace_id, farmer_id, name, location_label, total_area,
    status, created_by, updated_by
  ) values (
    v_farm_id, v_workspace_id, v_farmer_id, v_name, v_location, p_total_area,
    'active', v_profile_id, v_profile_id
  );

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'farm.created',
    'farm',
    v_farm_id,
    'success',
    jsonb_build_object(
      'farmer_id', v_farmer_id,
      'name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex'),
      'total_area', to_char(p_total_area, 'FM9999999990.000')
    )
  );

  return v_farm_id;
end;
$$;

create or replace function public.update_farm(
  p_farm_id uuid,
  p_name text,
  p_location_label text,
  p_total_area numeric
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_farm public.farm%rowtype;
  v_name text := btrim(p_name);
  v_location text := nullif(btrim(p_location_label), '');
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select f.* into v_farm
  from public.farm as f
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where f.id = p_farm_id
    and f.workspace_id = v_workspace_id
    and f.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'farm not found or access denied';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'farm name is invalid';
  end if;

  if p_total_area is null or p_total_area < 0.000 then
    raise exception using errcode = '22023', message = 'total area must be non-negative';
  end if;

  if p_total_area < (
    select coalesce(sum(p.area), 0.000)
    from public.plot as p
    where p.farm_id = p_farm_id
      and p.workspace_id = v_workspace_id
      and p.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'total area cannot be less than active plot area';
  end if;

  update public.farm
  set name = v_name,
      location_label = v_location,
      total_area = p_total_area,
      updated_by = v_profile_id,
      updated_at = statement_timestamp()
  where id = p_farm_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'farm.updated',
    'farm',
    p_farm_id,
    'success',
    jsonb_build_object(
      'before_name_digest', encode(extensions.digest(convert_to(v_farm.name, 'UTF8'), 'sha256'), 'hex'),
      'after_name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex'),
      'before_total_area', to_char(v_farm.total_area, 'FM9999999990.000'),
      'after_total_area', to_char(p_total_area, 'FM9999999990.000')
    )
  );
end;
$$;

create or replace function public.soft_delete_farm(
  p_farm_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_reason text := btrim(p_reason);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'delete reason is required';
  end if;

  if not exists (
    select 1
    from public.farm as f
    join public.farmer as fmr
      on fmr.id = f.farmer_id
     and fmr.profile_id = v_profile_id
     and fmr.workspace_id = v_workspace_id
     and fmr.deleted_at is null
    where f.id = p_farm_id
      and f.workspace_id = v_workspace_id
      and f.deleted_at is null
    for update
  ) then
    raise exception using errcode = '42501', message = 'farm not found or access denied';
  end if;

  update public.farm
  set deleted_at = statement_timestamp(),
      deleted_by = v_profile_id,
      delete_reason = v_reason,
      status = 'inactive',
      updated_at = statement_timestamp(),
      updated_by = v_profile_id
  where id = p_farm_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'farm.soft_deleted',
    'farm',
    p_farm_id,
    'success',
    jsonb_build_object(
      'before_status', 'active',
      'after_status', 'inactive',
      'delete_reason_digest', encode(extensions.digest(convert_to(v_reason, 'UTF8'), 'sha256'), 'hex')
    )
  );
end;
$$;

create or replace function public.list_my_plots(p_farm_id uuid)
returns table (
  id uuid,
  farm_id uuid,
  code text,
  name text,
  area text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    p.id,
    p.farm_id,
    p.code,
    p.name,
    p.area::text,
    p.created_at
  from public.plot as p
  join public.farm as f
    on f.id = p.farm_id
   and f.workspace_id = v_workspace_id
   and f.deleted_at is null
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where p.farm_id = p_farm_id
    and p.workspace_id = v_workspace_id
    and p.deleted_at is null
  order by p.code asc, p.created_at desc;
end;
$$;

create or replace function public.create_plot(
  p_farm_id uuid,
  p_code text,
  p_name text,
  p_area numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_plot_id uuid;
  v_farm_total_area numeric(14,3);
  v_code text := btrim(p_code);
  v_name text := btrim(p_name);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select f.total_area into v_farm_total_area
    from public.farm as f
    join public.farmer as fmr
      on fmr.id = f.farmer_id
     and fmr.profile_id = v_profile_id
     and fmr.workspace_id = v_workspace_id
     and fmr.deleted_at is null
    where f.id = p_farm_id
      and f.workspace_id = v_workspace_id
      and f.deleted_at is null
    for update of f;

  if not found then
    raise exception using errcode = '42501', message = 'farm not found or access denied';
  end if;

  if char_length(v_code) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'plot code is invalid';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'plot name is invalid';
  end if;

  if p_area is null or p_area < 0.000 then
    raise exception using errcode = '22023', message = 'plot area must be non-negative';
  end if;

  if (
    select coalesce(sum(p.area), 0.000) + p_area
    from public.plot as p
    where p.farm_id = p_farm_id
      and p.workspace_id = v_workspace_id
      and p.deleted_at is null
  ) > v_farm_total_area then
    raise exception using errcode = '22023', message = 'active plot area cannot exceed farm total area';
  end if;

  v_plot_id := gen_random_uuid();

  insert into public.plot (
    id, workspace_id, farm_id, code, name, area,
    status, created_by, updated_by
  ) values (
    v_plot_id, v_workspace_id, p_farm_id, v_code, v_name, p_area,
    'active', v_profile_id, v_profile_id
  );

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'plot.created',
    'plot',
    v_plot_id,
    'success',
    jsonb_build_object(
      'farm_id', p_farm_id,
      'code_digest', encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'),
      'name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex'),
      'area', to_char(p_area, 'FM9999999990.000')
    )
  );

  return v_plot_id;
end;
$$;

create or replace function public.update_plot(
  p_plot_id uuid,
  p_code text,
  p_name text,
  p_area numeric
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_plot public.plot%rowtype;
  v_farm_total_area numeric(14,3);
  v_code text := btrim(p_code);
  v_name text := btrim(p_name);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select p.* into v_plot
  from public.plot as p
  join public.farm as f
    on f.id = p.farm_id
   and f.workspace_id = v_workspace_id
   and f.deleted_at is null
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where p.id = p_plot_id
    and p.workspace_id = v_workspace_id
    and p.deleted_at is null
  for update of p, f;

  if not found then
    raise exception using errcode = '42501', message = 'plot not found or access denied';
  end if;

  if char_length(v_code) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'plot code is invalid';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'plot name is invalid';
  end if;

  if p_area is null or p_area < 0.000 then
    raise exception using errcode = '22023', message = 'plot area must be non-negative';
  end if;

  select f.total_area into v_farm_total_area
  from public.farm as f
  where f.id = v_plot.farm_id
    and f.workspace_id = v_workspace_id;

  if (
    select coalesce(sum(p.area), 0.000) + p_area
    from public.plot as p
    where p.farm_id = v_plot.farm_id
      and p.workspace_id = v_workspace_id
      and p.deleted_at is null
      and p.id <> p_plot_id
  ) > v_farm_total_area then
    raise exception using errcode = '22023', message = 'active plot area cannot exceed farm total area';
  end if;

  update public.plot
  set code = v_code,
      name = v_name,
      area = p_area,
      updated_by = v_profile_id,
      updated_at = statement_timestamp()
  where id = p_plot_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'plot.updated',
    'plot',
    p_plot_id,
    'success',
    jsonb_build_object(
      'before_code_digest', encode(extensions.digest(convert_to(v_plot.code, 'UTF8'), 'sha256'), 'hex'),
      'after_code_digest', encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'),
      'before_name_digest', encode(extensions.digest(convert_to(v_plot.name, 'UTF8'), 'sha256'), 'hex'),
      'after_name_digest', encode(extensions.digest(convert_to(v_name, 'UTF8'), 'sha256'), 'hex'),
      'before_area', to_char(v_plot.area, 'FM9999999990.000'),
      'after_area', to_char(p_area, 'FM9999999990.000')
    )
  );
end;
$$;

create or replace function public.soft_delete_plot(
  p_plot_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_reason text := btrim(p_reason);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'delete reason is required';
  end if;

  if not exists (
    select 1
    from public.plot as p
    join public.farm as f
      on f.id = p.farm_id
     and f.workspace_id = v_workspace_id
     and f.deleted_at is null
    join public.farmer as fmr
      on fmr.id = f.farmer_id
     and fmr.profile_id = v_profile_id
     and fmr.workspace_id = v_workspace_id
     and fmr.deleted_at is null
    where p.id = p_plot_id
      and p.workspace_id = v_workspace_id
      and p.deleted_at is null
    for update
  ) then
    raise exception using errcode = '42501', message = 'plot not found or access denied';
  end if;

  update public.plot
  set deleted_at = statement_timestamp(),
      deleted_by = v_profile_id,
      delete_reason = v_reason,
      status = 'inactive',
      updated_at = statement_timestamp(),
      updated_by = v_profile_id
  where id = p_plot_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'plot.soft_deleted',
    'plot',
    p_plot_id,
    'success',
    jsonb_build_object(
      'before_status', 'active',
      'after_status', 'inactive',
      'delete_reason_digest', encode(extensions.digest(convert_to(v_reason, 'UTF8'), 'sha256'), 'hex')
    )
  );
end;
$$;

create or replace function public.list_my_expenses(
  p_farm_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_include_deleted boolean default false
)
returns table (
  id uuid,
  farm_id uuid,
  farm_name text,
  plot_id uuid,
  plot_code text,
  category text,
  amount text,
  expense_date date,
  notes text,
  is_deleted boolean,
  delete_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    e.id,
    e.farm_id,
    f.name as farm_name,
    e.plot_id,
    p.code as plot_code,
    e.category,
    e.amount::text,
    e.expense_date,
    e.notes,
    (e.deleted_at is not null) as is_deleted,
    e.delete_reason,
    e.created_at
  from public.expense as e
  join public.farm as f
    on f.id = e.farm_id
   and f.workspace_id = v_workspace_id
   and f.deleted_at is null
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  left join public.plot as p
    on p.id = e.plot_id
   and p.workspace_id = v_workspace_id
  where e.workspace_id = v_workspace_id
    and (p_farm_id is null or e.farm_id = p_farm_id)
    and (p_from_date is null or e.expense_date >= p_from_date)
    and (p_to_date is null or e.expense_date <= p_to_date)
    and (p_include_deleted or e.deleted_at is null)
  order by e.expense_date desc, e.created_at desc;
end;
$$;

create or replace function public.create_expense(
  p_farm_id uuid,
  p_plot_id uuid,
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_expense_id uuid;
  v_category text := btrim(p_category);
  v_notes text := nullif(btrim(p_notes), '');
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if not exists (
    select 1
    from public.farm as f
    join public.farmer as fmr
      on fmr.id = f.farmer_id
     and fmr.profile_id = v_profile_id
     and fmr.workspace_id = v_workspace_id
     and fmr.deleted_at is null
    where f.id = p_farm_id
      and f.workspace_id = v_workspace_id
      and f.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'farm not found or access denied';
  end if;

  if p_plot_id is not null and not exists (
    select 1
    from public.plot as p
    where p.id = p_plot_id
      and p.farm_id = p_farm_id
      and p.workspace_id = v_workspace_id
      and p.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'plot does not belong to the selected farm';
  end if;

  if char_length(v_category) not between 1 and 60 then
    raise exception using errcode = '22023', message = 'category is invalid';
  end if;

  if p_amount is null or p_amount < 0.00 then
    raise exception using errcode = '22023', message = 'amount must be non-negative';
  end if;

  if p_expense_date is null then
    raise exception using errcode = '22023', message = 'expense date is required';
  end if;

  v_expense_id := gen_random_uuid();

  insert into public.expense (
    id, workspace_id, farm_id, plot_id, category, amount,
    expense_date, notes, created_by, updated_by
  ) values (
    v_expense_id, v_workspace_id, p_farm_id, p_plot_id, v_category, p_amount,
    p_expense_date, v_notes, v_profile_id, v_profile_id
  );

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'expense.created',
    'expense',
    v_expense_id,
    'success',
    jsonb_build_object(
      'farm_id', p_farm_id,
      'category_digest', encode(extensions.digest(convert_to(v_category, 'UTF8'), 'sha256'), 'hex'),
      'amount', to_char(p_amount, 'FM9999999990.00'),
      'expense_date', p_expense_date::text
    )
  );

  return v_expense_id;
end;
$$;

create or replace function public.soft_delete_expense(
  p_expense_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_expense public.expense%rowtype;
  v_reason text := btrim(p_reason);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'delete reason is required';
  end if;

  select e.* into v_expense
  from public.expense as e
  join public.farm as f
    on f.id = e.farm_id
   and f.workspace_id = v_workspace_id
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where e.id = p_expense_id
    and e.workspace_id = v_workspace_id
    and e.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'expense not found or access denied';
  end if;

  update public.expense
  set deleted_at = statement_timestamp(),
      deleted_by = v_profile_id,
      delete_reason = v_reason,
      updated_at = statement_timestamp(),
      updated_by = v_profile_id
  where id = p_expense_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'expense.soft_deleted',
    'expense',
    p_expense_id,
    'success',
    jsonb_build_object(
      'farm_id', v_expense.farm_id,
      'amount', to_char(v_expense.amount, 'FM9999999990.00'),
      'delete_reason_digest', encode(extensions.digest(convert_to(v_reason, 'UTF8'), 'sha256'), 'hex')
    )
  );
end;
$$;

create or replace function public.list_my_sales(
  p_farm_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_include_deleted boolean default false
)
returns table (
  id uuid,
  farm_id uuid,
  farm_name text,
  plot_id uuid,
  plot_code text,
  sale_date date,
  buyer_name text,
  quantity text,
  unit_price text,
  gross_amount text,
  deductions text,
  net_amount text,
  notes text,
  is_deleted boolean,
  delete_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    s.id,
    s.farm_id,
    f.name as farm_name,
    s.plot_id,
    p.code as plot_code,
    s.sale_date,
    s.buyer_name,
    s.quantity::text,
    s.unit_price::text,
    s.gross_amount::text,
    s.deductions::text,
    s.net_amount::text,
    s.notes,
    (s.deleted_at is not null) as is_deleted,
    s.delete_reason,
    s.created_at
  from public.sale as s
  join public.farm as f
    on f.id = s.farm_id
   and f.workspace_id = v_workspace_id
   and f.deleted_at is null
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  left join public.plot as p
    on p.id = s.plot_id
   and p.workspace_id = v_workspace_id
  where s.workspace_id = v_workspace_id
    and (p_farm_id is null or s.farm_id = p_farm_id)
    and (p_from_date is null or s.sale_date >= p_from_date)
    and (p_to_date is null or s.sale_date <= p_to_date)
    and (p_include_deleted or s.deleted_at is null)
  order by s.sale_date desc, s.created_at desc;
end;
$$;

create or replace function public.create_sale(
  p_farm_id uuid,
  p_plot_id uuid,
  p_sale_date date,
  p_buyer_name text,
  p_quantity numeric,
  p_unit_price numeric,
  p_deductions numeric default 0.00,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_sale_id uuid;
  v_buyer text := nullif(btrim(p_buyer_name), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_deductions numeric(14,2) := coalesce(p_deductions, 0.00);
  v_gross numeric(14,2);
  v_net numeric(14,2);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if not exists (
    select 1
    from public.farm as f
    join public.farmer as fmr
      on fmr.id = f.farmer_id
     and fmr.profile_id = v_profile_id
     and fmr.workspace_id = v_workspace_id
     and fmr.deleted_at is null
    where f.id = p_farm_id
      and f.workspace_id = v_workspace_id
      and f.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'farm not found or access denied';
  end if;

  if p_plot_id is not null and not exists (
    select 1
    from public.plot as p
    where p.id = p_plot_id
      and p.farm_id = p_farm_id
      and p.workspace_id = v_workspace_id
      and p.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'plot does not belong to the selected farm';
  end if;

  if p_quantity is null or p_quantity <= 0.000 then
    raise exception using errcode = '22023', message = 'quantity must be positive';
  end if;

  if p_unit_price is null or p_unit_price < 0.00 then
    raise exception using errcode = '22023', message = 'unit price must be non-negative';
  end if;

  if v_deductions < 0.00 then
    raise exception using errcode = '22023', message = 'deductions must be non-negative';
  end if;

  if p_sale_date is null then
    raise exception using errcode = '22023', message = 'sale date is required';
  end if;

  v_gross := round(p_quantity * p_unit_price, 2);
  v_net := v_gross - v_deductions;

  if v_net < 0.00 then
    raise exception using errcode = '22023', message = 'deductions cannot exceed gross amount';
  end if;

  v_sale_id := gen_random_uuid();

  insert into public.sale (
    id, workspace_id, farm_id, plot_id, sale_date, buyer_name,
    quantity, unit_price, gross_amount, deductions, net_amount,
    notes, created_by, updated_by
  ) values (
    v_sale_id, v_workspace_id, p_farm_id, p_plot_id, p_sale_date, v_buyer,
    p_quantity, p_unit_price, v_gross, v_deductions, v_net,
    v_notes, v_profile_id, v_profile_id
  );

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'sale.created',
    'sale',
    v_sale_id,
    'success',
    jsonb_build_object(
      'farm_id', p_farm_id,
      'quantity', to_char(p_quantity, 'FM9999999990.000'),
      'unit_price', to_char(p_unit_price, 'FM9999999990.00'),
      'gross_amount', to_char(v_gross, 'FM9999999990.00'),
      'deductions', to_char(v_deductions, 'FM9999999990.00'),
      'net_amount', to_char(v_net, 'FM9999999990.00'),
      'sale_date', p_sale_date::text
    )
  );

  return v_sale_id;
end;
$$;

create or replace function public.soft_delete_sale(
  p_sale_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_sale public.sale%rowtype;
  v_reason text := btrim(p_reason);
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'delete reason is required';
  end if;

  select s.* into v_sale
  from public.sale as s
  join public.farm as f
    on f.id = s.farm_id
   and f.workspace_id = v_workspace_id
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where s.id = p_sale_id
    and s.workspace_id = v_workspace_id
    and s.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'sale not found or access denied';
  end if;

  update public.sale
  set deleted_at = statement_timestamp(),
      deleted_by = v_profile_id,
      delete_reason = v_reason,
      updated_at = statement_timestamp(),
      updated_by = v_profile_id
  where id = p_sale_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'sale.soft_deleted',
    'sale',
    p_sale_id,
    'success',
    jsonb_build_object(
      'farm_id', v_sale.farm_id,
      'net_amount', to_char(v_sale.net_amount, 'FM9999999990.00'),
      'delete_reason_digest', encode(extensions.digest(convert_to(v_reason, 'UTF8'), 'sha256'), 'hex')
    )
  );
end;
$$;

create or replace function public.get_my_cash_ledger_summary(
  p_farm_id uuid default null,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  net_income text,
  expense_total text,
  cash_result text,
  sale_count integer,
  expense_count integer,
  has_records boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_role public.app_role := public.current_role();
  v_sales_sum numeric(14,2) := 0.00;
  v_expenses_sum numeric(14,2) := 0.00;
  v_sales_cnt integer := 0;
  v_expenses_cnt integer := 0;
begin
  if v_role is distinct from 'farmer'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  -- Sum active sales
  select
    coalesce(sum(s.net_amount), 0.00),
    count(s.id)::integer
  into v_sales_sum, v_sales_cnt
  from public.sale as s
  join public.farm as f
    on f.id = s.farm_id
   and f.workspace_id = v_workspace_id
   and f.deleted_at is null
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where s.workspace_id = v_workspace_id
    and s.deleted_at is null
    and (p_farm_id is null or s.farm_id = p_farm_id)
    and (p_from_date is null or s.sale_date >= p_from_date)
    and (p_to_date is null or s.sale_date <= p_to_date);

  -- Sum active expenses
  select
    coalesce(sum(e.amount), 0.00),
    count(e.id)::integer
  into v_expenses_sum, v_expenses_cnt
  from public.expense as e
  join public.farm as f
    on f.id = e.farm_id
   and f.workspace_id = v_workspace_id
   and f.deleted_at is null
  join public.farmer as fmr
    on fmr.id = f.farmer_id
   and fmr.profile_id = v_profile_id
   and fmr.workspace_id = v_workspace_id
   and fmr.deleted_at is null
  where e.workspace_id = v_workspace_id
    and e.deleted_at is null
    and (p_farm_id is null or e.farm_id = p_farm_id)
    and (p_from_date is null or e.expense_date >= p_from_date)
    and (p_to_date is null or e.expense_date <= p_to_date);

  return query select
    v_sales_sum::text,
    v_expenses_sum::text,
    (v_sales_sum - v_expenses_sum)::text,
    v_sales_cnt,
    v_expenses_cnt,
    ((v_sales_cnt + v_expenses_cnt) > 0);
end;
$$;

-- 6. Comments, Revokes & Grants for RPCs

comment on function public.ensure_farmer_profile(text, text)
  is 'Ensures a farmer record exists for the calling farmer.';
comment on function public.list_my_farms()
  is 'Returns active farms owned by the calling farmer.';
comment on function public.create_farm(text, text, numeric)
  is 'Creates a farm owned by the calling farmer with audit.';
comment on function public.update_farm(uuid, text, text, numeric)
  is 'Updates a farm owned by the calling farmer with audit.';
comment on function public.soft_delete_farm(uuid, text)
  is 'Soft deletes a farm owned by the calling farmer with required reason and audit.';
comment on function public.list_my_plots(uuid)
  is 'Returns active plots for a farm owned by the calling farmer.';
comment on function public.create_plot(uuid, text, text, numeric)
  is 'Creates a plot for a farm owned by the calling farmer with audit.';
comment on function public.update_plot(uuid, text, text, numeric)
  is 'Updates a plot owned by the calling farmer with audit.';
comment on function public.soft_delete_plot(uuid, text)
  is 'Soft deletes a plot owned by the calling farmer with required reason and audit.';
comment on function public.list_my_expenses(uuid, date, date, boolean)
  is 'Lists expenses for farms owned by the calling farmer.';
comment on function public.create_expense(uuid, uuid, text, numeric, date, text)
  is 'Records an expense for a farm owned by the calling farmer with audit.';
comment on function public.soft_delete_expense(uuid, text)
  is 'Soft deletes an expense with required reason and audit.';
comment on function public.list_my_sales(uuid, date, date, boolean)
  is 'Lists sales for farms owned by the calling farmer.';
comment on function public.create_sale(uuid, uuid, date, text, numeric, numeric, numeric, text)
  is 'Records a sale with verified gross/net calculations and audit.';
comment on function public.soft_delete_sale(uuid, text)
  is 'Soft deletes a sale with required reason and audit.';
comment on function public.get_my_cash_ledger_summary(uuid, date, date)
  is 'Returns period active cash summary (net income, expenses, cash profit) strictly excluding soft-deleted rows.';

revoke all on function
  public.ensure_farmer_profile(text, text),
  public.list_my_farms(),
  public.create_farm(text, text, numeric),
  public.update_farm(uuid, text, text, numeric),
  public.soft_delete_farm(uuid, text),
  public.list_my_plots(uuid),
  public.create_plot(uuid, text, text, numeric),
  public.update_plot(uuid, text, text, numeric),
  public.soft_delete_plot(uuid, text),
  public.list_my_expenses(uuid, date, date, boolean),
  public.create_expense(uuid, uuid, text, numeric, date, text),
  public.soft_delete_expense(uuid, text),
  public.list_my_sales(uuid, date, date, boolean),
  public.create_sale(uuid, uuid, date, text, numeric, numeric, numeric, text),
  public.soft_delete_sale(uuid, text),
  public.get_my_cash_ledger_summary(uuid, date, date)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

grant execute on function
  public.ensure_farmer_profile(text, text),
  public.list_my_farms(),
  public.create_farm(text, text, numeric),
  public.update_farm(uuid, text, text, numeric),
  public.soft_delete_farm(uuid, text),
  public.list_my_plots(uuid),
  public.create_plot(uuid, text, text, numeric),
  public.update_plot(uuid, text, text, numeric),
  public.soft_delete_plot(uuid, text),
  public.list_my_expenses(uuid, date, date, boolean),
  public.create_expense(uuid, uuid, text, numeric, date, text),
  public.soft_delete_expense(uuid, text),
  public.list_my_sales(uuid, date, date, boolean),
  public.create_sale(uuid, uuid, date, text, numeric, numeric, numeric, text),
  public.soft_delete_sale(uuid, text),
  public.get_my_cash_ledger_summary(uuid, date, date)
  to authenticated;

alter function public.ensure_farmer_profile(text, text) owner to palmtrack_transaction_owner;
alter function public.list_my_farms() owner to palmtrack_transaction_owner;
alter function public.create_farm(text, text, numeric) owner to palmtrack_transaction_owner;
alter function public.update_farm(uuid, text, text, numeric) owner to palmtrack_transaction_owner;
alter function public.soft_delete_farm(uuid, text) owner to palmtrack_transaction_owner;
alter function public.list_my_plots(uuid) owner to palmtrack_transaction_owner;
alter function public.create_plot(uuid, text, text, numeric) owner to palmtrack_transaction_owner;
alter function public.update_plot(uuid, text, text, numeric) owner to palmtrack_transaction_owner;
alter function public.soft_delete_plot(uuid, text) owner to palmtrack_transaction_owner;
alter function public.list_my_expenses(uuid, date, date, boolean) owner to palmtrack_transaction_owner;
alter function public.create_expense(uuid, uuid, text, numeric, date, text) owner to palmtrack_transaction_owner;
alter function public.soft_delete_expense(uuid, text) owner to palmtrack_transaction_owner;
alter function public.list_my_sales(uuid, date, date, boolean) owner to palmtrack_transaction_owner;
alter function public.create_sale(uuid, uuid, date, text, numeric, numeric, numeric, text) owner to palmtrack_transaction_owner;
alter function public.soft_delete_sale(uuid, text) owner to palmtrack_transaction_owner;
alter function public.get_my_cash_ledger_summary(uuid, date, date) owner to palmtrack_transaction_owner;

commit;
