begin;

-- The application submits e as canonical text. Numeric e remains a derived
-- calculation column for formula compatibility and reporting.
alter table public.sampling_run
  add column margin_of_error_text text;

create or replace function private.canonical_margin_of_error_text(p_value text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_fraction text;
begin
  if p_value is null or p_value !~ '^0\.[0-9]+$' then
    raise exception using errcode = '22023', message = 'margin of error text is invalid';
  end if;
  v_fraction := regexp_replace(substr(p_value, 3), '0+$', '');
  if v_fraction = '' then
    raise exception using errcode = '22023', message = 'margin of error text is invalid';
  end if;
  return '0.' || v_fraction;
end;
$$;

alter function private.canonical_margin_of_error_text(text) owner to palmtrack_transaction_owner;
revoke all on function private.canonical_margin_of_error_text(text)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;

update public.sampling_run
set margin_of_error_text = private.canonical_margin_of_error_text(margin_of_error::text);

alter table public.sampling_run
  alter column margin_of_error_text set not null,
  add constraint sampling_run_margin_of_error_text_check
    check (margin_of_error_text ~ '^0\.0*[1-9](?:[0-9]*[1-9])?$');

create or replace function private.set_sampling_margin_text()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  v_text text;
begin
  if current_setting('palmtrack.sampling_transition', true) not in ('create', 'regenerate') then
    return new;
  end if;
  v_text := coalesce(new.result_evidence ->> 'margin_of_error_text', new.margin_of_error::text);
  new.margin_of_error_text := private.canonical_margin_of_error_text(v_text);
  if jsonb_typeof(new.result_evidence) = 'object' then
    new.result_evidence := jsonb_set(
      new.result_evidence,
      '{margin_of_error_text}',
      to_jsonb(new.margin_of_error_text),
      true
    );
  end if;
  return new;
end;
$$;

create trigger sampling_margin_text_guard
before insert or update on public.sampling_run
for each row execute function private.set_sampling_margin_text();

revoke all on function private.set_sampling_margin_text()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
alter function private.set_sampling_margin_text() owner to palmtrack_transaction_owner;

create or replace function private.uint32_imul(p_left bigint, p_right bigint)
returns bigint
language sql
immutable
set search_path = pg_catalog
as $$
  select (
    ((p_left & 65535) * (p_right & 65535))
    + (
      (((p_left >> 16) & 65535) * (p_right & 65535))
      + (((p_right >> 16) & 65535) * (p_left & 65535))
    ) * 65536
  ) % 4294967296;
$$;

revoke all on function private.uint32_imul(bigint, bigint)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
alter function private.uint32_imul(bigint, bigint) owner to palmtrack_transaction_owner;

create or replace function private.replay_sampling_contract(
  p_population_import_id uuid,
  p_workspace_id uuid,
  p_seed_text text,
  p_margin_of_error_text text,
  p_target_n bigint,
  p_algorithm_version text,
  p_ordered_candidate_set_hash text,
  p_allocation_evidence jsonb,
  p_result_evidence jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_n bigint;
  v_e numeric;
  v_unrounded numeric;
  v_expected_target bigint;
  v_margin_text text := private.canonical_margin_of_error_text(p_margin_of_error_text);
  v_seed_normalized text := normalize(p_seed_text, NFC);
  v_seed_digest bytea;
  v_seed_digest_hex text;
  v_seed_utf8_hex text;
  v_seed_u32 bigint;
  v_candidate_stream_hex text;
  v_candidate_hash text;
  v_ids uuid[] := array[]::uuid[];
  v_strata text[] := array[]::text[];
  v_initial jsonb := '[]'::jsonb;
  v_shuffled jsonb := '[]'::jsonb;
  v_swap_trace jsonb := '[]'::jsonb;
  v_selected jsonb := '[]'::jsonb;
  v_selected_ids jsonb := '[]'::jsonb;
  v_selected_counts jsonb := '{}'::jsonb;
  v_expected_alloc jsonb;
  v_selected_count bigint := 0;
  v_j integer;
  v_state bigint;
  v_t bigint;
  v_rand bigint;
  v_quota bigint;
  v_count bigint;
  v_result_hash text;
  v_item jsonb;
  v_candidate record;
begin
  if p_seed_text is null or char_length(p_seed_text) not between 1 and 200
    or p_algorithm_version is distinct from 'sha256-mulberry32-fy-v1'
    or p_target_n is null or p_target_n <= 0 then
    raise exception using errcode = '22023', message = 'sampling replay input is invalid';
  end if;

  select count(*)::bigint into v_n
  from public.population_member as member
  where member.population_import_id = p_population_import_id
    and member.workspace_id = p_workspace_id
    and member.eligible;
  if v_n <= 0 then
    raise exception using errcode = '22023', message = 'sampling population is invalid';
  end if;
  v_e := v_margin_text::numeric;
  if v_e <= 0 or v_e >= 1 then
    raise exception using errcode = '22023', message = 'sampling margin is invalid';
  end if;
  v_unrounded := v_n::numeric / (1 + v_n::numeric * v_e * v_e);
  v_expected_target := ceil(v_unrounded)::bigint;
  if p_target_n <> v_expected_target or p_target_n > v_n then
    raise exception using errcode = '22023', message = 'sampling target is invalid';
  end if;

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
    ), '' order by convert_to(member.farmer_code, 'UTF8'), member.id
  ) into v_candidate_stream_hex
  from public.population_member as member
  where member.population_import_id = p_population_import_id
    and member.workspace_id = p_workspace_id
    and member.eligible;
  v_candidate_stream_hex := coalesce(v_candidate_stream_hex, '');
  v_candidate_hash := encode(extensions.digest(decode(v_candidate_stream_hex, 'hex'), 'sha256'), 'hex');
  if p_ordered_candidate_set_hash is distinct from v_candidate_hash then
    raise exception using errcode = '22023', message = 'sampling candidate hash is invalid';
  end if;

  for v_candidate in
    select member.id, member.stratum_code
    from public.population_member as member
    where member.population_import_id = p_population_import_id
      and member.workspace_id = p_workspace_id
      and member.eligible
    order by convert_to(member.farmer_code, 'UTF8'), member.id
  loop
    v_ids := array_append(v_ids, v_candidate.id);
    v_strata := array_append(v_strata, v_candidate.stratum_code);
    v_initial := v_initial || jsonb_build_array(v_candidate.id);
  end loop;

  with stratum_counts as (
    select member.stratum_code, count(*)::bigint as eligible_count
    from public.population_member as member
    where member.population_import_id = p_population_import_id
      and member.workspace_id = p_workspace_id
      and member.eligible
    group by member.stratum_code
  ), floors as (
    select counts.*, p_target_n::numeric * counts.eligible_count::numeric / v_n::numeric as quota,
      floor(p_target_n::numeric * counts.eligible_count::numeric / v_n::numeric)::bigint as floor_allocation,
      ((p_target_n::numeric * counts.eligible_count::numeric) % v_n::numeric) as remainder_numerator
    from stratum_counts as counts
  ), ranked as (
    select floors.*, row_number() over (order by floors.remainder_numerator desc, convert_to(floors.stratum_code, 'UTF8')) as remainder_rank,
      (p_target_n - sum(floors.floor_allocation) over ())::bigint as remaining_seats
    from floors
  )
  select jsonb_agg(jsonb_build_object(
      'stratum_code', ranked.stratum_code,
      'eligible_count', ranked.eligible_count,
      'quota', ranked.quota,
      'floor_allocation', ranked.floor_allocation,
      'remainder', ranked.remainder_numerator / v_n::numeric,
      'final_allocation', ranked.floor_allocation + case when ranked.remainder_rank <= ranked.remaining_seats then 1 else 0 end
    ) order by convert_to(ranked.stratum_code, 'UTF8'))
  into v_expected_alloc
  from ranked;

  if jsonb_array_length(p_allocation_evidence) <> jsonb_array_length(v_expected_alloc)
    or exists (
      select 1
      from jsonb_array_elements(v_expected_alloc) as expected
      where not exists (
        select 1
        from jsonb_to_recordset(p_allocation_evidence) as actual(stratum_code text, eligible_count bigint, quota numeric, floor_allocation bigint, remainder numeric, final_allocation bigint)
        where actual.stratum_code = expected ->> 'stratum_code'
          and actual.eligible_count = (expected ->> 'eligible_count')::bigint
          and actual.floor_allocation = (expected ->> 'floor_allocation')::bigint
          and actual.final_allocation = (expected ->> 'final_allocation')::bigint
          and abs(actual.quota - (expected ->> 'quota')::numeric) <= 0.000000000000001
          and abs(actual.remainder - (expected ->> 'remainder')::numeric) <= 0.000000000000001
      )
    ) then
    raise exception using errcode = '22023', message = 'sampling allocation replay is invalid';
  end if;

  v_state := v_seed_u32;
  for v_i in reverse array_length(v_ids, 1)..2 loop
    v_state := (v_state + 1831565813) % 4294967296;
    v_t := private.uint32_imul((v_state # (v_state >> 15)), (v_state | 1));
    v_t := (v_t # ((v_t + private.uint32_imul((v_t # (v_t >> 7)), (v_t | 61))) % 4294967296)) % 4294967296;
    v_rand := v_t # (v_t >> 14);
    v_j := floor((v_rand::numeric / 4294967296::numeric) * v_i)::integer;
    v_swap_trace := v_swap_trace || jsonb_build_array(jsonb_build_object('i', v_i - 1, 'j', v_j));
    v_item := to_jsonb(v_ids[v_i]);
    v_ids[v_i] := v_ids[v_j + 1];
    v_ids[v_j + 1] := (v_item #>> '{}')::uuid;
    v_item := to_jsonb(v_strata[v_i]);
    v_strata[v_i] := v_strata[v_j + 1];
    v_strata[v_j + 1] := v_item #>> '{}';
  end loop;
  for v_i in 1..array_length(v_ids, 1) loop
    v_shuffled := v_shuffled || jsonb_build_array(v_ids[v_i]);
  end loop;

  for v_i in 1..array_length(v_ids, 1) loop
    select (expected ->> 'final_allocation')::bigint into v_quota
    from jsonb_array_elements(v_expected_alloc) as expected
    where expected ->> 'stratum_code' = v_strata[v_i];
    v_count := coalesce((v_selected_counts ->> v_strata[v_i])::bigint, 0);
    if v_count < v_quota then
      v_selected_count := v_selected_count + 1;
      v_selected_counts := jsonb_set(v_selected_counts, array[v_strata[v_i]], to_jsonb(v_count + 1), true);
      v_selected := v_selected || jsonb_build_array(jsonb_build_object(
        'member_id', v_ids[v_i], 'stratum_code', v_strata[v_i], 'selection_order', v_selected_count
      ));
      v_selected_ids := v_selected_ids || jsonb_build_array(v_ids[v_i]);
    end if;
    exit when v_selected_count = p_target_n;
  end loop;
  if v_selected_count <> p_target_n then
    raise exception using errcode = '22023', message = 'sampling selection replay is invalid';
  end if;
  v_result_hash := private.ordered_result_hash(v_selected);

  if (p_result_evidence ->> 'formula_version') is distinct from 'yamane-v1'
    or (p_result_evidence ->> 'population_size')::bigint is distinct from v_n
    or (p_result_evidence ->> 'margin_of_error')::numeric is distinct from v_e
    or abs((p_result_evidence ->> 'unrounded')::numeric - v_unrounded) > 0.000000000000001
    or (p_result_evidence ->> 'target_n')::bigint is distinct from p_target_n
    or (p_result_evidence ->> 'rounding_rule') is distinct from 'ceil'
    or (p_result_evidence ->> 'seed_normalized') is distinct from v_seed_normalized
    or (p_result_evidence ->> 'seed_normalized_utf8_hex') is distinct from v_seed_utf8_hex
    or (p_result_evidence ->> 'seed_digest_hex') is distinct from v_seed_digest_hex
    or (p_result_evidence ->> 'seed_u32')::bigint is distinct from v_seed_u32
    or (p_result_evidence ->> 'ordered_candidate_set_byte_stream_hex') is distinct from v_candidate_stream_hex
    or (p_result_evidence ->> 'ordered_candidate_set_hash') is distinct from v_candidate_hash
    or ((p_result_evidence ? 'margin_of_error_text') and (p_result_evidence ->> 'margin_of_error_text') is distinct from v_margin_text)
  then
    raise exception using errcode = '22023', message = 'sampling scalar replay is invalid';
  end if;
  if p_result_evidence -> 'initial_candidate_member_ids' is distinct from v_initial then
    raise exception using errcode = '22023', message = 'sampling initial order replay is invalid';
  end if;
  if p_result_evidence -> 'swap_trace' is distinct from v_swap_trace then
    raise exception using errcode = '22023', message = 'sampling swap replay is invalid';
  end if;
  if p_result_evidence -> 'shuffled_member_ids' is distinct from v_shuffled then
    raise exception using errcode = '22023', message = 'sampling shuffle replay is invalid';
  end if;
  if p_result_evidence -> 'ordered_selected_members' is distinct from v_selected
    or p_result_evidence -> 'ordered_selected_member_ids' is distinct from v_selected_ids then
    raise exception using errcode = '22023', message = 'sampling selection replay evidence is invalid';
  end if;
  if (p_result_evidence ->> 'ordered_result_digest_version') is distinct from 'ordered-result-sha256-v1'
    or (p_result_evidence ->> 'ordered_result_hash') is distinct from v_result_hash then
    raise exception using errcode = '22023', message = 'sampling result hash replay is invalid';
  end if;
end;
$$;

revoke all on function private.replay_sampling_contract(uuid, uuid, text, text, bigint, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function private.replay_sampling_contract(uuid, uuid, text, text, bigint, text, text, jsonb, jsonb)
  to palmtrack_transaction_owner;
alter function private.replay_sampling_contract(uuid, uuid, text, text, bigint, text, text, jsonb, jsonb)
  owner to palmtrack_transaction_owner;

create or replace function private.guard_sampling_replay()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if (tg_op = 'INSERT' and current_setting('palmtrack.sampling_transition', true) in ('create', 'regenerate'))
    or (tg_op = 'UPDATE' and current_setting('palmtrack.sampling_transition', true) = 'regenerate') then
    perform private.replay_sampling_contract(
      new.population_import_id, new.workspace_id, new.seed_text,
      new.margin_of_error_text, new.target_n, new.algorithm_version,
      new.ordered_candidate_set_hash, new.allocation_evidence, new.result_evidence
    );
  end if;
  return new;
end;
$$;

create trigger sampling_run_replay_guard
before insert or update on public.sampling_run
for each row execute function private.guard_sampling_replay();

revoke all on function private.guard_sampling_replay()
  from public, anon, authenticated, service_role,
    palmtrack_audit_writer, palmtrack_recovery_executor;
alter function private.guard_sampling_replay() owner to palmtrack_transaction_owner;

create or replace function public.create_sampling_draft(
  p_population_import_id uuid,
  p_seed_text text,
  p_margin_of_error_text text,
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
  ordered_candidate_set_hash text, ordered_result_hash text, status public.sampling_run_status,
  created_at timestamptz, updated_at timestamptz, locked_at timestamptz, activated_at timestamptz,
  superseded_at timestamptz, cancelled_at timestamptz, cancellation_reason_digest text,
  allocation_evidence jsonb, result_evidence jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_margin_text text := private.canonical_margin_of_error_text(p_margin_of_error_text);
  v_result jsonb := coalesce(p_result_evidence, '{}'::jsonb);
begin
  if jsonb_typeof(v_result) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'sampling result evidence is invalid';
  end if;
  v_result := jsonb_set(v_result, '{margin_of_error_text}', to_jsonb(v_margin_text), true);
  -- Replay runs before the legacy numeric adapter so the raw decimal text is
  -- never trusted as client/server evidence and cannot change the selection.
  perform private.replay_sampling_contract(
    p_population_import_id, public.current_workspace_id(), p_seed_text,
    v_margin_text, p_target_n, p_algorithm_version, p_ordered_candidate_set_hash,
    p_allocation_evidence, v_result
  );
  return query
  select old_run.*
  from public.create_sampling_draft(
    p_population_import_id, p_seed_text, v_margin_text::numeric,
    p_stratum_definition_version, p_algorithm_version, p_target_n,
    p_ordered_candidate_set_hash, p_allocation_evidence, v_result, p_idempotency_key
  ) as old_run;
end;
$$;

revoke all on function public.create_sampling_draft(uuid, text, text, text, text, bigint, text, jsonb, jsonb, uuid)
  from public, anon, service_role, palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function public.create_sampling_draft(uuid, text, text, text, text, bigint, text, jsonb, jsonb, uuid)
  to authenticated;
alter function public.create_sampling_draft(uuid, text, text, text, text, bigint, text, jsonb, jsonb, uuid)
  owner to palmtrack_transaction_owner;

set local role palmtrack_transaction_owner;

-- The aggregate receipt must carry the persisted canonical decimal text.
-- Recreate because PostgreSQL cannot change a function's table return type
-- with CREATE OR REPLACE.
drop function public.list_sampling_runs();

create function public.list_sampling_runs()
returns table (
  id uuid, version bigint, population_size bigint,
  margin_of_error numeric, margin_of_error_text text,
  unrounded_result numeric, rounding_rule text, target_n bigint,
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
    run.margin_of_error, run.margin_of_error_text,
    run.unrounded_result, run.rounding_rule, run.target_n,
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
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_workspace uuid := public.current_workspace_id();
  v_run public.sampling_run%rowtype;
  v_members jsonb;
begin
  if public.current_role() is distinct from 'research_manager'::public.app_role
    or v_actor is null or v_workspace is null then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;
  -- Lock the run row before reading the accepted snapshot. This prevents a
  -- concurrent regeneration from changing the evidence during replay.
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
  if not exists (
    select 1 from public.population_import as population_import
    where population_import.id = v_run.population_import_id
      and population_import.workspace_id = v_workspace
      and population_import.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'accepted population snapshot is required';
  end if;

  -- This is the authoritative replay. It does not consume client evidence as
  -- proof: it reconstructs candidate ordering, allocations, Mulberry32,
  -- Fisher-Yates swaps, quota selection and both hashes from locked inputs.
  perform private.replay_sampling_contract(
    v_run.population_import_id, v_workspace, v_run.seed_text,
    v_run.margin_of_error_text, v_run.target_n, v_run.algorithm_version,
    v_run.ordered_candidate_set_hash, v_run.allocation_evidence, v_run.result_evidence
  );
  select coalesce(jsonb_agg(jsonb_build_object(
      'member_id', member.population_member_id,
      'stratum_code', member.stratum_code,
      'selection_order', member.selection_order
    ) order by member.selection_order), '[]'::jsonb)
  into v_members
  from public.sample_member as member
  where member.sampling_run_id = v_run.id and member.workspace_id = v_workspace;
  if v_members is distinct from v_run.result_evidence -> 'ordered_selected_members'
    or private.ordered_result_hash(v_run.result_evidence -> 'ordered_selected_members') is distinct from v_run.ordered_result_hash then
    raise exception using errcode = '22023', message = 'persisted sample membership replay is invalid';
  end if;

  perform set_config('palmtrack.sampling_transition', 'lock', true);
  update public.sampling_run
  set status = 'locked', locked_by = v_actor, locked_at = statement_timestamp(), updated_at = statement_timestamp()
  where public.sampling_run.id = v_run.id;
  perform private.append_audit_event(v_workspace, v_actor, 'sampling.run_locked', 'sampling_run', v_run.id, 'success', jsonb_build_object(
    'before_status', 'draft', 'after_status', 'locked',
    'population_size', v_run.population_size, 'target_n', v_run.target_n, 'algorithm_version', v_run.algorithm_version,
    'input_digest', (select population_import.input_digest from public.population_import as population_import where population_import.id = v_run.population_import_id),
    'candidate_set_hash', v_run.ordered_candidate_set_hash,
    'ordered_result_digest_version', v_run.result_evidence ->> 'ordered_result_digest_version',
    'ordered_result_hash', v_run.ordered_result_hash
  ));
  perform set_config('palmtrack.sampling_transition', '', true);
  return query select * from private.sampling_run_result(v_run.id);
end;
$$;

revoke all on function public.lock_sampling_run(uuid, timestamptz)
  from public, anon, service_role, palmtrack_audit_writer, palmtrack_recovery_executor;
grant execute on function public.lock_sampling_run(uuid, timestamptz) to authenticated;
alter function public.lock_sampling_run(uuid, timestamptz) owner to palmtrack_transaction_owner;

reset role;

commit;
