# Task 2 report — deterministic sampling persistence and lifecycle

Status: `DONE_WITH_CONCERNS`

## Scope delivered

- Migration: `supabase/migrations/202608260003_deterministic_sampling.sql`
- Rollback: `supabase/rollback/202608260003_deterministic_sampling_rollback.sql`
- pgTAP: `supabase/tests/database/003_deterministic_sampling.test.sql`
- Sanitized development ledger entry: `LOG.md` (`DEV-20260826-049`)

The migration adds `sampling_run_status`, workspace-scoped `sampling_run`, `sampling_allocation`, and `sample_member` persistence; immutable guards; forced RLS; exact transaction-owner RPC boundaries; safe run/allocation/candidate projections; accepted-population gating; Yamane target validation; NFC seed/digest/UTF-8 candidate hash validation; allocation totals/formula/membership checks; selected-member evidence checks; idempotency; cancellation reason digests; and atomic active supersession.

The existing `private.append_audit_event` branches for workspace, identity, and population actions were preserved and sampling lifecycle branches were added. No Supabase-managed role was altered.

## TDD evidence

1. RED test was written before the migration.
2. Command: `npm run test:db`
   - Result: exit `1`.
   - Evidence: new suite reported missing `sampling_run_status`, sampling tables, and six RPCs; existing suites passed.
3. GREEN command: `npm run test:db`
   - Result: exit `0`; `Files=3, Tests=163`; all tests successful.
4. Database lint: `npm run lint:db`
   - Result: exit `0`; `No schema errors found` and `{"results":[],"message":"db lint"}`.

## Rollback evidence

Command:

```powershell
Get-Content supabase/rollback/202608260003_deterministic_sampling_rollback.sql |
  docker exec -i supabase_db_palmtrack psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Result: exit `0`; explicit drops completed in reverse dependency order, the pre-task audit function was restored, and catalog verification returned no sampling type/table/constraint objects. A clean local reset reapplied the migration before the final 163-assertion run.

## Commit

- `dbb2f74` — `feat: persist deterministic sampling lifecycle`

## Self-review

- Role matrix: only `research_manager` mutates; `admin`, `research_manager`, and `evaluator_readonly` receive safe reads; collector/farmer mutation/read attempts are denied.
- Scope: population, run, allocation, member, actor, and all child references use workspace-aware composite foreign keys; cross-workspace fixtures are denied.
- Integrity: active partial uniqueness, monotonic workspace version, accepted-only input, target/evidence totals, largest-remainder formula, candidate/member membership, selection order, and idempotency are database-checked.
- Privacy: projections contain no contact fields; cancellation stores only a SHA-256 reason digest; no real data, credentials, tokens, provider keys, or production URLs were added.
- Lifecycle: `draft → locked → active`, atomic prior `active → superseded`, and `draft|locked → cancelled`; locked/evidence tables reject direct mutation.
- Verification: `git diff --cached --check`, local reset, pgTAP, DB lint, and rollback rehearsal completed.

## Concern

`lock_sampling_run` validates persisted evidence structurally and freezes it; it does not implement the Mulberry32/Fisher–Yates replay itself. The approved architecture places deterministic replay in the Task 1 TypeScript engine and trusted server orchestration (Task 3), with PostgreSQL enforcing persistence/lifecycle invariants. Task 3 must therefore recompute and compare the full vector before invoking this lock RPC; this DB boundary alone must not be treated as proof of algorithm replay.
