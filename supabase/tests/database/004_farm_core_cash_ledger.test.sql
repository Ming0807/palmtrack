begin;

select plan(75);

-- 1. Schema & Table Structure Tests
select has_table('public', 'farmer', '[FR-08] farmer table exists');
select has_table('public', 'farm', '[FR-08] farm table exists');
select has_table('public', 'plot', '[FR-08] plot table exists');
select has_table('public', 'expense', '[FR-09] expense table exists');
select has_table('public', 'sale', '[FR-10] sale table exists');

select has_function('public', 'ensure_farmer_profile', array['text', 'text'], '[FR-08] ensure_farmer_profile RPC exists');
select has_function('public', 'list_my_farms', array[]::text[], '[FR-08] list_my_farms RPC exists');
select has_function('public', 'create_farm', array['text', 'text', 'numeric'], '[FR-08] create_farm RPC exists');
select has_function('public', 'update_farm', array['uuid', 'text', 'text', 'numeric'], '[FR-08] update_farm RPC exists');
select has_function('public', 'soft_delete_farm', array['uuid', 'text'], '[FR-08] soft_delete_farm RPC exists');
select has_function('public', 'list_my_plots', array['uuid'], '[FR-08] list_my_plots RPC exists');
select has_function('public', 'create_plot', array['uuid', 'text', 'text', 'numeric'], '[FR-08] create_plot RPC exists');
select has_function('public', 'update_plot', array['uuid', 'text', 'text', 'numeric'], '[FR-08] update_plot RPC exists');
select has_function('public', 'soft_delete_plot', array['uuid', 'text'], '[FR-08] soft_delete_plot RPC exists');
select has_function('public', 'list_my_expenses', array['uuid', 'date', 'date', 'boolean'], '[FR-09] list_my_expenses RPC exists');
select has_function('public', 'create_expense', array['uuid', 'uuid', 'text', 'numeric', 'date', 'text'], '[FR-09] create_expense RPC exists');
select has_function('public', 'soft_delete_expense', array['uuid', 'text'], '[FR-09] soft_delete_expense RPC exists');
select has_function('public', 'list_my_sales', array['uuid', 'date', 'date', 'boolean'], '[FR-10] list_my_sales RPC exists');
select has_function('public', 'create_sale', array['uuid', 'uuid', 'date', 'text', 'numeric', 'numeric', 'numeric', 'text'], '[FR-10] create_sale RPC exists');
select has_function('public', 'soft_delete_sale', array['uuid', 'text'], '[FR-10] soft_delete_sale RPC exists');
select has_function('public', 'get_my_cash_ledger_summary', array['uuid', 'date', 'date'], '[FR-11] get_my_cash_ledger_summary RPC exists');

-- 2. RLS Catalog Check
select ok(
  (
    select bool_and(table_class.relrowsecurity and table_class.relforcerowsecurity)
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema
      on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname in ('farmer', 'farm', 'plot', 'expense', 'sale')
  ),
  '[RLS-05] farm ledger tables enable and force RLS'
);

select table_privs_are(
  'public',
  'farm',
  'authenticated',
  array[]::text[],
  '[RLS-05] authenticated has no direct farm table privilege'
);

select table_privs_are(
  'public',
  'sale',
  'authenticated',
  array[]::text[],
  '[RLS-05] authenticated has no direct sale table privilege'
);

-- 3. Seed Users & Workspace
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000801', 'authenticated', 'authenticated', 'ledger-admin@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000802', 'authenticated', 'authenticated', 'ledger-manager@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000803', 'authenticated', 'authenticated', 'ledger-collector@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000804', 'authenticated', 'authenticated', 'ledger-farmer-a@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000805', 'authenticated', 'authenticated', 'ledger-evaluator@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000806', 'authenticated', 'authenticated', 'ledger-farmer-b@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp());

