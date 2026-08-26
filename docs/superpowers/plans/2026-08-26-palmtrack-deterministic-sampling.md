# PalmTrack Deterministic Sampling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an audited, RLS-protected, reproducible sampling workflow from an accepted population snapshot through draft, lock and activation.

**Architecture:** A dependency-free TypeScript domain engine produces portable deterministic evidence. Server services recompute trusted evidence and call narrow PostgreSQL RPCs; database constraints, triggers and RLS enforce lifecycle and immutability. A Thai server-rendered route delegates interactive preview and transition controls to a focused client component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Zod 4, Supabase PostgreSQL/RLS, Vitest, Testing Library, pgTAP, Playwright.

## Global Constraints

- Algorithm identifier is exactly `sha256-mulberry32-fy-v1`.
- Formula is `ceil(N / (1 + N e^2))`; `N=121,e=0.05` must yield `93`.
- Status is exactly `draft|locked|active|superseded|cancelled`.
- Only `research_manager` mutates runs; safe reads are available to `admin`, `research_manager`, and `evaluator_readonly`.
- Locked, active, superseded and cancelled evidence is immutable; activation supersedes the prior active run atomically.
- No new dependency, real farmer data, credential, or hosted resource is introduced.
- UI is Thai, responsive at 360 px, keyboard accessible, and never treats the browser as an authorization boundary.
- Run focused tests per task; run the full suite only after Task 7 or after a later high-risk auth/database change.

---

### Task 1: Deterministic sampling engine

**Files:**
- Create: `src/modules/research/sampling/domain/deterministic-sampling.ts`
- Create: `src/modules/research/sampling/domain/deterministic-sampling.test.ts`

**Interfaces:**
- Produces: `calculateSampleSize(N: number, marginOfError: number)`, `allocateLargestRemainder(strata, targetN)`, `buildSamplingEvidence(input): Promise<SamplingEvidence>`, `replaySamplingEvidence(input, evidence): Promise<boolean>`.
- `SamplingEvidence` includes formula values, seed normalization/digest/u32, candidate hash, allocation rows, swap trace, shuffled member IDs and ordered selected members.

- [ ] Write failing Vitest cases for invalid bounds, Yamane 121/0.05, capacity/tie-break allocation, NFC-equivalent seeds and a reviewed complete algorithm vector.
- [ ] Run `npm test -- deterministic-sampling.test.ts`; expect failures because the module is absent.
- [ ] Implement bytewise UTF-8 comparison, uint32BE candidate framing, Web Crypto SHA-256, Mulberry32/Fisher–Yates and quota-aware selection exactly as `RESEARCH_PROTOCOL.md`.
- [ ] Run `npm test -- deterministic-sampling.test.ts`; expect all sampling-domain tests to pass.
- [ ] Commit `test: lock deterministic sampling vector` and `feat: implement deterministic sampling engine` as the red and green checkpoints when practical.

### Task 2: Sampling persistence and lifecycle boundary

**Files:**
- Create: `supabase/migrations/202608260003_deterministic_sampling.sql`
- Create: `supabase/rollback/202608260003_deterministic_sampling_rollback.sql`
- Create: `supabase/tests/database/003_deterministic_sampling.test.sql`
- Modify: `LOG.md` only if local migration reveals a failure.

**Interfaces:**
- Produces RPCs `create_sampling_draft(uuid,text,numeric,text,text,bigint,text,jsonb,jsonb,uuid)`, `lock_sampling_run(uuid,timestamptz)`, `activate_sampling_run(uuid)`, `cancel_sampling_run(uuid,text)`, `list_sampling_runs()`, `get_sampling_population_candidates(uuid)` for accepted-snapshot replay and `get_sampling_candidates(uuid)` for active-run projections.
- RPC results expose safe run/allocation/member projections and never contact data.

- [ ] Write pgTAP failures for exact role matrix, accepted-only input, cross-workspace denial, evidence totals/membership, idempotency, immutable tables, transition legality, cancellation reason, partial active uniqueness and atomic supersession.
- [ ] Run `npm run test:db`; expect the new suite to fail on missing sampling objects.
- [ ] Add enum/tables/checks/FKs/indexes, private immutable guards, allowlisted audit details, RLS/grants and transaction-owner security-definer RPCs. Do not alter Supabase-managed roles.
- [ ] Add rollback in exact reverse dependency order with explicit object names.
- [ ] Run `npm run test:db` and `npm run lint:db`; expect all database assertions and lint to pass.
- [ ] Commit `feat: persist deterministic sampling lifecycle`.

### Task 3: Trusted server orchestration

**Files:**
- Create: `src/modules/research/sampling/server/sampling-gateway.ts`
- Create: `src/modules/research/sampling/server/sampling-gateway.test.ts`
- Create: `src/modules/research/sampling/server/sampling-service.ts`
- Create: `src/modules/research/sampling/server/sampling-service.test.ts`

