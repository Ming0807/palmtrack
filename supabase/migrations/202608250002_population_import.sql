begin;

create type public.population_import_status as enum ('validated', 'accepted');

create table public.population_import (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  source_label text not null check (char_length(btrim(source_label)) between 1 and 120),
  source_authorization_ref text not null
    check (source_authorization_ref ~ '^SYN-[A-Z0-9_-]{3,40}$'),
  reference_date date not null,
  schema_version text not null check (schema_version = 'synthetic-population-v1'),
  eligibility_rule_version text not null
    check (eligibility_rule_version = 'synthetic-eligibility-v1'),
  input_digest text not null check (input_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null,
  total_count integer not null check (total_count > 0),
  eligible_count integer not null check (eligible_count between 0 and total_count),
  excluded_count integer not null check (excluded_count = total_count - eligible_count),
  status public.population_import_status not null default 'validated',
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  accepted_by uuid,
  accepted_at timestamptz,
  constraint population_import_workspace_idempotency_unique
    unique (workspace_id, idempotency_key),
  constraint population_import_id_workspace_unique unique (id, workspace_id),
  constraint population_import_created_by_workspace_fk
    foreign key (created_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint population_import_accepted_by_workspace_fk
    foreign key (accepted_by, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict,
  constraint population_import_acceptance_state_check check (
    (status = 'validated' and accepted_by is null and accepted_at is null)
    or
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
  )
);

create table public.population_member (
  id uuid primary key default gen_random_uuid(),
  population_import_id uuid not null,
  workspace_id uuid not null,
  row_number integer not null check (row_number > 0),
  farmer_code text not null check (farmer_code ~ '^SYN-[0-9]{3,6}$'),
  stratum_code text not null check (stratum_code ~ '^[A-Z0-9_-]{1,24}$'),
  eligible boolean not null,
  exclusion_reason_code text check (
    exclusion_reason_code in ('OUT_OF_SCOPE', 'DUPLICATE_SOURCE', 'INELIGIBLE_RULE')
  ),
  constraint population_member_import_workspace_fk
    foreign key (population_import_id, workspace_id)
    references public.population_import (id, workspace_id)
    on delete restrict,
  constraint population_member_import_row_unique
    unique (population_import_id, row_number),
  constraint population_member_import_farmer_unique
    unique (population_import_id, farmer_code),
  constraint population_member_eligibility_reason_check check (
    (eligible and exclusion_reason_code is null)
    or
    (not eligible and exclusion_reason_code is not null)
  )
);

create index population_import_workspace_created_idx
  on public.population_import (workspace_id, created_at desc);
create index population_member_import_stratum_idx
  on public.population_member (population_import_id, stratum_code, row_number);

alter table public.population_import enable row level security;
alter table public.population_import force row level security;
alter table public.population_member enable row level security;
alter table public.population_member force row level security;

revoke all on table public.population_import, public.population_member
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.population_import
  to palmtrack_transaction_owner;
grant select, insert on table public.population_member
  to palmtrack_transaction_owner;

create policy population_import_internal_transactions
  on public.population_import
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create policy population_member_internal_transactions
  on public.population_member
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create or replace function private.guard_population_import_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'validated'
    and new.status = 'accepted'
    and new.accepted_by is not null
    and new.accepted_at is not null
    and (
      to_jsonb(new) - array['status', 'accepted_by', 'accepted_at']::text[]
    ) = (
      to_jsonb(old) - array['status', 'accepted_by', 'accepted_at']::text[]
    )
  then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'population import is immutable outside validated acceptance';
end;
$$;

create or replace function private.reject_population_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'population snapshot records are immutable';
end;
$$;

revoke all on function private.guard_population_import_update(),
  private.reject_population_mutation()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

create trigger population_import_update_guard
before update on public.population_import
for each row execute function private.guard_population_import_update();

create trigger population_import_delete_guard
before delete on public.population_import
for each row execute function private.reject_population_mutation();

create trigger population_import_truncate_guard
before truncate on public.population_import
for each statement execute function private.reject_population_mutation();

create trigger population_member_update_guard
before update on public.population_member
for each row execute function private.reject_population_mutation();

create trigger population_member_delete_guard
before delete on public.population_member
for each row execute function private.reject_population_mutation();

create trigger population_member_truncate_guard
before truncate on public.population_member
for each statement execute function private.reject_population_mutation();

alter function private.guard_population_import_update()
  owner to palmtrack_transaction_owner;
alter function private.reject_population_mutation()
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

create or replace function public.create_population_import(
  p_source_label text,
  p_source_authorization_ref text,
  p_reference_date date,
  p_schema_version text,
  p_eligibility_rule_version text,
  p_input_digest text,
  p_rows jsonb,
  p_idempotency_key uuid
)
returns table (
  id uuid,
  source_label text,
  source_authorization_ref text,
  reference_date date,
  schema_version text,
  eligibility_rule_version text,
  input_digest text,
  total_count integer,
  eligible_count integer,
  excluded_count integer,
  status public.population_import_status,
  created_by_profile_id uuid,
  created_at timestamptz,
  accepted_by_profile_id uuid,
  accepted_at timestamptz
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
  v_total_count integer;
  v_eligible_count integer;
  v_canonical_text text;
  v_computed_digest text;
begin
  if v_role is null or v_role not in ('admin', 'research_manager') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if v_actor_profile_id is null or v_workspace_id is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  if char_length(btrim(p_source_label)) not between 1 and 120
    or p_source_authorization_ref !~ '^SYN-[A-Z0-9_-]{3,40}$'
    or p_reference_date is null
    or p_schema_version <> 'synthetic-population-v1'
    or p_eligibility_rule_version <> 'synthetic-eligibility-v1'
    or p_input_digest !~ '^[0-9a-f]{64}$'
    or p_idempotency_key is null
  then
    raise exception using errcode = '22023', message = 'population import metadata is invalid';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) = 0
  then
    raise exception using errcode = '22023', message = 'population rows are invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as row_item
    where jsonb_typeof(row_item) is distinct from 'object'
  ) then
    raise exception using errcode = '22023', message = 'population rows are invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_item
    where (select count(*) from jsonb_object_keys(row_item)) <> 5
       or exists (
         select 1 from jsonb_object_keys(row_item) as row_key
         where row_key <> all(array[
           'row_number', 'farmer_code', 'stratum_code',
           'eligible', 'exclusion_reason_code'
         ]::text[])
       )
       or jsonb_typeof(row_item -> 'row_number') is distinct from 'number'
       or coalesce(row_item ->> 'row_number', '') !~ '^[1-9][0-9]*$'
       or jsonb_typeof(row_item -> 'farmer_code') is distinct from 'string'
       or coalesce(row_item ->> 'farmer_code', '') !~ '^SYN-[0-9]{3,6}$'
       or jsonb_typeof(row_item -> 'stratum_code') is distinct from 'string'
       or coalesce(row_item ->> 'stratum_code', '') !~ '^[A-Z0-9_-]{1,24}$'
       or jsonb_typeof(row_item -> 'eligible') is distinct from 'boolean'
       or (
         (row_item ->> 'eligible')::boolean
         and jsonb_typeof(row_item -> 'exclusion_reason_code') is distinct from 'null'
       )
       or (
         not (row_item ->> 'eligible')::boolean
         and (
           jsonb_typeof(row_item -> 'exclusion_reason_code') is distinct from 'string'
           or coalesce(row_item ->> 'exclusion_reason_code', '') <> all(array[
             'OUT_OF_SCOPE', 'DUPLICATE_SOURCE', 'INELIGIBLE_RULE'
           ]::text[])
         )
       )
  ) then
    raise exception using errcode = '22023', message = 'population rows are invalid';
  end if;

  select
    count(*)::integer,
    count(*) filter (where (row_item ->> 'eligible')::boolean)::integer,
    string_agg(
      format(
        '%s,%s,%s,%s,%s%s',
        row_item ->> 'row_number',
        row_item ->> 'farmer_code',
        row_item ->> 'stratum_code',
        case when (row_item ->> 'eligible')::boolean then '1' else '0' end,
        coalesce(row_item ->> 'exclusion_reason_code', ''),
        E'\n'
      ),
      '' order by (row_item ->> 'row_number')::integer
    )
  into v_total_count, v_eligible_count, v_canonical_text
  from jsonb_array_elements(p_rows) as row_item;

  if (
    select count(distinct (row_item ->> 'row_number')::integer) <> v_total_count
      or min((row_item ->> 'row_number')::integer) <> 1
      or max((row_item ->> 'row_number')::integer) <> v_total_count
      or count(distinct row_item ->> 'farmer_code') <> v_total_count
    from jsonb_array_elements(p_rows) as row_item
  ) then
    raise exception using errcode = '22023', message = 'population rows are invalid';
  end if;

  v_computed_digest := encode(
    extensions.digest(convert_to(v_canonical_text, 'UTF8'), 'sha256'),
    'hex'
  );
  if v_computed_digest <> p_input_digest then
    raise exception using errcode = '22023', message = 'population digest is invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_workspace_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_import
  from public.population_import as existing_import
  where existing_import.workspace_id = v_workspace_id
    and existing_import.idempotency_key = p_idempotency_key;

  if found then
    if v_import.source_label <> btrim(p_source_label)
      or v_import.source_authorization_ref <> p_source_authorization_ref
      or v_import.reference_date <> p_reference_date
      or v_import.schema_version <> p_schema_version
      or v_import.eligibility_rule_version <> p_eligibility_rule_version
      or v_import.input_digest <> p_input_digest
      or v_import.total_count <> v_total_count
      or v_import.eligible_count <> v_eligible_count
    then
      raise exception using errcode = '23505', message = 'idempotency key conflicts';
    end if;
  else
    insert into public.population_import (
      workspace_id, source_label, source_authorization_ref, reference_date,
      schema_version, eligibility_rule_version, input_digest, idempotency_key,
      total_count, eligible_count, excluded_count, created_by
    ) values (
      v_workspace_id, btrim(p_source_label), p_source_authorization_ref, p_reference_date,
      p_schema_version, p_eligibility_rule_version, p_input_digest, p_idempotency_key,
      v_total_count, v_eligible_count, v_total_count - v_eligible_count,
      v_actor_profile_id
    ) returning * into v_import;

    insert into public.population_member (
      population_import_id, workspace_id, row_number, farmer_code,
      stratum_code, eligible, exclusion_reason_code
    )
    select
      v_import.id,
      v_workspace_id,
      (row_item ->> 'row_number')::integer,
      row_item ->> 'farmer_code',
      row_item ->> 'stratum_code',
      (row_item ->> 'eligible')::boolean,
      nullif(row_item ->> 'exclusion_reason_code', '')
    from jsonb_array_elements(p_rows) as row_item
    order by (row_item ->> 'row_number')::integer;

    perform private.append_audit_event(
      v_workspace_id,
      v_actor_profile_id,
      'population.import_created',
      'population_import',
      v_import.id,
      'success',
      jsonb_build_object(
        'before_status', 'none',
        'after_status', 'validated',
        'total_count', v_import.total_count,
        'eligible_count', v_import.eligible_count,
        'excluded_count', v_import.excluded_count,
        'input_digest', v_import.input_digest,
        'schema_version', v_import.schema_version,
        'eligibility_rule_version', v_import.eligibility_rule_version,
        'source_authorization_ref_digest', encode(
          extensions.digest(convert_to(v_import.source_authorization_ref, 'UTF8'), 'sha256'),
          'hex'
        )
      )
    );
  end if;

  return query select
    v_import.id, v_import.source_label, v_import.source_authorization_ref,
    v_import.reference_date, v_import.schema_version,
    v_import.eligibility_rule_version, v_import.input_digest,
    v_import.total_count, v_import.eligible_count, v_import.excluded_count,
    v_import.status, v_import.created_by, v_import.created_at,
    v_import.accepted_by, v_import.accepted_at;
end;
$$;

create or replace function public.accept_population_import(p_import_id uuid)
returns table (
  id uuid,
  source_label text,
  source_authorization_ref text,
  reference_date date,
  schema_version text,
  eligibility_rule_version text,
  input_digest text,
  total_count integer,
  eligible_count integer,
  excluded_count integer,
  status public.population_import_status,
  created_by_profile_id uuid,
  created_at timestamptz,
  accepted_by_profile_id uuid,
  accepted_at timestamptz
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
begin
  if v_role is null or v_role not in ('admin', 'research_manager') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select * into v_import
  from public.population_import as target_import
  where target_import.id = p_import_id
    and target_import.workspace_id = v_workspace_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if v_import.status = 'validated' then
    update public.population_import
    set status = 'accepted',
        accepted_by = v_actor_profile_id,
        accepted_at = statement_timestamp()
    where population_import.id = v_import.id
    returning * into v_import;

    perform private.append_audit_event(
      v_workspace_id,
      v_actor_profile_id,
      'population.import_accepted',
      'population_import',
      v_import.id,
      'success',
      jsonb_build_object(
        'before_status', 'validated',
        'after_status', 'accepted',
        'total_count', v_import.total_count,
        'eligible_count', v_import.eligible_count,
        'excluded_count', v_import.excluded_count,
        'input_digest', v_import.input_digest,
        'schema_version', v_import.schema_version,
        'eligibility_rule_version', v_import.eligibility_rule_version,
        'source_authorization_ref_digest', encode(
          extensions.digest(convert_to(v_import.source_authorization_ref, 'UTF8'), 'sha256'),
          'hex'
        )
      )
    );
  end if;

  return query select
    v_import.id, v_import.source_label, v_import.source_authorization_ref,
    v_import.reference_date, v_import.schema_version,
    v_import.eligibility_rule_version, v_import.input_digest,
    v_import.total_count, v_import.eligible_count, v_import.excluded_count,
    v_import.status, v_import.created_by, v_import.created_at,
    v_import.accepted_by, v_import.accepted_at;
end;
$$;

create or replace function public.list_population_imports()
returns table (
  id uuid,
  source_label text,
  source_authorization_ref text,
  reference_date date,
  schema_version text,
  eligibility_rule_version text,
  input_digest text,
  total_count integer,
  eligible_count integer,
  excluded_count integer,
  status public.population_import_status,
  created_by_profile_id uuid,
  created_at timestamptz,
  accepted_by_profile_id uuid,
  accepted_at timestamptz
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
  if v_role is null or v_role not in ('admin', 'research_manager') then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  return query
  select
    population_import.id,
    population_import.source_label,
    population_import.source_authorization_ref,
    population_import.reference_date,
    population_import.schema_version,
    population_import.eligibility_rule_version,
    population_import.input_digest,
    population_import.total_count,
    population_import.eligible_count,
    population_import.excluded_count,
    population_import.status,
    population_import.created_by,
    population_import.created_at,
    population_import.accepted_by,
    population_import.accepted_at
  from public.population_import
  where population_import.workspace_id = v_workspace_id
  order by population_import.created_at desc, population_import.id;
end;
$$;

comment on function public.create_population_import(text, text, date, text, text, text, jsonb, uuid)
  is 'Creates one validated synthetic population snapshot atomically for an exact admin or research manager.';
comment on function public.accept_population_import(uuid)
  is 'Performs the sole validated-to-accepted population snapshot transition.';
comment on function public.list_population_imports()
  is 'Returns a safe current-workspace population import receipt projection.';

revoke all on function
  public.create_population_import(text, text, date, text, text, text, jsonb, uuid),
  public.accept_population_import(uuid),
  public.list_population_imports()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function
  public.create_population_import(text, text, date, text, text, text, jsonb, uuid),
  public.accept_population_import(uuid),
  public.list_population_imports()
  to authenticated;
alter function public.create_population_import(text, text, date, text, text, text, jsonb, uuid)
  owner to palmtrack_transaction_owner;
alter function public.accept_population_import(uuid)
  owner to palmtrack_transaction_owner;
alter function public.list_population_imports()
  owner to palmtrack_transaction_owner;

commit;