set local role palmtrack_recovery_executor;
select private.bootstrap_workspace(
  'Farm Core Ledger Workspace',
  '00000000-0000-0000-0000-000000000801'::uuid
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
  ('00000000-0000-0000-0000-000000000902'::uuid, '00000000-0000-0000-0000-000000000802'::uuid, 'research_manager'),
  ('00000000-0000-0000-0000-000000000903'::uuid, '00000000-0000-0000-0000-000000000803'::uuid, 'field_collector'),
  ('00000000-0000-0000-0000-000000000904'::uuid, '00000000-0000-0000-0000-000000000804'::uuid, 'farmer'),
  ('00000000-0000-0000-0000-000000000905'::uuid, '00000000-0000-0000-0000-000000000805'::uuid, 'evaluator_readonly'),
  ('00000000-0000-0000-0000-000000000906'::uuid, '00000000-0000-0000-0000-000000000806'::uuid, 'farmer')
) as fixture(profile_id, auth_user_id, role)
where workspace.status = 'active';

-- 4. Positive Tests: Farmer A
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000804';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000804","role":"authenticated"}';

-- Ensure profile
select lives_ok(
  $$ select public.ensure_farmer_profile('เกษตรกร สมหวัง', '+66812345678') $$,
  '[INT-07] farmer A ensures profile'
);

-- Create Farm
select lives_ok(
  $$ select public.create_farm('สวนปาล์มสมหวัง', 'อ.อ่าวลึก จ.กระบี่', 25.500) $$,
  '[INT-07] farmer A creates farm'
);

select is(
  (select count(*) from public.list_my_farms()),
  1::bigint,
  '[INT-07] farmer A sees exactly 1 farm'
);

select is(
  (select total_area from public.list_my_farms() limit 1),
  '25.500',
  '[UNIT-04] farm area has 3 decimal places'
);

-- Create Plots
select lives_ok(
  $$ select public.create_plot(
    (select id from public.list_my_farms() limit 1),
    'P-01',
    'แปลงต้นน้ำ',
    12.000
  ) $$,
  '[INT-07] farmer A creates plot 1'
);

select lives_ok(
  $$ select public.create_plot(
    (select id from public.list_my_farms() limit 1),
    'P-02',
    'แปลงเชิงเขา',
    13.500
  ) $$,
  '[INT-07] farmer A creates plot 2'
);

select is(
  (select count(*) from public.list_my_plots((select id from public.list_my_farms() limit 1))),
  2::bigint,
  '[INT-07] farmer A lists 2 plots for farm'
);

select throws_ok(
  $$ select public.create_plot(
    (select id from public.list_my_farms() limit 1),
    'P-OVER',
    'แปลงเกินพื้นที่สวน',
    0.001
  ) $$,
  '22023',
  null,
  '[INT-07] active plot area cannot exceed farm total area'
);

select throws_ok(
  $$ select public.update_plot(
    (select id from public.list_my_plots((select id from public.list_my_farms() limit 1)) where code = 'P-01'),
    'P-01',
    'แปลงต้นน้ำ',
    12.001
  ) $$,
  '22023',
  null,
  '[INT-07] plot update cannot make active plot area exceed farm total area'
);

select throws_ok(
  $$ select public.update_farm(
    (select id from public.list_my_farms() limit 1),
    'สวนปาล์มสมหวัง',
    'อ.อ่าวลึก จ.กระบี่',
    25.499
  ) $$,
  '22023',
  null,
  '[INT-07] farm area cannot be reduced below active plot area'
);

-- Record Expenses (Fixture: 3000.25 + 500.00 active, 100.00 deleted)
select lives_ok(
  $$ select public.create_expense(
    (select id from public.list_my_farms() limit 1),
    (select id from public.list_my_plots((select id from public.list_my_farms() limit 1)) where code = 'P-01' limit 1),
    'ปุ๋ย 15-15-15',
    3000.25,
    '2026-08-01'::date,
    'ใส่ปุ๋ยรอบแรก'
  ) $$,
  '[INT-08] farmer A records active expense 1'
);

