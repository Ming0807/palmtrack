begin;

select plan(20);

select has_table('public', 'farmer', '[INT-07] farmer table exists');
select has_table('public', 'farm', '[INT-07] farm table exists');
select has_table('public', 'plot', '[INT-07] plot table exists');
select has_function('public', 'create_farmer_profile', array['text'], '[INT-07] farmer create RPC exists');
select has_function('public', 'create_farm', array['text', 'numeric'], '[INT-07] farm create RPC exists');
select has_function('public', 'list_farms', array[]::text[], '[INT-07] farm list RPC exists');
select has_function('public', 'delete_farm', array['uuid', 'text'], '[INT-07] farm delete RPC exists');
select has_function('public', 'create_plot', array['uuid', 'text', 'numeric'], '[INT-07] plot create RPC exists');
select ok(
  (
    select bool_and(table_class.relrowsecurity and table_class.relforcerowsecurity)
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname in ('farmer', 'farm', 'plot')
  ),
  '[RLS-05] farm tables enable and force RLS'
);
select table_privs_are('public', 'farm', 'authenticated', array[]::text[], '[RLS-05] authenticated has no farm table privilege');
select table_privs_are('public', 'plot', 'service_role', array[]::text[], '[RLS-05] service role has no plot table privilege');
select function_privs_are('public', 'create_farm', array['text', 'numeric'], 'authenticated', array['EXECUTE'], '[RLS-05] authenticated receives only farm create execution');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000521', 'authenticated', 'authenticated', 'farm-admin@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000522', 'authenticated', 'authenticated', 'farm-owner-a@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000523', 'authenticated', 'authenticated', 'farm-owner-b@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000524', 'authenticated', 'authenticated', 'farm-manager@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp());

set local role palmtrack_recovery_executor;
select private.bootstrap_workspace('Synthetic farm workspace', '00000000-0000-0000-0000-000000000521'::uuid);
reset role;

insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
select fixture.profile_id, fixture.auth_user_id, workspace.id, fixture.role::public.app_role, 'active'::public.record_status
from public.workspace as workspace
cross join (values
  ('00000000-0000-0000-0000-000000000622'::uuid, '00000000-0000-0000-0000-000000000522'::uuid, 'farmer'),
  ('00000000-0000-0000-0000-000000000623'::uuid, '00000000-0000-0000-0000-000000000523'::uuid, 'farmer'),
  ('00000000-0000-0000-0000-000000000624'::uuid, '00000000-0000-0000-0000-000000000524'::uuid, 'research_manager')
) as fixture(profile_id, auth_user_id, role)
where workspace.status = 'active';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000522';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000522","role":"authenticated"}';

create temp table farm_owner_a as select * from public.create_farmer_profile('ชาวสวนสังเคราะห์ ก');

select is(
  (select count(*) from public.list_farms()),
  0::bigint,
  '[INT-07] new farmer owns no farm yet'
);

create temp table farm_a as select * from public.create_farm('สวนปาล์มเหนือ', 12.500);

select is(
  (select farm_a.area_rai from farm_a),
  12.500::numeric,
  '[UNIT-04] farm area keeps decimal(14,3) precision'
);

select throws_ok(
  $$ select * from public.create_farm('สวนซ้ำ', 0) $$,
  '22023',
  null,
  '[INT-07] farm with non-positive area is invalid'
);

select throws_ok(
  $$ select * from public.create_farm('   ', 5) $$,
  '22023',
  null,
  '[INT-07] farm with blank name is invalid'
);

create temp table plot_a as select * from public.create_plot(
  (select farm_a.id from farm_a), 'แปลงที่ 1', 6.250
);

select lives_ok(
  $$ select * from public.delete_farm((select farm_a.id from farm_a), 'รวมแปลงกับสวนข้างเคียง') $$,
  '[AUD-03] owner soft-deletes own farm with a reason'
);

select is(
  (select count(*) from public.list_farms()),
  0::bigint,
  '[INT-07] soft-deleted farm leaves the owner list'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000523';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000523","role":"authenticated"}';

select throws_ok(
  $$ select * from public.delete_farm((select farm_a.id from farm_a), 'แอบลบของเพื่อน') $$,
  '42501',
  null,
  '[RLS-05] farmer B cannot delete farmer A farm'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000524';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000524","role":"authenticated"}';

select throws_ok(
  $$ select * from public.create_farm('สวนของผู้จัดการ', 10) $$,
  '42501',
  null,
  '[RLS-05] research manager cannot write the farm ledger'
);

select * from finish();
rollback;
