begin;

select no_plan();

select has_type('public', 'sampling_run_status', '[INT-02] sampling status enum exists');
select enum_has_labels(
  'public',
  'sampling_run_status',
  array['draft', 'locked', 'active', 'superseded', 'cancelled'],
  '[INT-02] sampling status enum has exact lifecycle labels'
);
select has_table('public', 'sampling_run', '[INT-02] sampling run table exists');
select has_table('public', 'sampling_allocation', '[INT-02] allocation table exists');
select has_table('public', 'sample_member', '[INT-02] sample member table exists');
select has_function(
  'public',
  'create_sampling_draft',
  array['uuid', 'text', 'numeric', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb', 'uuid'],
  '[INT-02] create sampling draft RPC exists'
);
select has_function('public', 'lock_sampling_run', array['uuid'], '[INT-02] lock RPC exists');
select has_function('public', 'activate_sampling_run', array['uuid'], '[INT-02] activate RPC exists');
select has_function('public', 'cancel_sampling_run', array['uuid', 'text'], '[INT-02] cancel RPC exists');
select has_function('public', 'list_sampling_runs', array[]::text[], '[INT-02] safe run list RPC exists');
select has_function('public', 'get_sampling_candidates', array['uuid'], '[INT-02] safe candidate RPC exists');
select has_function('public', 'get_sampling_population_candidates', array['uuid'], '[INT-02] accepted population candidate RPC exists');
select has_function('public', 'get_sampling_run_evidence', array['uuid'], '[INT-02] manager evidence RPC exists');
select has_function('public', 'update_sampling_draft', array['uuid', 'text', 'numeric', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb', 'uuid'], '[INT-02] draft regeneration RPC exists');
select has_function('public', 'regenerate_sampling_draft', array['uuid', 'text', 'numeric', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb', 'uuid'], '[INT-02] draft regeneration alias RPC exists');

select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as schema on schema.oid = relation.relnamespace
    where schema.nspname = 'public'
      and relation.relname in ('sampling_run', 'sampling_allocation', 'sample_member')
  ),
  '[RLS-09] sampling tables enable and force RLS'
);
select table_privs_are('public', 'sampling_run', 'authenticated', array[]::text[], '[RLS-09] authenticated has no run table privilege');
select table_privs_are('public', 'sample_member', 'service_role', array[]::text[], '[RLS-09] service role has no sample table privilege');
select function_privs_are('public', 'create_sampling_draft', array['uuid', 'text', 'numeric', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb', 'uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call create RPC only');
select function_privs_are('public', 'lock_sampling_run', array['uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call lock RPC only');
select function_privs_are('public', 'activate_sampling_run', array['uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call activate RPC only');
select function_privs_are('public', 'cancel_sampling_run', array['uuid', 'text'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call cancel RPC only');
select function_privs_are('public', 'list_sampling_runs', array[]::text[], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call list RPC only');
select function_privs_are('public', 'get_sampling_candidates', array['uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call candidate RPC only');
select function_privs_are('public', 'get_sampling_population_candidates', array['uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call accepted population candidate RPC only');
select function_privs_are('public', 'get_sampling_run_evidence', array['uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call manager evidence RPC only');
select function_privs_are('public', 'update_sampling_draft', array['uuid', 'text', 'numeric', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb', 'uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call draft update RPC only');
select function_privs_are('public', 'regenerate_sampling_draft', array['uuid', 'text', 'numeric', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb', 'uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated may call draft regeneration alias only');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000801', 'authenticated', 'authenticated', 'sampling-admin@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000802', 'authenticated', 'authenticated', 'sampling-manager@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000803', 'authenticated', 'authenticated', 'sampling-collector@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000804', 'authenticated', 'authenticated', 'sampling-farmer@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000805', 'authenticated', 'authenticated', 'sampling-evaluator@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000806', 'authenticated', 'authenticated', 'sampling-cross@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp());

set local role palmtrack_recovery_executor;
select private.bootstrap_workspace('Synthetic sampling workspace', '00000000-0000-0000-0000-000000000801'::uuid);
reset role;

insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
select fixture.profile_id, fixture.auth_user_id, workspace.id, fixture.role::public.app_role, 'active'::public.record_status
from public.workspace
cross join (values
  ('00000000-0000-0000-0000-000000000812'::uuid, '00000000-0000-0000-0000-000000000802'::uuid, 'research_manager'),
  ('00000000-0000-0000-0000-000000000813'::uuid, '00000000-0000-0000-0000-000000000803'::uuid, 'field_collector'),
  ('00000000-0000-0000-0000-000000000814'::uuid, '00000000-0000-0000-0000-000000000804'::uuid, 'farmer'),
  ('00000000-0000-0000-0000-000000000815'::uuid, '00000000-0000-0000-0000-000000000805'::uuid, 'evaluator_readonly')
) as fixture(profile_id, auth_user_id, role)
where workspace.status = 'active';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000801';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}';
select throws_ok(
  $$ select * from public.create_sampling_draft(
    '00000000-0000-0000-0000-000000000999'::uuid,
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    '[]'::jsonb, '{}'::jsonb, '00000000-0000-0000-0000-000000000999'::uuid
  ) $$,
  '42501', null,
  '[SEC-02] admin cannot mutate sampling lifecycle'
);
select lives_ok($$ select * from public.list_sampling_runs() $$, '[RLS-09] admin receives aggregate sampling summaries');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000801';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}';

select lives_ok(
  $$ select * from public.create_population_import(
    'FX-SAMPLING', 'SYN-FX_SAMPLING', '2026-08-26'::date,
    'synthetic-population-v1', 'synthetic-eligibility-v1',
    '7e3e81c03947caed26793447123bc537905d9bc91a54aa52910f19d0b8a19566',
    '[
      {"row_number":1,"farmer_code":"SYN-101","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":2,"farmer_code":"SYN-102","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":3,"farmer_code":"SYN-103","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":4,"farmer_code":"SYN-104","stratum_code":"SOUTH","eligible":false,"exclusion_reason_code":"OUT_OF_SCOPE"},
      {"row_number":5,"farmer_code":"SYN-105","stratum_code":"EAST","eligible":true,"exclusion_reason_code":null}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000901'::uuid
  ) $$,
  '[INT-02] accepted synthetic population fixture is available'
);
select lives_ok($$ select * from public.accept_population_import((select id from public.list_population_imports() where source_label = 'FX-SAMPLING')) $$, '[INT-02] fixture population is accepted');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000802';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}';
set local role palmtrack_transaction_owner;

select lives_ok(
  $$ select * from public.get_sampling_population_candidates((select id from public.list_population_imports() where source_label = 'FX-SAMPLING')) $$,
  '[INT-02] manager reads every eligible accepted population candidate'
);
select is(
  (select count(*) from public.get_sampling_population_candidates((select id from public.list_population_imports() where source_label = 'FX-SAMPLING'))),
  4::bigint,
  '[INT-02] population candidate projection excludes ineligible members'
);
select is(
  (select count(*) from public.get_sampling_population_candidates((select id from public.list_population_imports() where source_label = 'FX-SAMPLING')) where farmer_code = 'SYN-104'),
  0::bigint,
  '[SEC-02] population candidate projection never returns ineligible members'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    '[]'::jsonb, '{}'::jsonb, '00000000-0000-0000-0000-000000000902'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] missing evidence is rejected before persistence'
);

select lives_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    '[
      {"stratum_code":"EAST","eligible_count":1,"quota":0.5,"floor_allocation":0,"remainder":0.5,"final_allocation":1},
      {"stratum_code":"NORTH","eligible_count":1,"quota":0.5,"floor_allocation":0,"remainder":0.5,"final_allocation":0},
      {"stratum_code":"SOUTH","eligible_count":2,"quota":1,"floor_allocation":1,"remainder":0,"final_allocation":1}
    ]'::jsonb,
    jsonb_build_object(
      'formula_version', 'yamane-v1', 'population_size', 4,
      'margin_of_error', 0.5, 'unrounded', 2, 'rounding_rule', 'ceil', 'target_n', 2,
      'seed_normalized', 'sample-seed', 'seed_normalized_utf8_hex', '73616d706c652d73656564',
      'seed_digest_hex', '895a086afeff7aa154295bc31965fc133e727682dd886de01138d153d2b27aae',
      'seed_u32', 2304378986,
      'ordered_candidate_set_byte_stream_hex', '0000000753594e2d313031000000054e4f5254480000000753594e2d31303200000005534f5554480000000753594e2d31303300000005534f5554480000000753594e2d3130350000000445415354',
      'ordered_candidate_set_hash', '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
      'initial_candidate_member_ids', (select jsonb_agg(id order by farmer_code) from public.population_member where population_import_id = (select id from public.population_import where source_label = 'FX-SAMPLING') and eligible),
      'swap_trace', '[{"i":3,"j":2},{"i":2,"j":0},{"i":1,"j":0}]'::jsonb,
      'shuffled_member_ids', jsonb_build_array(
        (select id from public.population_member where farmer_code = 'SYN-102'),
        (select id from public.population_member where farmer_code = 'SYN-105'),
        (select id from public.population_member where farmer_code = 'SYN-101'),
        (select id from public.population_member where farmer_code = 'SYN-103')
      ),
      'ordered_selected_members', jsonb_build_array(
        jsonb_build_object('member_id', (select id from public.population_member where farmer_code = 'SYN-102'), 'stratum_code', 'SOUTH', 'selection_order', 1),
        jsonb_build_object('member_id', (select id from public.population_member where farmer_code = 'SYN-105'), 'stratum_code', 'EAST', 'selection_order', 2)
      ),
      'ordered_selected_member_ids', jsonb_build_array(
        (select id from public.population_member where farmer_code = 'SYN-102'),
        (select id from public.population_member where farmer_code = 'SYN-105')
      )
    ),
    '00000000-0000-0000-0000-000000000902'::uuid
  ) $$,
  '[INT-02] manager creates one evidence-backed draft'
);
select is((select count(*) from public.sampling_run), 1::bigint, '[INT-02] draft persists exactly once');
select is((select status::text from public.sampling_run), 'draft', '[INT-02] new run starts draft');
select is((select population_size from public.sampling_run), 4::bigint, '[INT-02] N stores eligible population exactly');
select is((select target_n from public.sampling_run), 2::bigint, '[INT-02] target stores exact numeric result');
select is((select count(*) from public.sampling_allocation), 3::bigint, '[INT-02] allocation has one row per stratum');
select is((select count(*) from public.sample_member), 2::bigint, '[INT-02] member evidence totals target');
select is((select count(*) from public.sample_member where selection_order in (1, 2)), 2::bigint, '[INT-02] member selection orders are globally unique');
select ok(not ((select to_jsonb(row) from public.list_sampling_runs() as row limit 1) ?| array['workspace_id', 'contact', 'phone']), '[SEC-02] run projection omits workspace and contact data');
select is((select count(*) from public.create_sampling_draft(
  (select id from public.population_import where source_label = 'FX-SAMPLING'), 'sample-seed', 0.5,
  'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
  '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
  (select allocation_evidence from public.sampling_run limit 1),
  (select result_evidence from public.sampling_run limit 1),
  '00000000-0000-0000-0000-000000000902'::uuid
)), 1::bigint, '[INT-02] identical idempotency retry returns one run');

select lives_ok($$ select * from public.lock_sampling_run((select id from public.sampling_run)) $$, '[INT-02] manager locks draft after evidence replay');
select is((select status::text from public.sampling_run), 'locked', '[INT-02] lock freezes run state');
select throws_ok($$ update public.sample_member set selection_order = 9 $$, '42501', null, '[SEC-02] sample members are immutable');
select throws_ok($$ insert into public.sampling_run default values $$, '42501', null, '[SEC-02] direct run inserts are denied outside the RPC boundary');
select throws_ok($$ insert into public.sample_member default values $$, '42501', null, '[SEC-02] direct member inserts are denied outside the RPC boundary');
select throws_ok($$ update public.sampling_run set target_n = 1 $$, '42501', null, '[SEC-02] locked evidence is immutable');
select throws_ok($$ select * from public.lock_sampling_run((select id from public.sampling_run)) $$, '42501', null, '[INT-02] lock is not legal twice');
select lives_ok($$ select * from public.activate_sampling_run((select id from public.sampling_run)) $$, '[INT-02] manager activates locked run');
select is((select status::text from public.sampling_run), 'active', '[INT-02] active status persists');
select throws_ok($$ select * from public.cancel_sampling_run((select id from public.sampling_run), 'too late') $$, '42501', null, '[INT-02] active run cannot be cancelled');

select lives_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    (select result_evidence from public.sampling_run where status = 'active' limit 1),
    '00000000-0000-0000-0000-000000000903'::uuid
  ) $$,
  '[INT-02] second evidence-backed draft is created'
);
select lives_ok($$ select * from public.lock_sampling_run((select id from public.sampling_run where status = 'draft')) $$, '[INT-02] second draft locks');
select lives_ok($$ select * from public.activate_sampling_run((select id from public.sampling_run where status = 'locked')) $$, '[INT-02] second locked run activates');
select is((select count(*) from public.sampling_run where status = 'active'), 1::bigint, '[INT-02] partial unique active index leaves exactly one active run');
select is((select count(*) from public.sampling_run where status = 'superseded'), 1::bigint, '[INT-02] activation supersedes the previous active run');
reset role;
select is((select count(*) from public.audit_event where action_code = 'sampling.run_superseded'), 1::bigint, '[AUD-01] supersession appends its own audited transition');
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000802';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}';
set local role palmtrack_transaction_owner;

select lives_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    (select result_evidence from public.sampling_run where status = 'active' limit 1),
    '00000000-0000-0000-0000-000000000904'::uuid
  ) $$,
  '[INT-02] third draft is created for cancellation'
);
select throws_ok($$ select * from public.cancel_sampling_run((select id from public.sampling_run where status = 'draft'), 'x') $$, '22023', null, '[INT-02] cancellation requires a meaningful reason');
select lives_ok($$ select * from public.cancel_sampling_run((select id from public.sampling_run where status = 'draft'), 'synthetic cancellation reason') $$, '[INT-02] draft cancellation stores a reason digest');
select ok(
  (select cancellation_reason_digest ~ '^[0-9a-f]{64}$' from public.sampling_run where status = 'cancelled'),
  '[SEC-02] cancellation stores only a lowercase reason digest'
);
select ok(
  not exists (
    select 1 from public.sampling_run where result_evidence::text like '%synthetic cancellation reason%'
  ),
  '[SEC-02] cancellation reason is not written into evidence'
);

select lives_ok(
  $$ select * from public.create_population_import(
    'FX-SAMPLING-UNACCEPTED', 'SYN-FX_UNACCEPTED', '2026-08-26'::date,
    'synthetic-population-v1', 'synthetic-eligibility-v1',
    '7e3e81c03947caed26793447123bc537905d9bc91a54aa52910f19d0b8a19566',
    '[
      {"row_number":1,"farmer_code":"SYN-101","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":2,"farmer_code":"SYN-102","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":3,"farmer_code":"SYN-103","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},
      {"row_number":4,"farmer_code":"SYN-104","stratum_code":"SOUTH","eligible":false,"exclusion_reason_code":"OUT_OF_SCOPE"},
      {"row_number":5,"farmer_code":"SYN-105","stratum_code":"EAST","eligible":true,"exclusion_reason_code":null}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000906'::uuid
  ) $$,
  '[INT-02] unaccepted population fixture remains validated'
);
select throws_ok(
  $$ select * from public.get_sampling_population_candidates((select id from public.list_population_imports() where source_label = 'FX-SAMPLING-UNACCEPTED')) $$,
  '42501', null,
  '[SEC-02] unaccepted snapshots cannot expose population candidates'
);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.list_population_imports() where source_label = 'FX-SAMPLING-UNACCEPTED'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    (select result_evidence from public.sampling_run where status = 'active' limit 1),
    '00000000-0000-0000-0000-000000000907'::uuid
  ) $$,
  '42501', null,
  '[SEC-02] sampling accepts only an accepted population snapshot'
);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where status = 'accepted' limit 1),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    jsonb_set((select allocation_evidence from public.sampling_run where status = 'active' limit 1), '{0,final_allocation}', '0'::jsonb),
    (select result_evidence from public.sampling_run where status = 'active' limit 1),
    '00000000-0000-0000-0000-000000000908'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] forged allocation totals fail atomically'
);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    '[
      {"stratum_code":"EAST","eligible_count":2,"quota":1,"floor_allocation":1,"remainder":0,"final_allocation":1},
      {"stratum_code":"NORTH","eligible_count":0,"quota":0,"floor_allocation":0,"remainder":0,"final_allocation":0},
      {"stratum_code":"SOUTH","eligible_count":2,"quota":1,"floor_allocation":1,"remainder":0,"final_allocation":1}
    ]'::jsonb,
    (select result_evidence from public.sampling_run where status = 'active' limit 1),
    '00000000-0000-0000-0000-000000000916'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] forged per-stratum N_h is rejected even when aggregate allocation totals match'
);

insert into public.workspace (id, name, status)
values ('00000000-0000-0000-0000-000000000990', 'Synthetic cross workspace', 'inactive');
insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
values ('00000000-0000-0000-0000-000000000991', '00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-000000000990', 'research_manager', 'active');
insert into public.population_import (
  id, workspace_id, source_label, source_authorization_ref, reference_date,
  schema_version, eligibility_rule_version, input_digest, idempotency_key,
  total_count, eligible_count, excluded_count, status, created_by, accepted_by, accepted_at
) values (
  '00000000-0000-0000-0000-000000000992', '00000000-0000-0000-0000-000000000990',
  'FX-CROSS', 'SYN-FX_CROSS', '2026-08-26', 'synthetic-population-v1',
  'synthetic-eligibility-v1', repeat('a', 64), '00000000-0000-0000-0000-000000000993',
  1, 1, 0, 'accepted', '00000000-0000-0000-0000-000000000991', '00000000-0000-0000-0000-000000000991', statement_timestamp()
);
insert into public.population_member (id, population_import_id, workspace_id, row_number, farmer_code, stratum_code, eligible)
values ('00000000-0000-0000-0000-000000000994', '00000000-0000-0000-0000-000000000992', '00000000-0000-0000-0000-000000000990', 1, 'SYN-999', 'NORTH', true);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    '00000000-0000-0000-0000-000000000992'::uuid,
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 1,
    repeat('0', 64), '[]'::jsonb, '{}'::jsonb,
    '00000000-0000-0000-0000-000000000995'::uuid
  ) $$,
  '42501', null,
  '[RLS-09] cross-workspace accepted snapshots are denied'
);
select throws_ok(
  $$ select * from public.get_sampling_population_candidates('00000000-0000-0000-0000-000000000992'::uuid) $$,
  '42501', null,
  '[RLS-09] cross-workspace population candidates are denied'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    (select result_evidence from public.sampling_run where status = 'active' limit 1) || '{"unexpected_key":true}'::jsonb,
    '00000000-0000-0000-0000-000000000909'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] arbitrary result evidence keys are rejected'
);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    jsonb_set((select result_evidence from public.sampling_run where status = 'active' limit 1), '{population_size}', '4.5'::jsonb),
    '00000000-0000-0000-0000-000000000910'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] non-integral numeric evidence is rejected before bigint casting'
);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    jsonb_set((select result_evidence from public.sampling_run where status = 'active' limit 1), '{swap_trace,0}', '{"i":3,"j":2,"extra":1}'::jsonb),
    '00000000-0000-0000-0000-000000000911'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] swap trace object keys are exact'
);
select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    (select result_evidence from public.sampling_run where status = 'active' limit 1) - 'shuffled_member_ids',
    '00000000-0000-0000-0000-000000000912'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] required shuffled and swap evidence arrays cannot be omitted'
);