**Interfaces:**
- Gateway produces `getCandidates`, `createDraft`, `listRuns`, `lock`, `activate`, and `cancel` with `SamplingGatewayError` codes `CONFLICT|REPLAY_MISMATCH|UNAVAILABLE`.
- Service produces discriminated states `ready|invalid|forbidden|conflict|replay_mismatch|service_unavailable` and recomputes evidence before every create/lock operation.

- [ ] Write failing gateway mapping and service authorization/validation/replay tests using injected sessions and gateways.
- [ ] Run `npm test -- sampling-gateway.test.ts sampling-service.test.ts`; expect missing-module failures.
- [ ] Implement snake/camel RPC mapping and Zod validation for UUID, accepted snapshot, `0<e<1`, non-empty seed capped at 200 Unicode code units, and cancellation reason capped at 500.
- [ ] Ensure only research manager mutation reaches the gateway and no raw Supabase error crosses the boundary.
- [ ] Run the two focused test files; expect pass.
- [ ] Commit `feat: orchestrate trusted sampling workflow`.

### Task 4: Server actions and route authorization

**Files:**
- Create: `src/modules/research/sampling/server/actions.ts`
- Create: `src/modules/research/sampling/server/actions.test.ts`
- Create: `src/app/app/research/sampling/page.tsx`
- Modify: `src/app/app/research/page.tsx`
- Modify: `src/modules/navigation/role-navigation.ts`
- Modify: `src/modules/navigation/role-navigation.test.ts`

**Interfaces:**
- Produces server actions `previewSamplingAction`, `createSamplingDraftAction`, `lockSamplingRunAction`, `activateSamplingRunAction`, `cancelSamplingRunAction` and invalidates `/app/research/sampling` after successful mutation.

- [ ] Write failing tests for form parsing, anonymous redirect, exact navigation visibility and safe action states.
- [ ] Read the installed Next.js App Router/server-action guides under `node_modules/next/dist/docs/` before implementing.
- [ ] Implement actions with verified session resolution, injected service seams in tests and `revalidatePath` only after success.
- [ ] Implement the protected server page and research landing link without fake success states.
- [ ] Run focused action/navigation tests and `npm run typecheck`; expect pass.
- [ ] Commit `feat: expose protected sampling route`.

### Task 5: Thai minimal-premium sampling experience

**Files:**
- Create: `src/modules/research/sampling/ui/sampling-workbench.tsx`
- Create: `src/modules/research/sampling/ui/sampling-workbench.test.tsx`
- Create: `src/modules/research/sampling/ui/sampling-workbench.module.css`

**Interfaces:**
- Consumes Task 4 server actions and Task 3 safe run projections.
- Produces one responsive workbench with snapshot selection, e/seed input, evidence table, immutable receipt and lifecycle confirmations.

- [ ] Write failing component tests for preview, validation copy, formula/allocation evidence, loading locks, draft→lock→activate controls, destructive confirmation and status labels independent of color.
- [ ] Run `npm test -- sampling-workbench.test.tsx`; expect missing component failure.
- [ ] Implement semantic form/table/details markup, visible focus, live status, 44 px targets, 360 px stacking and restrained motion honoring reduced-motion.
- [ ] Keep full digests accessible by copy/text while visually shortening them; expose no member contact or raw DB error.
- [ ] Run the focused component test and a focused Playwright screenshot/check at desktop and 360 px.
- [ ] Commit `feat: add Thai sampling workbench`.

### Task 6: Authenticated acceptance path and evidence docs

**Files:**
- Create: `e2e/sampling.spec.ts`
- Modify: `e2e/support/local-supabase.ts`
- Modify: `docs/TRACEABILITY_MATRIX.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/INDEX.md`
- Modify: `LOG.md` when a real failure is diagnosed.

**Interfaces:**
- Adds a synthetic 121-member, at-least-three-strata fixture and manager workflow with seed `palmtrack-acceptance-seed-v1`.

- [ ] Add one authenticated local E2E that imports/accepts the synthetic population, previews 93, creates, locks and activates a run, reloads the receipt and verifies forbidden-role behavior.
- [ ] Run only `npx playwright test e2e/sampling.spec.ts --config playwright.local.config.ts`; expect pass against local Supabase.
- [ ] Update requirement evidence without claiming hosted migration or unexecuted tests.
- [ ] Scan changed docs for inconsistent statuses, formula, permissions, secrets and incomplete language.
- [ ] Commit `test: verify sampling workflow end to end`.

### Task 7: Major-milestone full verification and push

**Files:**
- Modify: `LOG.md` only for failures found and their verified resolution.

**Interfaces:**
- Produces the final local verification evidence and a clean pushed `main` branch.

- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` once.
- [ ] Run `npm run lint:db`, `npm run test:db`, and `npm run test:e2e:local` once with Docker/local Supabase.
- [ ] Run `git diff --check`, secret-pattern scan, internal Markdown link check and `git status --short`.
- [ ] Fix failures with the narrowest relevant test; repeat only the failed command unless the fix touches a high-risk shared auth/database boundary, in which case repeat the affected full group.
- [ ] Commit any final evidence/log correction and push `main` to the configured GitHub remote.
- [ ] Report the hosted migration filename separately; do not execute it on hosted Supabase without explicit user authorization.
