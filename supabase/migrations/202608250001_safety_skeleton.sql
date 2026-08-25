begin;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.app_role as enum (
    'admin',
    'research_manager',
    'field_collector',
    'farmer',
    'evaluator_readonly'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
declare
  v_labels text[];
begin
  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
  into v_labels
  from pg_catalog.pg_type as enum_type
  join pg_catalog.pg_namespace as enum_namespace
    on enum_namespace.oid = enum_type.typnamespace
  join pg_catalog.pg_enum as enum_value
    on enum_value.enumtypid = enum_type.oid
  where enum_namespace.nspname = 'public'
    and enum_type.typname = 'app_role';

  if v_labels is distinct from array[
    'admin',
    'research_manager',
    'field_collector',
    'farmer',
    'evaluator_readonly'
  ]::text[] then
    raise exception 'public.app_role does not have the exact required labels';
  end if;
end
$$;

do $$
begin
  create type public.record_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end
$$;

do $$
declare
  v_labels text[];
begin
  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
  into v_labels
  from pg_catalog.pg_type as enum_type
  join pg_catalog.pg_namespace as enum_namespace
    on enum_namespace.oid = enum_type.typnamespace
  join pg_catalog.pg_enum as enum_value
    on enum_value.enumtypid = enum_type.oid
  where enum_namespace.nspname = 'public'
    and enum_type.typname = 'record_status';

  if v_labels is distinct from array['active', 'inactive']::text[] then
    raise exception 'public.record_status does not have the exact required labels';
  end if;
end
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

do $$
declare
  v_role_name text;
  v_membership record;
begin
  foreach v_role_name in array array[
    'palmtrack_audit_writer',
    'palmtrack_transaction_owner',
    'palmtrack_recovery_executor'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_roles where rolname = v_role_name
    ) then
      execute format('create role %I', v_role_name);
    end if;

    execute format(
      'alter role %I with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 0 password null',
      v_role_name
    );
  end loop;

  for v_membership in
    select granted.rolname as granted_role, member.rolname as member_role
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted on granted.oid = membership.roleid
    join pg_catalog.pg_roles as member on member.oid = membership.member
    where granted.rolname = any(array[
      'palmtrack_audit_writer',
      'palmtrack_transaction_owner',
      'palmtrack_recovery_executor'
    ])
       or member.rolname = any(array[
      'palmtrack_audit_writer',
      'palmtrack_transaction_owner',
      'palmtrack_recovery_executor'
    ])
  loop
    execute format(
      'revoke %I from %I',
      v_membership.granted_role,
      v_membership.member_role
    );
  end loop;
end
$$;

create table public.workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status public.record_status not null default 'inactive',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create unique index workspace_one_active_v1_idx
  on public.workspace (status)
  where status = 'active';

create table public.user_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete restrict,
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  role public.app_role not null,
  status public.record_status not null default 'active',
  must_change_password boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint user_profile_id_workspace_unique unique (id, workspace_id)
);

create unique index user_profile_one_active_auth_user_idx
  on public.user_profile (auth_user_id)
  where status = 'active';

create index user_profile_auth_user_lookup_idx
  on public.user_profile (auth_user_id, status, workspace_id);