select lives_ok(
  $$ select public.create_expense(
    (select id from public.list_my_farms() limit 1),
    null,
    'แรงงานตัดแต่ง',
    500.00,
    '2026-08-05'::date,
    null
  ) $$,
  '[INT-08] farmer A records active expense 2'
);

select lives_ok(
  $$ select public.create_expense(
    (select id from public.list_my_farms() limit 1),
    null,
    'ซ่อมท่อน้ำ',
    100.00,
    '2026-08-10'::date,
    'จะลบรายการนี้'
  ) $$,
  '[INT-08] farmer A records expense 3 to be deleted'
);

-- Record Sales (Fixture: 10000.00 + 2500.50 active, 999.00 deleted)
-- Sale 1: qty 10.000 @ 1000.00 = 10000.00 gross, 0 deduction = 10000.00 net
select lives_ok(
  $$ select public.create_sale(
    (select id from public.list_my_farms() limit 1),
    (select id from public.list_my_plots((select id from public.list_my_farms() limit 1)) where code = 'P-01' limit 1),
    '2026-08-15'::date,
    'ลานเทสมบูรณ์',
    10.000,
    1000.00,
    0.00,
    'ขายผลผลิตรอบ 1'
  ) $$,
  '[INT-09] farmer A records active sale 1'
);

-- Sale 2: qty 5.000 @ 510.10 = 2550.50 gross, 50.00 deduction = 2500.50 net
select lives_ok(
  $$ select public.create_sale(
    (select id from public.list_my_farms() limit 1),
    null,
    '2026-08-20'::date,
    'ลานเทสมบูรณ์',
    5.000,
    510.10,
    50.00,
    'ขายผลผลิตรอบ 2'
  ) $$,
  '[INT-09] farmer A records active sale 2'
);

-- Sale 3: qty 1.000 @ 1000.00 = 1000.00 gross, 1.00 deduction = 999.00 net (to delete)
select lives_ok(
  $$ select public.create_sale(
    (select id from public.list_my_farms() limit 1),
    null,
    '2026-08-22'::date,
    'ลานเทสมบูรณ์',
    1.000,
    1000.00,
    1.00,
    'รายการผิดพลาด'
  ) $$,
  '[INT-09] farmer A records sale 3 to be deleted'
);

-- Soft delete expense 3 and sale 3
select lives_ok(
  $$ select public.soft_delete_expense(
    (select id from public.list_my_expenses((select id from public.list_my_farms() limit 1)) where category = 'ซ่อมท่อน้ำ' limit 1),
    'บันทึกซ้ำซ้อน'
  ) $$,
  '[AUD-03] farmer A soft-deletes expense with reason'
);

select lives_ok(
  $$ select public.soft_delete_sale(
    (select id from public.list_my_sales((select id from public.list_my_farms() limit 1)) where notes = 'รายการผิดพลาด' limit 1),
    'ยกเลิกใบเสร็จเดิม'
  ) $$,
  '[AUD-03] farmer A soft-deletes sale with reason'
);

-- 5. Finance Reconciliation & Summary Check (Fixture Profit = 9,000.25)
select is(
  (select net_income from public.get_my_cash_ledger_summary((select id from public.list_my_farms() limit 1), '2026-08-01'::date, '2026-08-31'::date)),
  '12500.50',
  '[REP-01] active sales net sum is exactly 12500.50 (10000.00 + 2500.50)'
);

select is(
  (select expense_total from public.get_my_cash_ledger_summary((select id from public.list_my_farms() limit 1), '2026-08-01'::date, '2026-08-31'::date)),
  '3500.25',
  '[REP-01] active expenses sum is exactly 3500.25 (3000.25 + 500.00)'
);

select is(
  (select cash_result from public.get_my_cash_ledger_summary((select id from public.list_my_farms() limit 1), '2026-08-01'::date, '2026-08-31'::date)),
  '9000.25',
  '[REP-01] cash result equals fixture target 9000.25 (12500.50 - 3500.25)'
);

