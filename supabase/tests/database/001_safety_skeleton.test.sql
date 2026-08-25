begin;

select plan(54);

select has_type('public', 'app_role', 'app_role enum exists');
select enum_has_labels(
  'public',
  'app_role',
  array['admin', 'research_manager', 'field_collector', 'farmer', 'evaluator_readonly'],
  'app_role has the five exact labels'
);
select enum_has_labels(
  'public',
  'record_status',
  array['active', 'inactive'],
  'record_status has the two exact labels'
);
select has_table('public', 'workspace', 'workspace exists');
select has_table('public', 'user_profile', 'user_profile exists');
select has_table('public', 'audit_event', 'audit_event exists');
select table_privs_are(
  'public',
  'user_profile',
  'authenticated',
  array[]::text[],
  'authenticated has no base user_profile privileges'
);
select function_privs_are(
  'public',
  'get_current_profile',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  'authenticated can execute the fixed own-profile projection'
);
select col_not_null('public', 'user_profile', 'auth_user_id', 'auth linkage is required');
select col_not_null('public', 'user_profile', 'workspace_id', 'workspace scope is required');
select col_not_null('public', 'audit_event', 'actor_profile_id', 'audit actor is required');
select col_not_null('public', 'audit_event', 'occurred_at', 'audit UTC instant is required');
select ok(
  (
    select bool_and(table_class.relrowsecurity and table_class.relforcerowsecurity)
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema
      on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname in ('workspace', 'user_profile', 'audit_event')
  ),
  'all exposed Safety Skeleton tables enable and force RLS'
);

