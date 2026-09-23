begin;

select plan(34);

select has_type('public', 'sampling_run_status', '[INT-02] sampling status enum exists');
select enum_has_labels(
  'public',
  'sampling_run_status',
  array['draft', 'locked', 'active', 'superseded', 'cancelled'],
  '[INT-02] sampling status has exact labels'
);
select has_table('public', 'sampling_run', '[INT-02] sampling run table exists');
select has_table('public', 'sample_member', '[INT-02] sample member table exists');
select has_function(
  'public', 'create_sampling_draft',
  array['uuid', 'numeric', 'text', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb'],
  '[INT-02] draft RPC exists'
);
select has_function('public', 'lock_sampling_run', array['uuid', 'text', 'text'], '[INT-02] lock RPC exists');
select has_function('public', 'activate_sampling_run', array['uuid'], '[INT-02] activate RPC exists');
select has_function('public', 'cancel_sampling_run', array['uuid', 'text'], '[INT-02] cancel RPC exists');
select has_function('public', 'list_sampling_runs', array[]::text[], '[INT-02] list RPC exists');
select has_function('public', 'get_sampling_run', array['uuid'], '[INT-02] detail RPC exists');
select has_function('public', 'list_sampling_members', array['uuid'], '[INT-02] member list RPC exists');
select has_function('public', 'list_population_members', array['uuid'], '[INT-02] snapshot member list RPC exists');
select ok(
  (
    select bool_and(table_class.relrowsecurity and table_class.relforcerowsecurity)
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname in ('sampling_run', 'sample_member')
  ),
  '[RLS-09] sampling tables enable and force RLS'
);
select table_privs_are('public', 'sampling_run', 'authenticated', array[]::text[], '[RLS-09] authenticated has no sampling run table privilege');
select table_privs_are('public', 'sample_member', 'service_role', array[]::text[], '[RLS-09] service role has no sample member table privilege');
select function_privs_are('public', 'create_sampling_draft', array['uuid', 'numeric', 'text', 'text', 'text', 'bigint', 'text', 'jsonb', 'jsonb'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated receives only draft RPC execution');
select function_privs_are('public', 'activate_sampling_run', array['uuid'], 'authenticated', array['EXECUTE'], '[RLS-09] authenticated receives only activate RPC execution');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000511', 'authenticated', 'authenticated', 'sampling-admin@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000512', 'authenticated', 'authenticated', 'sampling-manager@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000513', 'authenticated', 'authenticated', 'sampling-collector@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp());

set local role palmtrack_recovery_executor;
select private.bootstrap_workspace('Synthetic sampling workspace', '00000000-0000-0000-0000-000000000511'::uuid);
reset role;

insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
select fixture.profile_id, fixture.auth_user_id, workspace.id, fixture.role::public.app_role, 'active'::public.record_status
from public.workspace as workspace
cross join (values
  ('00000000-0000-0000-0000-000000000612'::uuid, '00000000-0000-0000-0000-000000000512'::uuid, 'research_manager'),
  ('00000000-0000-0000-0000-000000000613'::uuid, '00000000-0000-0000-0000-000000000513'::uuid, 'field_collector')
) as fixture(profile_id, auth_user_id, role)
where workspace.status = 'active';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000512';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000512","role":"authenticated"}';

create temp table fixture_import as select * from public.create_population_import(
  'FX-SAMPLING', 'SYN-FX_SAMPLING', '2026-08-25', 'synthetic-population-v1',
  'synthetic-eligibility-v1',
  encode(extensions.digest(convert_to('1,SYN-001,NORTH,1,' || chr(10) || '2,SYN-002,SOUTH,1,' || chr(10), 'UTF8'), 'sha256'), 'hex'),
  '[{"row_number":1,"farmer_code":"SYN-001","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},{"row_number":2,"farmer_code":"SYN-002","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null}]'::jsonb,
  gen_random_uuid()
);

select ok(
  (select count(*) from fixture_import) = 1,
  '[INT-02] manager creates small accepted-base import'
);

select lives_ok(
  $$ select * from public.accept_population_import((select fixture_import.id from fixture_import)) $$,
  '[INT-02] test promotes import to accepted baseline'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select f.id from fixture_import as f limit 1), 0.05, 'seed', 'seed',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    0, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    '[]'::jsonb, '[]'::jsonb
  ) $$,
  '22023',
  null,
  '[INT-02] draft with empty evidence is invalid'
);

