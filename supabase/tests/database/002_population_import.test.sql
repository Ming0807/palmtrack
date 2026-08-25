begin;

select plan(43);

select has_type('public', 'population_import_status', '[INT-01] import status enum exists');
select enum_has_labels(
  'public',
  'population_import_status',
  array['validated', 'accepted'],
  '[INT-01] import status has exact labels'
);
select has_table('public', 'population_import', '[INT-01] population import table exists');
select has_table('public', 'population_member', '[INT-01] population member table exists');
select has_function(
  'public',
  'create_population_import',
  array['text', 'text', 'date', 'text', 'text', 'text', 'jsonb', 'uuid'],
  '[INT-01] transactional create RPC exists'
);
select has_function(
  'public',
  'accept_population_import',
  array['uuid'],
  '[INT-01] transactional accept RPC exists'
);
select has_function(
  'public',
  'list_population_imports',
  array[]::text[],
  '[INT-01] safe list RPC exists'
);
select ok(
  (
    select bool_and(table_class.relrowsecurity and table_class.relforcerowsecurity)
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema
      on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname in ('population_import', 'population_member')
  ),
  '[RLS-09] population tables enable and force RLS'
);
select table_privs_are(
  'public',
  'population_import',
  'authenticated',
  array[]::text[],
  '[RLS-09] authenticated has no population import table privilege'
);
select table_privs_are(
  'public',
  'population_member',
  'service_role',
  array[]::text[],
  '[RLS-09] service role has no population member table privilege'
);
select function_privs_are(
  'public',
  'create_population_import',
  array['text', 'text', 'date', 'text', 'text', 'text', 'jsonb', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  '[RLS-09] authenticated receives only create RPC execution'
);
select function_privs_are(
  'public',
  'accept_population_import',
  array['uuid'],
  'authenticated',
  array['EXECUTE'],
  '[RLS-09] authenticated receives only accept RPC execution'
);
select function_privs_are(
  'public',
  'list_population_imports',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  '[RLS-09] authenticated receives only list RPC execution'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000501', 'authenticated', 'authenticated', 'population-admin@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000502', 'authenticated', 'authenticated', 'population-manager@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000503', 'authenticated', 'authenticated', 'population-collector@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000504', 'authenticated', 'authenticated', 'population-farmer@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000505', 'authenticated', 'authenticated', 'population-evaluator@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp());

set local role palmtrack_recovery_executor;
select private.bootstrap_workspace(
  'Synthetic population workspace',
  '00000000-0000-0000-0000-000000000501'::uuid
);
reset role;

insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
select
  fixture.profile_id,
  fixture.auth_user_id,
  workspace.id,
  fixture.role::public.app_role,
  'active'::public.record_status
from public.workspace as workspace
cross join (values
  ('00000000-0000-0000-0000-000000000602'::uuid, '00000000-0000-0000-0000-000000000502'::uuid, 'research_manager'),
  ('00000000-0000-0000-0000-000000000603'::uuid, '00000000-0000-0000-0000-000000000503'::uuid, 'field_collector'),
  ('00000000-0000-0000-0000-000000000604'::uuid, '00000000-0000-0000-0000-000000000504'::uuid, 'farmer'),
  ('00000000-0000-0000-0000-000000000605'::uuid, '00000000-0000-0000-0000-000000000505'::uuid, 'evaluator_readonly')
) as fixture(profile_id, auth_user_id, role)
where workspace.status = 'active';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000501';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}';

select lives_ok(
  $$ select * from public.create_population_import(
    'FX-BASE admin',
    'SYN-FX_BASE_ADMIN',
    '2026-08-25'::date,
    'synthetic-population-v1',
    'synthetic-eligibility-v1',
    'eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b',
    '[
      {"row_number":1,"farmer_code":"SYN-001","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":2,"farmer_code":"SYN-002","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":3,"farmer_code":"SYN-003","stratum_code":"SOUTH","eligible":false,"exclusion_reason_code":"OUT_OF_SCOPE"}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000701'::uuid
  ) $$,
  '[INT-01] admin creates one validated import atomically'
);
select is(
  (select count(*) from public.list_population_imports()),
  1::bigint,
  '[INT-01] admin lists the current workspace safe projection'
);
select ok(
  not ((select to_jsonb(receipt) from public.list_population_imports() as receipt limit 1)
    ?| array['workspace_id', 'idempotency_key', 'auth_user_id']),
  '[SEC-02] list projection excludes workspace, idempotency and Auth identifiers'
);
select is(
  (select total_count from public.list_population_imports() limit 1),
  3,
  '[INT-01] valid import writes all members'
);
select is(
  (select status::text from public.list_population_imports() limit 1),
  'validated',
  '[INT-01] new import starts validated'
);
select lives_ok(
  $$ select * from public.accept_population_import(
    (select id from public.list_population_imports() limit 1)
  ) $$,
  '[INT-01] admin accepts a validated import'
);
select is(
  (select status::text from public.list_population_imports() limit 1),
  'accepted',
  '[INT-01] acceptance persists the terminal snapshot status'
);
select lives_ok(
  $$ select * from public.accept_population_import(
    (select id from public.list_population_imports() limit 1)
  ) $$,
  '[INT-01] repeated acceptance is idempotent'
);
select throws_ok(
  $$ update public.population_import set source_label = 'forged' $$,
  '42501',
  null,
  '[RLS-09] authenticated cannot update an import table directly'
);
select throws_ok(
  $$ delete from public.population_member $$,
  '42501',
  null,
  '[RLS-09] authenticated cannot delete population members directly'
);
reset role;

select is(
  (
    select count(*)
    from public.audit_event
    where action_code in ('population.import_created', 'population.import_accepted')
  ),
  2::bigint,
  '[SEC-02] create and accept append two exact audit events'
);
select ok(
  not exists (
    select 1
    from public.audit_event
    where action_code = 'population.import_accepted'
      and (
        details ->> 'before_status' <> 'validated'
        or details ->> 'after_status' <> 'accepted'
        or details ->> 'input_digest' !~ '^[0-9a-f]{64}$'
        or details ->> 'source_authorization_ref_digest' !~ '^[0-9a-f]{64}$'
      )
  ),
  '[SEC-02] acceptance audit contains sanitized before-after evidence'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000502';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000502","role":"authenticated"}';
select is(
  (select count(*) from public.list_population_imports()),
  1::bigint,
  '[INT-01] research manager lists current workspace imports'
);
select lives_ok(
  $$ select * from public.create_population_import(
    'FX-BASE manager',
    'SYN-FX_BASE_MANAGER',
    '2026-08-25'::date,
    'synthetic-population-v1',
    'synthetic-eligibility-v1',
    'eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b',
    '[
      {"row_number":1,"farmer_code":"SYN-001","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":2,"farmer_code":"SYN-002","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":3,"farmer_code":"SYN-003","stratum_code":"SOUTH","eligible":false,"exclusion_reason_code":"OUT_OF_SCOPE"}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000702'::uuid
  ) $$,
  '[INT-01] research manager uses the same audited create path'
);
select lives_ok(
  $$ select * from public.accept_population_import(
    (select id from public.list_population_imports() where source_label = 'FX-BASE manager')
  ) $$,
  '[INT-01] research manager uses the same audited accept path'
);
select is(
  (
    select count(distinct id)
    from public.create_population_import(
      'FX-BASE manager',
      'SYN-FX_BASE_MANAGER',
      '2026-08-25'::date,
      'synthetic-population-v1',
      'synthetic-eligibility-v1',
      'eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b',
      '[
        {"row_number":1,"farmer_code":"SYN-001","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},
        {"row_number":2,"farmer_code":"SYN-002","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
        {"row_number":3,"farmer_code":"SYN-003","stratum_code":"SOUTH","eligible":false,"exclusion_reason_code":"OUT_OF_SCOPE"}
      ]'::jsonb,
      '00000000-0000-0000-0000-000000000702'::uuid
    )
  ),
  1::bigint,
  '[INT-01] identical idempotency retry returns one import'
);
select throws_ok(
  $$ select * from public.create_population_import(
    'changed label',
    'SYN-FX_BASE_MANAGER',
    '2026-08-25'::date,
    'synthetic-population-v1',
    'synthetic-eligibility-v1',
    'eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b',
    '[
      {"row_number":1,"farmer_code":"SYN-001","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":2,"farmer_code":"SYN-002","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":3,"farmer_code":"SYN-003","stratum_code":"SOUTH","eligible":false,"exclusion_reason_code":"OUT_OF_SCOPE"}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000702'::uuid
  ) $$,
  '23505',
  null,
  '[INT-01] changed idempotency retry is rejected'
);
select throws_ok(
  $$ select * from public.create_population_import(
    'bad digest',
    'SYN-BAD_DIGEST',
    '2026-08-25'::date,
    'synthetic-population-v1',
    'synthetic-eligibility-v1',
    repeat('0', 64),
    '[{"row_number":1,"farmer_code":"SYN-010","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null}]'::jsonb,
    '00000000-0000-0000-0000-000000000703'::uuid
  ) $$,
  '22023',
  null,
  '[SEC-02] mismatched digest fails atomically'
);
reset role;

select is(
  (select count(*) from public.population_import),
  2::bigint,
  '[INT-01] failed writes leave no partial import'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000503';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}';
select throws_ok(
  $$ select * from public.list_population_imports() $$,
  '42501',
  null,
  '[RLS-09] field collector cannot list population imports'
);
select throws_ok(
  $$ select * from public.accept_population_import(
    '00000000-0000-0000-0000-000000000701'::uuid
  ) $$,
  '42501',
  null,
  '[RLS-09] field collector cannot accept population imports'
);
select throws_ok(
  $$ select * from public.create_population_import(
    'denied', 'SYN-DENIED', '2026-08-25'::date,
    'synthetic-population-v1', 'synthetic-eligibility-v1', repeat('0', 64),
    '[]'::jsonb, '00000000-0000-0000-0000-000000000799'::uuid
  ) $$,
  '42501',
  null,
  '[RLS-09] field collector cannot create population imports'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000504';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000504","role":"authenticated"}';
select throws_ok(
  $$ select * from public.list_population_imports() $$,
  '42501',
  null,
  '[RLS-09] farmer cannot list population imports'
);
select throws_ok(
  $$ select * from public.accept_population_import(
    '00000000-0000-0000-0000-000000000701'::uuid
  ) $$,
  '42501',
  null,
  '[RLS-09] farmer cannot accept population imports'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000505';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000505","role":"authenticated"}';
select throws_ok(
  $$ select * from public.list_population_imports() $$,
  '42501',
  null,
  '[RLS-09] evaluator cannot list population imports'
);
select throws_ok(
  $$ select * from public.create_population_import(
    'denied', 'SYN-DENIED', '2026-08-25'::date,
    'synthetic-population-v1', 'synthetic-eligibility-v1', repeat('0', 64),
    '[]'::jsonb, '00000000-0000-0000-0000-000000000798'::uuid
  ) $$,
  '42501',
  null,
  '[RLS-09] evaluator cannot create population imports'
);
reset role;

select throws_ok(
  $$ select * from public.list_population_imports() $$,
  '42501',
  null,
  '[RLS-09] anonymous caller cannot list population imports'
);
select throws_ok(
  $$ select * from public.accept_population_import(
    '00000000-0000-0000-0000-000000000701'::uuid
  ) $$,
  '42501',
  null,
  '[RLS-09] anonymous caller cannot accept population imports'
);

set local role palmtrack_transaction_owner;
select throws_ok(
  $$ update public.population_import set source_label = 'forged internal update' $$,
  '42501',
  'population import is immutable outside validated acceptance',
  '[SEC-02] accepted import rejects forged internal updates'
);
select throws_ok(
  $$ insert into public.population_import (
    workspace_id, source_label, source_authorization_ref, reference_date,
    schema_version, eligibility_rule_version, input_digest, idempotency_key,
    total_count, eligible_count, excluded_count, status, created_by,
    accepted_by, accepted_at
  ) select
    profile.workspace_id, 'forged state', 'SYN-FORGED', '2026-08-25'::date,
    'synthetic-population-v1', 'synthetic-eligibility-v1', repeat('0', 64),
    '00000000-0000-0000-0000-000000000797'::uuid,
    1, 1, 0, 'validated', profile.id, profile.id, statement_timestamp()
  from public.user_profile as profile
  where profile.auth_user_id = '00000000-0000-0000-0000-000000000501'::uuid $$,
  '23514',
  null,
  '[SEC-02] validated state rejects forged acceptance metadata'
);
reset role;

select * from finish();
rollback;