select is(
  (select sale_count from public.get_my_cash_ledger_summary((select id from public.list_my_farms() limit 1), '2026-08-01'::date, '2026-08-31'::date)),
  2,
  '[REP-01] active sale count excludes deleted sale'
);

select is(
  (select expense_count from public.get_my_cash_ledger_summary((select id from public.list_my_farms() limit 1), '2026-08-01'::date, '2026-08-31'::date)),
  2,
  '[REP-01] active expense count excludes deleted expense'
);

-- 6. Negative Constraints & Invariant Tests

-- Negative expense amount
select throws_ok(
  $$ select public.create_expense(
    (select id from public.list_my_farms() limit 1),
    null,
    'ปุ๋ย',
    -100.00,
    '2026-08-01'::date,
    null
  ) $$,
  '22023',
  null,
  '[UNIT-04] negative expense amount rejected'
);

-- Zero quantity sale
select throws_ok(
  $$ select public.create_sale(
    (select id from public.list_my_farms() limit 1),
    null,
    '2026-08-01'::date,
    'ลานเท',
    0.000,
    100.00,
    0.00,
    null
  ) $$,
  '22023',
  null,
  '[UNIT-05] zero quantity sale rejected'
);

-- Deductions exceed gross amount
select throws_ok(
  $$ select public.create_sale(
    (select id from public.list_my_farms() limit 1),
    null,
    '2026-08-01'::date,
    'ลานเท',
    1.000,
    100.00,
    150.00,
    null
  ) $$,
  '22023',
  null,
  '[UNIT-05] deduction exceeding gross amount rejected'
);

-- Direct Hard Delete Rejected
select throws_ok(
  $$ delete from public.farm $$,
  '42501',
  null,
  '[RLS-05] direct hard delete on farm rejected by policy/trigger'
);

select throws_ok(
  $$ delete from public.sale $$,
  '42501',
  null,
  '[RLS-05] direct hard delete on sale rejected by policy/trigger'
);

-- 7. Cross-Farmer Isolation Tests (Farmer B)
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000806';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000806","role":"authenticated"}';

select is(
  (select count(*) from public.list_my_farms()),
  0::bigint,
  '[RLS-05] farmer B cannot see farmer A farms'
);

select is(
  (select count(*) from public.list_my_plots('00000000-0000-0000-0000-000000000001'::uuid)),
  0::bigint,
  '[RLS-05] farmer B cannot list plots of other farm'
);

select is(
  (select count(*) from public.list_my_expenses('00000000-0000-0000-0000-000000000001'::uuid)),
  0::bigint,
  '[RLS-05] farmer B cannot list expenses of other farm'
);

select is(
  (select count(*) from public.list_my_sales('00000000-0000-0000-0000-000000000001'::uuid)),
  0::bigint,
  '[RLS-05] farmer B cannot list sales of other farm'
);

select throws_ok(
  $$ select public.create_expense(
    '00000000-0000-0000-0000-000000000001'::uuid,
    null,
    'ค่าปุ๋ยสวมสิทธิ์',
    500.00,
    '2026-08-01'::date,
    null
  ) $$,
  '42501',
  null,
  '[RLS-05] farmer B cannot create expense on other farm'
);

select throws_ok(
  $$ select public.create_sale(
    '00000000-0000-0000-0000-000000000001'::uuid,
    null,
    '2026-08-01'::date,
    'ลานเท',
    1.000,
    100.00,
    0.00,
    null
  ) $$,
  '42501',
  null,
  '[RLS-05] farmer B cannot create sale on other farm'
);

select throws_ok(
  $$ select public.soft_delete_farm(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'พยายามลบสวนคนอื่น'
  ) $$,
  '42501',
  null,
  '[RLS-05] farmer B cannot soft-delete other farm'
);