select is(
  (select count(*) from public.list_sampling_runs()),
  0::bigint,
  '[INT-02] no sampling run exists before valid draft'
);

select lives_ok(
  $$ select * from public.list_sampling_runs() $$,
  '[AUD-01] sampling audit boundary reachable without direct table access'
);

-- Replay-hardened draft vectors (TS domain contract, seed palmtrack-acceptance-seed-v1):
-- target 4, NORTH 3 / SOUTH 1, seed_u32 1180943099,
-- candidate d8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d,
-- selection SYN-001/1, SYN-003/2, SYN-006/3, SYN-004/4.
create temp table replay_import as select * from public.create_population_import(
  'FX-REPLAY', 'SYN-FX_REPLAY', '2026-08-25', 'synthetic-population-v1',
  'synthetic-eligibility-v1',
  'e8400700bbf25f7f0d2e794ae2952288bee70d20e390bfa8e83184beaad19e83',
  '[{"row_number":1,"farmer_code":"SYN-001","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},{"row_number":2,"farmer_code":"SYN-002","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},{"row_number":3,"farmer_code":"SYN-003","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},{"row_number":4,"farmer_code":"SYN-004","stratum_code":"NORTH","eligible":true,"exclusion_reason_code":null},{"row_number":5,"farmer_code":"SYN-005","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null},{"row_number":6,"farmer_code":"SYN-006","stratum_code":"SOUTH","eligible":true,"exclusion_reason_code":null}]'::jsonb,
  gen_random_uuid()
);

select lives_ok(
  $$ select * from public.accept_population_import((select replay_import.id from replay_import)) $$,
  '[INT-02] test promotes replay import to accepted baseline'
);

create temp table replay_members as
  select * from public.list_population_members((select replay_import.id from replay_import));

create temp table replay_expected as
  select fixture.farmer_code, fixture.stratum_code, fixture.selection_order, snapshot.id as member_id
  from (values
    ('SYN-001', 'NORTH', 1),
    ('SYN-003', 'NORTH', 2),
    ('SYN-006', 'SOUTH', 3),
    ('SYN-004', 'NORTH', 4)
  ) as fixture(farmer_code, stratum_code, selection_order)
  join replay_members as snapshot on snapshot.farmer_code = fixture.farmer_code;

create temp table replay_draft as select * from public.create_sampling_draft(
  (select replay_import.id from replay_import), 0.4,
  'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
  '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99',
  1180943099,
  'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
  '[{"stratum_code":"NORTH","final_allocation":3},{"stratum_code":"SOUTH","final_allocation":1}]'::jsonb,
  (select jsonb_agg(elem order by ord) from (
    select jsonb_build_object(
      'population_member_id', expected.member_id,
      'stratum_code', expected.stratum_code,
      'selection_order', expected.selection_order
    ) as elem, expected.selection_order as ord
    from replay_expected as expected
  ) as built)
);

select is(
  (select replay_draft.status::text from replay_draft),
  'draft',
  '[NFR-04] replay-exact draft is accepted'
);

