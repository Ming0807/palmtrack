# PalmTrack Safety Skeleton implementation plan

Status: **Approved for execution by the user's instruction to continue without waiting**

Scope: first production vertical slice for `FR-01`, `NFR-01`, and the audit foundation of `NFR-03`. This plan does not approve real data, a questionnaire, cloud provisioning, production credentials, or deployment.

## Goal

Turn the verified Next.js prototype repository into a secure local application skeleton with one-workspace identity, five exact roles, deny-by-default authorization, initial PostgreSQL/RLS migrations, append-only audit foundations, and a Thai protected shell. Keep the UI usable without a configured external service by presenting a truthful configuration state rather than a fake authenticated session.

## Locked interfaces

- Roles are exactly `admin`, `research_manager`, `field_collector`, `farmer`, and `evaluator_readonly`.
- `user_profile.id` is a stable UUID; `auth_user_id` is replaceable and references Supabase Auth when configured.
- `workspace.status` and `user_profile.status` are exactly `active | inactive`. Zero active workspace is allowed only before the bootstrap transaction; runtime after bootstrap requires exactly one.
- V1 has one active workspace and no workspace selector. Scoped root records carry `workspace_id`.
- Browser/UI role checks are presentation only. Server authorization and PostgreSQL RLS remain authoritative.
- Audit events are append-only and exclude secret, raw answer, identifying payload, token, and signed URL content.
- Missing environment configuration must never fall back to service-role access or fabricated identity.

## Task 1 — pin local backend tooling and environment contract

Files:

- `package.json`, `package-lock.json`
- `.env.example`
- `supabase/config.toml`
- `src/lib/env/server.ts`, `src/lib/env/server.test.ts`

Install exact compatible versions of the Supabase CLI, `@supabase/ssr`, `@supabase/supabase-js`, and Zod. Define public URL/anon-key and server-only service-role names without values. The environment parser must distinguish `unconfigured`, `configured`, and `invalid`; tests must prove no secret is exposed to client modules or error text.

Verification: RED→GREEN env tests, lint, typecheck, build without a local `.env`, package audit, and no credential-pattern hit.

## Task 2 — implement the authorization kernel test-first

Files:

- `src/modules/identity/domain/roles.ts`
- `src/modules/identity/domain/permissions.ts`
- `src/modules/identity/domain/authorize.ts`
- adjacent unit tests

Create the exact role union, a narrow Safety Skeleton permission set, and deny-by-default `authorize(context, permission)` result values. Cover inactive profile, unknown role input, cross-workspace context, missing session, and every allow/deny cell used by the first shell. Never encode a broad `admin` override.

Verification: table-driven tests name `RLS-01`, `RLS-09`, and `SEC-01` expectations; all unknown permission/role paths deny.

## Task 3 — create the initial ordered database migration

Files:

- `supabase/migrations/202608250001_safety_skeleton.sql`
- `supabase/tests/database/001_safety_skeleton.test.sql`

Create `app_role`, exact `active|inactive` profile/workspace status enums, `workspace`, `user_profile`, and `audit_event` using the accepted data dictionary. A partial unique index enforces at most one active workspace. A recovery-only bootstrap transaction moves the valid setup state from zero to exactly one active workspace; after bootstrap, all allowed workspace operations preserve exactly one. Tests must distinguish the temporary unconfigured zero state from runtime, reject two active workspaces, and confirm no tenant selector exists. Enforce one active V1 profile per auth user, immutable `workspace_id`/stable profile ID, exact-role checks, and UTC timestamps. Add indexed helpers `current_profile_id()`, `current_workspace_id()`, and `current_role()` with fixed `search_path`, minimal grants, and null-safe behavior.

Separate ordinary admin configuration from recovery identity linkage:

- `admin_set_profile_access(profile_id, role, status)` may change only `role` and `active|inactive` status within the current workspace and must audit the before/after values.
- `admin_update_workspace_name(name)` may change only the active workspace display name and must audit it; it cannot deactivate the sole runtime workspace.
- direct client updates to `user_profile.id`, `workspace_id`, and `auth_user_id` are denied for every authenticated role, including `admin`.
- `recovery_relink_auth_user(profile_id, new_auth_user_id, reason, recovery_reference)` is server/recovery-only, has no grant to `anon` or `authenticated`, derives the verified recovery operator context outside client payloads, and audits the relink without storing credentials or token material.

No configuration or recovery RPC grants `admin` mutation access to consent, response, answer, review, farmer, farm, or ledger data.

Enable RLS on every exposed table. Revoke `anon`/`authenticated` access to the `user_profile` base table and expose the current user's fixed-return server RPC containing only stable profile ID, workspace ID, role, status, and `must_change_password`; it must never return `auth_user_id`. RLS still protects the base table as defense in depth, while tests prove disallowed columns and other profiles cannot be selected through the API.