select ok(
  not role_state.rolcanlogin
    and not role_state.rolinherit
    and not role_state.rolsuper
    and not role_state.rolcreaterole
    and not role_state.rolreplication
    and not role_state.rolbypassrls
    and role_state.rolconnlimit = 0,
  'audit writer is hardened and cannot log in'
)
from pg_catalog.pg_roles as role_state
where role_state.rolname = 'palmtrack_audit_writer';
select ok(
  not role_state.rolcanlogin
    and not role_state.rolinherit
    and not role_state.rolsuper
    and not role_state.rolcreaterole
    and not role_state.rolreplication
    and not role_state.rolbypassrls
    and role_state.rolconnlimit = 0,
  'transaction owner is hardened and cannot log in'
)
from pg_catalog.pg_roles as role_state
where role_state.rolname = 'palmtrack_transaction_owner';
select ok(
  not role_state.rolcanlogin
    and not role_state.rolinherit
    and not role_state.rolsuper
    and not role_state.rolcreaterole
    and not role_state.rolreplication
    and not role_state.rolbypassrls
    and role_state.rolconnlimit = 0,
  'recovery executor is hardened and cannot log in'
)
from pg_catalog.pg_roles as role_state
where role_state.rolname = 'palmtrack_recovery_executor';
select is(
  (
    select count(*)
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted on granted.oid = membership.roleid
    join pg_catalog.pg_roles as member on member.oid = membership.member
    where granted.rolname like 'palmtrack_%'
       or member.rolname like 'palmtrack_%'
  ),
  0::bigint,
  'internal roles retain no inherited memberships after reset hardening'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(procedure.proowner)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as procedure_schema
      on procedure_schema.oid = procedure.pronamespace
    where procedure_schema.nspname = 'private'
      and procedure.proname = 'append_audit_event'
  ),
  'palmtrack_audit_writer',
  'audit append function has the dedicated owner'
);
select is(
  (select count(*) from public.workspace where status = 'active'),
  0::bigint,
  'zero active workspace is allowed before bootstrap'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'admin@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'replacement@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'inactive-profile@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp()),
  ('00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'cross-workspace@synthetic.invalid', '', statement_timestamp(), statement_timestamp(), statement_timestamp());

set local role palmtrack_recovery_executor;
select lives_ok(
  $$ select private.bootstrap_workspace(
       'Synthetic PalmTrack workspace',
       '00000000-0000-0000-0000-000000000101'::uuid
     ) $$,
  'recovery-only bootstrap moves zero active workspace to one'
);
reset role;

select is(
  (select count(*) from public.workspace where status = 'active'),
  1::bigint,
  'exactly one active workspace exists after bootstrap'
);
select is(
  (select count(*) from public.audit_event where action_code = 'workspace.bootstrap'),
  1::bigint,
  'bootstrap appends one audited event'
);
select throws_ok(
  $$ insert into public.workspace (name, status) values ('Synthetic second active', 'active') $$,
  '23505',
  null,
  'V1 rejects a second active workspace'
);

insert into public.workspace (id, name, status)
values ('00000000-0000-0000-0000-000000000201', 'Synthetic inactive workspace', 'inactive');
insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
values (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000103',
  (select id from public.workspace where status = 'active'),
  'research_manager',
  'inactive'
);
insert into public.user_profile (id, auth_user_id, workspace_id, role, status)
values (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000201',
  'farmer',
  'inactive'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000101';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}';

select is(
  (select count(*) from public.get_current_profile()),
  1::bigint,
  'active user receives exactly one own-profile projection'
);
select ok(
  not ((select to_jsonb(profile) from public.get_current_profile() as profile) ? 'auth_user_id'),
  'own-profile projection excludes auth_user_id'
);
select throws_ok(
  $$ select * from public.user_profile $$,
  '42501',
  null,
  'authenticated cannot read the profile base table'
);
select throws_ok(
  $$ update public.user_profile set auth_user_id = gen_random_uuid() $$,
  '42501',
  null,
  'authenticated admin cannot mutate identity linkage directly'
);
select throws_ok(
  $$ select private.recovery_relink_auth_user(
       '00000000-0000-0000-0000-000000000301'::uuid,
       '00000000-0000-0000-0000-000000000102'::uuid,
       'synthetic recovery reason',
       'synthetic recovery reference'
     ) $$,
  '42501',
  null,
  'ordinary authenticated admin cannot execute recovery linkage'
);
select throws_ok(
  $$ select public.admin_set_profile_access(
       '00000000-0000-0000-0000-000000000302'::uuid,
       'farmer'::public.app_role,
       'active'::public.record_status
     ) $$,
  '42501',
  'operation is not permitted',
  'admin configuration cannot cross workspace'
);
select throws_ok(
  $$ insert into public.audit_event (
       workspace_id, actor_profile_id, action_code, entity_type, entity_id, result, details
     ) values (
       '00000000-0000-0000-0000-000000000201',
       '00000000-0000-0000-0000-000000000302',
       'workspace.bootstrap',
       'workspace',
       '00000000-0000-0000-0000-000000000201',
       'success',
       '{"status":"active"}'::jsonb
     ) $$,
  '42501',
  null,
  'authenticated admin cannot insert audit rows directly'
);
select throws_ok(
  $$ update public.audit_event set result = 'denied' $$,
  '42501',
  null,
  'authenticated admin cannot update audit rows directly'
);
select throws_ok(
  $$ delete from public.audit_event $$,
  '42501',
  null,
  'authenticated admin cannot delete audit rows directly'
);
select throws_ok(
  $$ truncate table public.audit_event $$,
  '42501',
  null,
  'authenticated admin cannot truncate audit rows directly'
);
reset role;

set local role service_role;
select throws_ok(
  $$ insert into public.audit_event (
       workspace_id, actor_profile_id, action_code, entity_type, entity_id, result, details
     ) values (
       '00000000-0000-0000-0000-000000000201',
       '00000000-0000-0000-0000-000000000302',
       'workspace.bootstrap',
       'workspace',
       '00000000-0000-0000-0000-000000000201',
       'success',
       '{"status":"active"}'::jsonb
     ) $$,
  '42501',
  null,
  'service role cannot insert audit rows directly'
);
select throws_ok(
  $$ update public.audit_event set result = 'denied' $$,
  '42501',
  null,
  'service role cannot update audit rows directly'
);
select throws_ok(
  $$ delete from public.audit_event $$,
  '42501',
  null,
  'service role cannot delete audit rows directly'
);
select throws_ok(
  $$ truncate table public.audit_event $$,
  '42501',
  null,
  'service role cannot truncate audit rows directly'
);
reset role;

select throws_ok(
  $$ insert into public.audit_event (
       workspace_id,
       actor_profile_id,
       action_code,
       entity_type,
       entity_id,
       result
     )
     select profile.workspace_id, profile.id, 'audit.direct', 'user_profile', profile.id, 'success'
     from public.user_profile as profile
     where profile.auth_user_id = '00000000-0000-0000-0000-000000000101'::uuid $$,
  '42501',
  'audit events can only be appended by approved transactions',
  'direct audit insert is rejected for the database owner'
);
select throws_ok(
  $$ update public.audit_event set result = 'denied' $$,
  '42501',
  'audit events are immutable',
  'audit update is always rejected'
);
select throws_ok(
  $$ delete from public.audit_event $$,
  '42501',
  'audit events are immutable',
  'audit delete is always rejected'
);
select throws_ok(
  $$ truncate table public.audit_event $$,
  '42501',
  'audit events are immutable',
  'audit truncate is always rejected'
);
select isnt(
  has_table_privilege('anon', 'public.user_profile', 'SELECT'),
  true,
  'anonymous cannot select base profiles'
);
select isnt(
  has_table_privilege('service_role', 'public.audit_event', 'INSERT'),
  true,
  'service_role cannot insert audit rows directly'
);
select function_privs_are(
  'private',
  'append_audit_event',
  array['uuid', 'uuid', 'text', 'text', 'uuid', 'text', 'jsonb'],
  'palmtrack_transaction_owner',
  array['EXECUTE'],
  'only the transaction owner is explicitly allowed to invoke the audit writer'
);
select function_privs_are(
  'private',
  'recovery_relink_auth_user',
  array['uuid', 'uuid', 'text', 'text'],
  'palmtrack_recovery_executor',
  array['EXECUTE'],
  'only the recovery executor receives the recovery entrypoint'
);
select is(
  has_function_privilege(
    'palmtrack_recovery_executor',
    'private.append_audit_event(uuid,uuid,text,text,uuid,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'recovery executor cannot invoke the audit writer directly'
);
select ok(
  not has_function_privilege('authenticated', 'private.guard_audit_insert()', 'EXECUTE')
    and not has_function_privilege('service_role', 'private.reject_audit_mutation()', 'EXECUTE'),
  'trigger guard functions are not executable by API roles'
);

set local role palmtrack_transaction_owner;
select throws_ok(
  $$ select private.append_audit_event(
       '00000000-0000-0000-0000-000000000201'::uuid,
       '00000000-0000-0000-0000-000000000301'::uuid,
       'workspace.bootstrap',
       'workspace',
       '00000000-0000-0000-0000-000000000201'::uuid,
       'success',
       '{"status":"active"}'::jsonb
     ) $$,
  '23503',
  null,
  'forged actor and workspace pairing is rejected by the composite foreign key'
);
select throws_ok(
  $$ select private.append_audit_event(
       (select workspace_id from public.user_profile where id = '00000000-0000-0000-0000-000000000301'::uuid),
       '00000000-0000-0000-0000-000000000301'::uuid,
       'research.raw_payload',
       'user_profile',
       '00000000-0000-0000-0000-000000000301'::uuid,
       'success',
       '{}'::jsonb
     ) $$,
  '22023',
  null,
  'unknown audit action is rejected'
);
select throws_ok(
  $$ select private.append_audit_event(
       (select workspace_id from public.user_profile where id = '00000000-0000-0000-0000-000000000301'::uuid),
       '00000000-0000-0000-0000-000000000301'::uuid,
       'workspace.bootstrap',
       'workspace',
       '00000000-0000-0000-0000-000000000201'::uuid,
       'success',
       '{"status":"active","token":"unsafe"}'::jsonb
     ) $$,
  '22023',
  null,
  'unknown audit detail key is rejected'
);
select throws_ok(
  $$ select private.append_audit_event(
       (select workspace_id from public.user_profile where id = '00000000-0000-0000-0000-000000000301'::uuid),
       '00000000-0000-0000-0000-000000000301'::uuid,
       'workspace.bootstrap',
       'workspace',
       '00000000-0000-0000-0000-000000000201'::uuid,
       'success',
       '{"status":"inactive"}'::jsonb
     ) $$,
  '22023',
  null,
  'invalid audit detail value is rejected'
);
reset role;

set local role palmtrack_recovery_executor;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000101';
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}';
select lives_ok(
  $$ select private.recovery_relink_auth_user(
       '00000000-0000-0000-0000-000000000301'::uuid,
       '00000000-0000-0000-0000-000000000102'::uuid,
       'synthetic operator-verified recovery',
       'synthetic institutional reference'
     ) $$,
  'verified recovery executor can relink a stable profile'
);
reset role;

select is(
  (
    select auth_user_id
    from public.user_profile
    where id = '00000000-0000-0000-0000-000000000301'::uuid
  ),
  '00000000-0000-0000-0000-000000000102'::uuid,
  'recovery changes only the replaceable Auth UID linkage'
);
select ok(
  exists (
    select 1
    from public.audit_event as event
    join public.user_profile as actor
      on actor.id = event.actor_profile_id
     and actor.workspace_id = event.workspace_id
    where event.action_code = 'identity.auth_user_relinked'
  ),
  'recovery audit actor is non-null and belongs to the event workspace'
);

select * from finish();
rollback;