select is(
  (select replay_draft.target_n from replay_draft),
  4,
  '[NFR-04] replay draft carries Yamane target 4'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select replay_import.id from replay_import), 0.4,
    'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
    '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99',
    1180943099,
    'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
    '[{"stratum_code":"NORTH","final_allocation":3},{"stratum_code":"SOUTH","final_allocation":1}]'::jsonb,
    (select jsonb_agg(elem order by ord) from (
      select jsonb_build_object(
        'population_member_id', snapshot.id,
        'stratum_code', snapshot.stratum_code,
        'selection_order', expected.selection_order
      ) as elem, expected.selection_order as ord
      from replay_expected as expected
      join replay_members as snapshot on snapshot.farmer_code = 'SYN-002'
      where expected.farmer_code = 'SYN-004'
      union all
      select jsonb_build_object(
        'population_member_id', expected.member_id,
        'stratum_code', expected.stratum_code,
        'selection_order', expected.selection_order
      ) as elem, expected.selection_order as ord
      from replay_expected as expected
      where expected.farmer_code <> 'SYN-004'
    ) as built)
  ) $$,
  '22023',
  null,
  '[NFR-04] draft with substituted member is rejected'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select replay_import.id from replay_import), 0.4,
    'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
    '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99',
    1180943099,
    'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
    '[{"stratum_code":"NORTH","final_allocation":2},{"stratum_code":"SOUTH","final_allocation":2}]'::jsonb,
    (select jsonb_agg(elem order by ord) from (
      select jsonb_build_object(
        'population_member_id', expected.member_id,
        'stratum_code', expected.stratum_code,
        'selection_order', expected.selection_order
      ) as elem, expected.selection_order as ord
      from replay_expected as expected
    ) as built)
  ) $$,
  '22023',
  null,
  '[NFR-04] draft with forged allocation is rejected'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select replay_import.id from replay_import), 0.4,
    'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
    '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99',
    1180943099,
    '0000000000000000000000000000000000000000000000000000000000000000',
    '[{"stratum_code":"NORTH","final_allocation":3},{"stratum_code":"SOUTH","final_allocation":1}]'::jsonb,
    (select jsonb_agg(elem order by ord) from (
      select jsonb_build_object(
        'population_member_id', expected.member_id,
        'stratum_code', expected.stratum_code,
        'selection_order', expected.selection_order
      ) as elem, expected.selection_order as ord
      from replay_expected as expected
    ) as built)
  ) $$,
  '22023',
  null,
  '[NFR-04] draft with forged candidate hash is rejected'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select replay_import.id from replay_import), 0.4,
    'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
    '0000000000000000000000000000000000000000000000000000000000000000',
    1180943099,
    'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
    '[{"stratum_code":"NORTH","final_allocation":3},{"stratum_code":"SOUTH","final_allocation":1}]'::jsonb,
    (select jsonb_agg(elem order by ord) from (
      select jsonb_build_object(
        'population_member_id', expected.member_id,
        'stratum_code', expected.stratum_code,
        'selection_order', expected.selection_order
      ) as elem, expected.selection_order as ord
      from replay_expected as expected
    ) as built)
  ) $$,
  '22023',
  null,
  '[NFR-04] draft with forged seed digest is rejected'
);

select throws_ok(
  $$ select * from public.create_sampling_draft(
    (select replay_import.id from replay_import), 0.4,
    'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
    '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99',
    0,
    'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
    '[{"stratum_code":"NORTH","final_allocation":3},{"stratum_code":"SOUTH","final_allocation":1}]'::jsonb,
    (select jsonb_agg(elem order by ord) from (
      select jsonb_build_object(
        'population_member_id', expected.member_id,
        'stratum_code', expected.stratum_code,
        'selection_order', expected.selection_order
      ) as elem, expected.selection_order as ord
      from replay_expected as expected
    ) as built)
  ) $$,
  '22023',
  null,
  '[NFR-04] draft with forged seed u32 is rejected'
);

select lives_ok(
  $$ select * from public.lock_sampling_run(
    (select replay_draft.id from replay_draft),
    'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
    '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99'
  ) $$,
  '[INT-02] replay draft locks with matching evidence'
);

select lives_ok(
  $$ select * from public.cancel_sampling_run(
    (select replay_draft.id from replay_draft), 'synthetic replay Correction'
  ) $$,
  '[INT-02] locked run cancels without check violation'
);

select is(
  (select status::text from public.get_sampling_run((select replay_draft.id from replay_draft))),
  'cancelled',
  '[INT-02] cancelled-from-locked run reports cancelled status'
);

create temp table replay_draft_two as select * from public.create_sampling_draft(
  (select replay_import.id from replay_import), 0.4,
  'palmtrack-acceptance-seed-v1', 'palmtrack-acceptance-seed-v1',
  '4663c2fb4a7778ad567363b417bff49986618fc91c1f7ad0997547cf0dedef99',
  1180943099,
  'd8be5b996c5fb411d4f49e140f0cdfec2baadb35a71619dd1fa044327d9be89d',
  '[{"stratum_code":"NORTH","final_allocation":3},{"stratum_code":"SOUTH","final_allocation":1}]'::jsonb,
  (select jsonb_agg(elem order by ord) from (
    select jsonb_build_object(
      'population_member_id', expected.member_id,
      'stratum_code', expected.stratum_code,
      'selection_order', expected.selection_order
    ) as elem, expected.selection_order as ord
    from replay_expected as expected
  ) as built)
);

select lives_ok(
  $$ select * from public.cancel_sampling_run(
    (select replay_draft_two.id from replay_draft_two), 'synthetic draft withdrawal'
  ) $$,
  '[INT-02] draft run still cancels without a lock timestamp'
);

select * from finish();
rollback;