create table public.audit_event (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete restrict,
  actor_profile_id uuid not null,
  occurred_at timestamptz not null default statement_timestamp(),
  action_code text not null check (action_code ~ '^[a-z][a-z0-9_.]{2,79}$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  entity_id uuid not null,
  result text not null check (result in ('success', 'denied')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  constraint audit_event_actor_workspace_fk
    foreign key (actor_profile_id, workspace_id)
    references public.user_profile (id, workspace_id)
    on delete restrict
);

create index audit_event_workspace_time_idx
  on public.audit_event (workspace_id, occurred_at desc);

create index audit_event_entity_idx
  on public.audit_event (entity_type, entity_id, occurred_at desc);

alter table public.workspace enable row level security;
alter table public.workspace force row level security;
alter table public.user_profile enable row level security;
alter table public.user_profile force row level security;
alter table public.audit_event enable row level security;
alter table public.audit_event force row level security;

revoke all on table public.workspace, public.user_profile, public.audit_event
  from public, anon, authenticated, service_role;

grant insert on table public.audit_event to palmtrack_audit_writer;
grant usage on schema public to palmtrack_audit_writer;
grant usage on schema public, auth, private to palmtrack_transaction_owner;
grant usage on schema extensions to palmtrack_transaction_owner;
grant usage on schema private to palmtrack_recovery_executor;
grant select on table auth.users to palmtrack_transaction_owner;
grant select, insert, update on table public.workspace, public.user_profile
  to palmtrack_transaction_owner;

create policy workspace_internal_transactions
  on public.workspace
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create policy user_profile_internal_transactions
  on public.user_profile
  for all
  to palmtrack_transaction_owner
  using (true)
  with check (true);

create policy audit_event_internal_insert
  on public.audit_event
  for insert
  to palmtrack_audit_writer
  with check (true);

create or replace function private.guard_audit_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user <> 'palmtrack_audit_writer' then
    raise exception using
      errcode = '42501',
      message = 'audit events can only be appended by approved transactions';
  end if;

  return new;
end;
$$;

create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'audit events are immutable';
end;
$$;

revoke all on function private.guard_audit_insert(), private.reject_audit_mutation()
  from public, anon, authenticated, service_role,
    palmtrack_transaction_owner, palmtrack_recovery_executor;

create trigger audit_event_insert_guard
before insert on public.audit_event
for each row execute function private.guard_audit_insert();

create trigger audit_event_immutable_guard
before update or delete on public.audit_event
for each row execute function private.reject_audit_mutation();

create trigger audit_event_truncate_guard
before truncate on public.audit_event
for each statement execute function private.reject_audit_mutation();

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
    else null
  end;

  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'audit details must be an object';
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
  ) then
    raise exception using
      errcode = '22023',
      message = 'audit action or detail keys are not allowlisted';
  end if;

  if case p_action_code
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
    else true
  end then
    raise exception using
      errcode = '22023',
      message = 'audit detail values are invalid';
  end if;

  v_event_id := gen_random_uuid();
  insert into public.audit_event (
    id,
    workspace_id,
    actor_profile_id,
    action_code,
    entity_type,
    entity_id,
    result,
    details
  ) values (
    v_event_id,
    p_workspace_id,
    p_actor_profile_id,
    p_action_code,
    p_entity_type,
    p_entity_id,
    p_result,
    coalesce(p_details, '{}'::jsonb)
  );

  return v_event_id;
end;
$$;

alter function private.append_audit_event(uuid, uuid, text, text, uuid, text, jsonb)
  owner to palmtrack_audit_writer;
revoke all on function private.append_audit_event(uuid, uuid, text, text, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.append_audit_event(uuid, uuid, text, text, uuid, text, jsonb)
  to palmtrack_transaction_owner;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select profile.id
  from public.user_profile as profile
  join public.workspace as active_workspace
    on active_workspace.id = profile.workspace_id
   and active_workspace.status = 'active'
  where profile.auth_user_id = auth.uid()
    and profile.status = 'active'
  limit 1
$$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select profile.workspace_id
  from public.user_profile as profile
  join public.workspace as active_workspace
    on active_workspace.id = profile.workspace_id
   and active_workspace.status = 'active'
  where profile.auth_user_id = auth.uid()
    and profile.status = 'active'
  limit 1
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select profile.role
  from public.user_profile as profile
  join public.workspace as active_workspace
    on active_workspace.id = profile.workspace_id
   and active_workspace.status = 'active'
  where profile.auth_user_id = auth.uid()
    and profile.status = 'active'
  limit 1
$$;

create or replace function public.get_current_profile()
returns table (
  profile_id uuid,
  workspace_id uuid,
  role public.app_role,
  status public.record_status,
  must_change_password boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    profile.id,
    profile.workspace_id,
    profile.role,
    profile.status,
    profile.must_change_password
  from public.user_profile as profile
  join public.workspace as active_workspace
    on active_workspace.id = profile.workspace_id
   and active_workspace.status = 'active'
  where profile.auth_user_id = auth.uid()
  order by (profile.status = 'active') desc, profile.created_at desc, profile.id
  limit 1
$$;

revoke all on function public.current_profile_id(), public.current_workspace_id(),
  public.current_role(), public.get_current_profile()
  from public, anon, authenticated, service_role;
grant execute on function public.current_profile_id(), public.current_workspace_id(),
  public.current_role(), public.get_current_profile()
  to authenticated;
grant execute on function public.current_profile_id(), public.current_workspace_id(),
  public.current_role()
  to palmtrack_transaction_owner;

create or replace function private.bootstrap_workspace(
  p_workspace_name text,
  p_admin_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_workspace_id uuid;
  v_profile_id uuid;
begin
  if exists (select 1 from public.workspace where status = 'active') then
    raise exception using errcode = '23505', message = 'active workspace already exists';
  end if;

  if not exists (select 1 from auth.users where id = p_admin_auth_user_id) then
    raise exception using errcode = '23503', message = 'verified auth user is required';
  end if;

  insert into public.workspace (name, status)
  values (btrim(p_workspace_name), 'active')
  returning id into v_workspace_id;

  insert into public.user_profile (
    auth_user_id,
    workspace_id,
    role,
    status,
    must_change_password
  ) values (
    p_admin_auth_user_id,
    v_workspace_id,
    'admin',
    'active',
    true
  )
  returning id into v_profile_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_profile_id,
    'workspace.bootstrap',
    'workspace',
    v_workspace_id,
    'success',
    jsonb_build_object('status', 'active')
  );

  return v_workspace_id;
end;
$$;

alter function private.bootstrap_workspace(text, uuid)
  owner to palmtrack_transaction_owner;
revoke all on function private.bootstrap_workspace(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.bootstrap_workspace(text, uuid)
  to palmtrack_recovery_executor;

create or replace function public.admin_set_profile_access(
  p_profile_id uuid,
  p_role public.app_role,
  p_status public.record_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_before public.user_profile%rowtype;
begin
  if public.current_role() is distinct from 'admin'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  select * into v_before
  from public.user_profile
  where id = p_profile_id
    and workspace_id = v_workspace_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  update public.user_profile
  set role = p_role,
      status = p_status,
      updated_at = statement_timestamp()
  where id = p_profile_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_actor_profile_id,
    'identity.profile_access_updated',
    'user_profile',
    p_profile_id,
    'success',
    jsonb_build_object(
      'before_role', v_before.role,
      'after_role', p_role,
      'before_status', v_before.status,
      'after_status', p_status
    )
  );
end;
$$;

alter function public.admin_set_profile_access(uuid, public.app_role, public.record_status)
  owner to palmtrack_transaction_owner;
revoke all on function public.admin_set_profile_access(uuid, public.app_role, public.record_status)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_set_profile_access(uuid, public.app_role, public.record_status)
  to authenticated;

create or replace function public.admin_update_workspace_name(p_name text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_before_name text;
  v_clean_name text := btrim(p_name);
begin
  if public.current_role() is distinct from 'admin'::public.app_role then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if char_length(v_clean_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'workspace name is invalid';
  end if;

  select name into v_before_name
  from public.workspace
  where id = v_workspace_id
    and status = 'active'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  update public.workspace
  set name = v_clean_name,
      updated_at = statement_timestamp()
  where id = v_workspace_id;

  perform private.append_audit_event(
    v_workspace_id,
    v_actor_profile_id,
    'workspace.name_updated',
    'workspace',
    v_workspace_id,
    'success',
    jsonb_build_object('before_name', v_before_name, 'after_name', v_clean_name)
  );
end;
$$;

alter function public.admin_update_workspace_name(text)
  owner to palmtrack_transaction_owner;
revoke all on function public.admin_update_workspace_name(text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_update_workspace_name(text)
  to authenticated;

create or replace function private.recovery_relink_auth_user(
  p_profile_id uuid,
  p_new_auth_user_id uuid,
  p_reason text,
  p_recovery_reference text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private, extensions
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_workspace_id uuid := public.current_workspace_id();
  v_target_workspace_id uuid;
begin
  if public.current_role() is distinct from 'admin'::public.app_role then
    raise exception using errcode = '42501', message = 'verified recovery operator is required';
  end if;

  if char_length(btrim(p_reason)) < 3 or char_length(btrim(p_recovery_reference)) < 3 then
    raise exception using errcode = '22023', message = 'recovery evidence is required';
  end if;

  if not exists (select 1 from auth.users where id = p_new_auth_user_id) then
    raise exception using errcode = '23503', message = 'verified auth user is required';
  end if;

  select workspace_id into v_target_workspace_id
  from public.user_profile
  where id = p_profile_id
    and workspace_id = v_workspace_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'operation is not permitted';
  end if;

  if exists (
    select 1
    from public.user_profile
    where auth_user_id = p_new_auth_user_id
      and id <> p_profile_id
      and status = 'active'
  ) then
    raise exception using errcode = '23505', message = 'auth identity is already linked';
  end if;

  update public.user_profile
  set auth_user_id = p_new_auth_user_id,
      must_change_password = true,
      updated_at = statement_timestamp()
  where id = p_profile_id;

  perform private.append_audit_event(
    v_target_workspace_id,
    v_actor_profile_id,
    'identity.auth_user_relinked',
    'user_profile',
    p_profile_id,
    'success',
    jsonb_build_object(
      'reason_digest', encode(extensions.digest(convert_to(btrim(p_reason), 'UTF8'), 'sha256'), 'hex'),
      'recovery_reference_digest', encode(extensions.digest(convert_to(btrim(p_recovery_reference), 'UTF8'), 'sha256'), 'hex')
    )
  );
end;
$$;

alter function private.recovery_relink_auth_user(uuid, uuid, text, text)
  owner to palmtrack_transaction_owner;
revoke all on function private.recovery_relink_auth_user(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.recovery_relink_auth_user(uuid, uuid, text, text)
  to palmtrack_recovery_executor;

comment on function private.recovery_relink_auth_user(uuid, uuid, text, text) is
  'Out-of-band database recovery only: a controlled database operator explicitly SET ROLEs to the NOLOGIN recovery executor after establishing verified active-admin JWT context. It is never exposed to service_role or API roles.';

comment on function private.bootstrap_workspace(text, uuid) is
  'Out-of-band database bootstrap only. The verified Auth user becomes the first admin, and that newly provisioned stable profile is the actor for the atomic bootstrap audit event.';

commit;