Audit append-only behavior is database-hard. Revoke direct insert/update/delete from client roles and route internal writes through a fixed-`search_path` `SECURITY DEFINER` function owned by a dedicated `NOLOGIN` audit-writer role that is not granted to application, service, or database-owner roles. An always-enabled `BEFORE INSERT` trigger rejects inserts unless execution is inside that writer-owner context; an always-enabled `BEFORE UPDATE OR DELETE` trigger always raises regardless of RLS bypass. The approved writer is callable only from allowlisted transaction functions, and actor/workspace are derived from the authenticated or verified recovery execution context, never accepted from a browser payload.

Verification: local migration reset plus pgTAP proves anonymous/inactive/unknown-role/cross-workspace denies, exact allowlist behavior, zero-before-bootstrap/one-after-bootstrap/two-denied workspace behavior, immutable ID/workspace/auth linkage, admin configuration field allowlists, admin denial on research/ledger/identity relink, fixed current-profile projection with no `auth_user_id` or cross-profile access, and append-only audit. Audit tests attempt forged actor/workspace, direct insert, update, and delete as authenticated users, admin, `service_role`, and database owner; the insert guard and immutable-row trigger must reject direct mutation even when RLS is bypassed, while approved transaction functions still append the expected event. If the local Docker/PostgreSQL prerequisite is unavailable, record the tooling blocker and keep SQL status unverified rather than claiming RLS pass.

## Task 4 — add server-only Supabase adapters

Files:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/browser.ts`
- `src/modules/identity/server/session.ts`
- adjacent unit tests with injected fakes

Create cookie-aware server/browser clients using anon credentials only. Keep service-role construction in a separate server-only administrative adapter that has no import path from routes in this slice. Resolve a session into stable profile/workspace/role context; return explicit `anonymous`, `unconfigured`, `inactive`, or `authorized` states without leaking whether another profile exists.

Verification: session resolver tests cover expired/missing session, missing profile, inactive profile, invalid role, and valid role; client bundle inspection contains no service-role variable name or value.

## Task 5 — build the Thai protected shell

Files:

- `src/app/sign-in/page.tsx`
- `src/app/app/layout.tsx`, `src/app/app/page.tsx`
- `src/modules/identity/ui/*`
- `src/modules/navigation/role-navigation.ts`

Create a minimal premium sign-in/configuration surface and protected application shell that reuses the committed tokens in `DESIGN.md`. Route policy is exact: `/` redirects to `/sign-in`; `/sign-in` is the only public production entry; `/app/*` resolves session/profile on the server and redirects anonymous users or renders a non-enumerating forbidden state; `/prototype/*` remains synthetic-only, is excluded from production navigation, and never becomes an authenticated landing page. Navigation is derived from allowed role destinations but direct routes still require server authorization. When Supabase is unconfigured, show `ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน` and local setup guidance; do not offer a fake successful sign-in.

The session resolver accepts an injected `IdentityGateway` only at the test/module boundary. Unit/integration fixtures cover all five roles without changing application routes. Browser E2E for authenticated roles uses seeded users in Supabase local Auth and real local cookies/RLS; there is no bypass cookie, test-login control, or production-build route that fabricates success. If local Supabase cannot run, anonymous/unconfigured browser tests may pass but the five-role browser suite remains explicitly unverified.

Verification: component/integration tests for all five role navigation sets; browser tests for `/`→`/sign-in`, anonymous `/app/*` redirect, non-enumerating forbidden state, unconfigured state, and—when local Supabase is available—five seeded-role sessions. Also verify keyboard/focus/360px behavior, no dead enabled controls, no prototype link in production navigation, and no fake successful login state.

## Task 6 — record audit-safe observability and evidence

Files:

- `src/lib/observability/safe-event.ts`
- unit tests
- `LOG.md`, `docs/TRACEABILITY_MATRIX.md`, `docs/TEST_PLAN.md`

Define an application-event allowlist that accepts correlation ID, action code, result, UTC time, and stable non-PII entity UUID while rejecting raw payloads and known secret/PII field names. Keep `LOG.md` for sanitized development/tooling incidents only. Update traceability only for tests actually implemented and distinguish TypeScript authorization tests from PostgreSQL RLS evidence.

Verification: sanitizer negative tests, documentation links/banned patterns, and explicit evidence table mapping implemented commands to `FR-01`/`NFR-01`/`NFR-03` without overstating unrun database tests.

## Task 7 — independent security and completion review

Run lint, typecheck, unit, production build, Playwright mobile/desktop, package audit, secret scan, SQL lint, local database/RLS tests when prerequisites exist, and the Impeccable detector for changed UI. Request a fresh Luna xhigh review focused on auth boundary, exact role matrix, server/client secret separation, RLS policy shape, audit safety, and Thai UX.

Completion requires no P0/P1/P2 finding, or a documented unresolved external prerequisite that prevents only the affected evidence. Commit locally on an isolated feature branch; do not push, provision Supabase/Vercel, or create GitHub resources without separate authority.