-- 8. Non-Farmer Role Denials
-- Admin
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000801';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}';

select throws_ok(
  $$ select public.create_farm('สวนแอดมิน', null, 10.000) $$,
  '42501',
  null,
  '[RLS-05] admin cannot create farm'
);

select throws_ok(
  $$ select public.create_sale(
    '00000000-0000-0000-0000-000000000001'::uuid,
    null,
    '2026-08-01'::date,
    'ลานเท',
    1.000,
    100.00,
    0.00,
    null
  ) $$,
  '42501',
  null,
  '[RLS-05] admin cannot record sale'
);

-- Research Manager
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000802';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}';

select throws_ok(
  $$ select public.create_farm('สวนผู้จัดการ', null, 10.000) $$,
  '42501',
  null,
  '[RLS-05] research manager cannot create farm'
);

select throws_ok(
  $$ select public.create_expense(
    '00000000-0000-0000-0000-000000000001'::uuid,
    null,
    'ปุ๋ย',
    100.00,
    '2026-08-01'::date,
    null
  ) $$,
  '42501',
  null,
  '[RLS-05] research manager cannot record expense'
);

-- Field Collector
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000803';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000803","role":"authenticated"}';

select throws_ok(
  $$ select public.create_farm('สวนผู้เก็บข้อมูล', null, 10.000) $$,
  '42501',
  null,
  '[RLS-05] field collector cannot create farm via farmer RPC'
);

-- Evaluator
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000805';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000805","role":"authenticated"}';

select throws_ok(
  $$ select public.create_farm('สวนผู้ประเมิน', null, 10.000) $$,
  '42501',
  null,
  '[RLS-05] evaluator cannot create farm'
);

select throws_ok(
  $$ select public.list_my_farms() $$,
  '42501',
  null,
  '[RLS-05] evaluator cannot call list_my_farms'
);

-- 9. Audit Events Trail Check
reset role;
select is(
  (
    select details
    from public.audit_event
    where action_code = 'farmer.profile_created'
    order by occurred_at desc
    limit 1
  ),
  jsonb_build_object(
    'full_name_digest', encode(extensions.digest(convert_to('เกษตรกร สมหวัง', 'UTF8'), 'sha256'), 'hex'),
    'phone_number_present', true
  ),
  '[AUD-03] farmer profile audit stores only a name digest and phone presence flag'
);
select ok(
  exists (select 1 from public.audit_event where action_code = 'farm.created'),
  '[AUD-03] farm.created audit event exists'
);
select ok(
  exists (select 1 from public.audit_event where action_code = 'plot.created'),
  '[AUD-03] plot.created audit event exists'
);
select ok(
  exists (select 1 from public.audit_event where action_code = 'expense.created'),
  '[AUD-03] expense.created audit event exists'
);
select ok(
  exists (select 1 from public.audit_event where action_code = 'expense.soft_deleted'),
  '[AUD-03] expense.soft_deleted audit event exists'
);
select ok(
  exists (select 1 from public.audit_event where action_code = 'sale.created'),
  '[AUD-03] sale.created audit event exists'
);
select ok(
  exists (select 1 from public.audit_event where action_code = 'sale.soft_deleted'),
  '[AUD-03] sale.soft_deleted audit event exists'
);

create temporary table farm_under_test as
select entity_id as farm_id
from public.audit_event
where action_code = 'farm.created'
order by occurred_at
limit 1;
grant select on table farm_under_test to authenticated;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000804';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000804","role":"authenticated"}';

select lives_ok(
  $$ select public.soft_delete_farm(
    (select farm_id from farm_under_test),
    'ยุติการใช้งานสวนทดสอบ'
  ) $$,
  '[AUD-03] farmer can soft-delete own farm with a reason'
);

select is(
  (select has_records from public.get_my_cash_ledger_summary(null, null, null)),
  false,
  '[REP-01] soft-deleted farm is excluded from the active ledger summary'
);

rollback;