select lives_ok(
  $$ select * from public.create_sampling_draft(
    (select id from public.population_import where source_label = 'FX-SAMPLING'),
    'sample-seed', 0.5, 'stratum-definition-v1', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'active' limit 1),
    (select result_evidence from public.sampling_run where status = 'active' limit 1),
    '00000000-0000-0000-0000-000000000913'::uuid
  ) $$,
  '[INT-02] draft exists for audited regeneration'
);
select lives_ok(
  $$ select * from public.update_sampling_draft(
    (select id from public.sampling_run where status = 'draft' limit 1),
    'sample-seed', 0.5, 'stratum-definition-v2', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where status = 'draft' limit 1),
    (select result_evidence from public.sampling_run where status = 'draft' limit 1),
    '00000000-0000-0000-0000-000000000914'::uuid
  ) $$,
  '[INT-02] manager regenerates only a draft input/evidence set'
);
select is((select stratum_definition_version from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid), 'stratum-definition-v2', '[INT-02] regenerated input persists on the same run');
select is((select count(*) from public.sampling_run), 4::bigint, '[INT-02] regeneration does not create a duplicate run');
select lives_ok(
  $$ select * from public.update_sampling_draft(
    (select id from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    'sample-seed', 0.5, 'stratum-definition-v2', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    (select result_evidence from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    '00000000-0000-0000-0000-000000000914'::uuid
  ) $$,
  '[INT-02] identical regeneration idempotency retry returns the same run'
);
select throws_ok(
  $$ select * from public.update_sampling_draft(
    (select id from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    'sample-seed', 0.5, 'stratum-definition-v3', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    '[
      {"stratum_code":"EAST","eligible_count":2,"quota":1,"floor_allocation":1,"remainder":0,"final_allocation":1},
      {"stratum_code":"NORTH","eligible_count":0,"quota":0,"floor_allocation":0,"remainder":0,"final_allocation":0},
      {"stratum_code":"SOUTH","eligible_count":2,"quota":1,"floor_allocation":1,"remainder":0,"final_allocation":1}
    ]'::jsonb,
    (select result_evidence from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    '00000000-0000-0000-0000-000000000916'::uuid
  ) $$,
  '22023', null,
  '[SEC-02] draft update rejects forged per-stratum N_h'
);
select throws_ok(
  $$ select * from public.update_sampling_draft(
    (select id from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    'sample-seed', 0.5, 'stratum-definition-v3', 'sha256-mulberry32-fy-v1', 2,
    '5bcf10eb932b231d0b1bca281a788c1d4b907d841b72ba77a1b02d6df0903d22',
    (select allocation_evidence from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    (select result_evidence from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid),
    '00000000-0000-0000-0000-000000000914'::uuid
  ) $$,
  '23505', null,
  '[INT-02] changed regeneration retry conflicts on the same idempotency key'
);
select lives_ok($$ select * from public.get_sampling_run_evidence((select id from public.sampling_run where idempotency_key = '00000000-0000-0000-0000-000000000913'::uuid)) $$, '[INT-02] manager can replay draft evidence through the dedicated detail RPC');
select throws_ok($$ select * from public.get_sampling_candidates((select id from public.sampling_run where status = 'cancelled' limit 1)) $$, '42501', null, '[SEC-02] cancelled runs cannot provide selectable candidate projections');
reset role;
select is((select count(*) from public.audit_event where action_code = 'sampling.run_regenerated'), 1::bigint, '[AUD-01] regeneration appends one allowlisted audit event per change');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000801';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}';
select lives_ok($$ select * from public.list_sampling_runs() $$, '[RLS-09] admin receives aggregate summaries after runs exist');
select throws_ok($$ select * from public.get_sampling_candidates((select id from public.sampling_run where status = 'active' limit 1)) $$, '42501', null, '[RLS-09] admin cannot read active member-level candidates');
select throws_ok($$ select * from public.get_sampling_population_candidates((select id from public.list_population_imports() where status = 'accepted' limit 1)) $$, '42501', null, '[RLS-09] admin cannot read accepted population candidates');
select throws_ok($$ select * from public.get_sampling_run_evidence((select id from public.sampling_run where status = 'active' limit 1)) $$, '42501', null, '[RLS-09] admin cannot read active detailed evidence');
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000803';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000803","role":"authenticated"}';
select throws_ok($$ select * from public.list_sampling_runs() $$, '42501', null, '[RLS-09] field collector cannot list sampling runs');
select throws_ok($$ select * from public.get_sampling_candidates('00000000-0000-0000-0000-000000000999'::uuid) $$, '42501', null, '[RLS-09] field collector cannot read sampling candidates');
select throws_ok($$ select * from public.get_sampling_population_candidates('00000000-0000-0000-0000-000000000999'::uuid) $$, '42501', null, '[RLS-09] field collector cannot read population candidates');
select throws_ok($$ select * from public.activate_sampling_run('00000000-0000-0000-0000-000000000999'::uuid) $$, '42501', null, '[RLS-09] field collector cannot activate sampling runs');

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000804';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000804","role":"authenticated"}';
select throws_ok($$ select * from public.list_sampling_runs() $$, '42501', null, '[RLS-09] farmer cannot list sampling runs');
select throws_ok($$ select * from public.get_sampling_population_candidates('00000000-0000-0000-0000-000000000999'::uuid) $$, '42501', null, '[RLS-09] farmer cannot read population candidates');

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000805';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000805","role":"authenticated"}';
select lives_ok($$ select * from public.list_sampling_runs() $$, '[RLS-09] evaluator receives safe run projections');
select throws_ok($$ select * from public.get_sampling_candidates((select id from public.list_sampling_runs() where status = 'active')) $$, '42501', null, '[RLS-09] evaluator cannot read member-level candidates');
select throws_ok($$ select * from public.get_sampling_population_candidates('00000000-0000-0000-0000-000000000999'::uuid) $$, '42501', null, '[RLS-09] evaluator cannot read accepted population candidates');
select throws_ok($$ select * from public.get_sampling_run_evidence((select id from public.list_sampling_runs() where status = 'active')) $$, '42501', null, '[RLS-09] evaluator cannot read detailed sampling evidence');
select ok(
  not ((select to_jsonb(row) from public.list_sampling_runs() as row where status = 'active' limit 1)
    ?| array['population_import_id', 'result_evidence', 'seed_text', 'seed_digest_hex', 'ordered_candidate_set_hash']),
  '[RLS-09] evaluator summary omits population, seed, result and member evidence identifiers'
);

reset role;
select is((select count(*) from public.audit_event where action_code like 'sampling.%'), 11::bigint, '[AUD-01] all lifecycle transitions append allowlisted audits');

select * from finish();
rollback;
