# PalmTrack Deterministic Sampling Design

**Status:** Approved for implementation by the user's 2026-08-26 continuation instruction  
**Scope:** Increment 2 sampling slice after an accepted population import  
**Authoritative requirements:** `PRODUCT_REQUIREMENTS.md` FR-03/NFR-04, `RESEARCH_PROTOCOL.md`, `DATA_MODEL.md`, `SECURITY_PDPA.md`, `TEST_PLAN.md`

## Outcome

ผู้จัดการงานวิจัยสร้าง sampling run จาก accepted population snapshot, เห็นผล Yamane และ proportional largest-remainder allocation, สุ่มสมาชิกซ้ำได้แบบ byte-for-byte ด้วย `sha256-mulberry32-fy-v1`, lock หลักฐานที่ replay ผ่าน และ activate run ได้โดยทำให้ active run เดิมเป็น superseded ใน transaction เดียว UI ภาษาไทยต้องแสดงหลักฐานสำคัญโดยไม่เปิดเผย PII

## Chosen architecture

ใช้ pure TypeScript domain engine เป็น reference implementation สำหรับสูตร, canonical byte stream, SHA-256, Mulberry32, Fisher–Yates, allocation และ replay โดยไม่มี dependency เพิ่ม PostgreSQL รับผลที่คำนวณแล้วแต่ตรวจ input, candidate membership, totals, digests, lifecycle และสิทธิ์ซ้ำก่อน persist ผ่าน security-definer RPC ตารางและ trigger เป็นแนวป้องกันสุดท้ายสำหรับ immutability/RLS

แนวทางนี้ถูกเลือกเหนือ SQL-only เพราะสร้าง test vector ที่ replay ใน browser/server ได้ง่ายกว่า และถูกเลือกเหนือ client-only เพราะ client ไม่ใช่ trust boundary

## Domain boundaries

- `sampling/domain`: deterministic functions and typed evidence; no Supabase or React dependency.
- `sampling/server`: authorization, accepted-population loading, orchestration, RPC adapter, safe error mapping.
- `sampling/ui`: Thai preview/receipt/lifecycle controls; consumes server actions only.
- PostgreSQL migration: enum, run/allocation/member tables, constraints, transition RPCs, audit allowlist, RLS and immutable guards.

## Data contract

`sampling_run` stores workspace and population-import IDs, monotonic workspace version, `N`, decimal `margin_of_error`, unrounded result, `target_n`, formula and algorithm versions, raw/normalized seed, lowercase SHA-256 digest, unsigned seed value represented safely as bigint, candidate-set hash, status and actor/timestamps. A draft owns allocation rows and globally ordered sample-member rows. Unique constraints cover run/member, run/order and run/stratum; a partial unique index permits at most one active run per workspace.

Only an `accepted` population import can create a draft. Eligible members are ordered by UTF-8 bytewise `farmer_code`. Candidate evidence contains identifiers already present in the synthetic snapshot; UI projections expose counts/codes but no contact data.

## Commands and lifecycle

1. `previewSampling` loads an accepted snapshot and computes evidence without persistence.
2. `createSamplingDraft` recomputes evidence on the server and calls one atomic RPC. An idempotency key prevents duplicate drafts.
3. `lockSamplingRun` reloads immutable candidates, replays the algorithm, compares all persisted evidence and changes `draft → locked` only on an exact match.
4. `activateSamplingRun` changes `locked → active` and the prior `active → superseded` in one transaction.
5. `cancelSamplingRun` permits only `draft|locked → cancelled` with a trimmed reason. Cancelled and superseded runs are immutable.

Direct table mutation is unavailable to application roles. Only `research_manager` may create, lock, activate or cancel. `admin` and `evaluator_readonly` may receive safe read projections; field collectors and farmers cannot access this module.

## Deterministic algorithm

The implementation follows `RESEARCH_PROTOCOL.md` literally: `ceil(N/(1+Ne²))`; largest remainder with UTF-8 bytewise stratum tie-break; seed NFC normalization; SHA-256; first four digest bytes as unsigned big-endian state; full-array Mulberry32 Fisher–Yates; then quota-aware selection in shuffled order. The engine returns enough evidence for tests to assert normalized UTF-8 hex, digest, seed, candidate byte stream/hash, every `(i,j)`, shuffled order, allocations and final result.

Numerical input is constrained to integer `N > 0`, finite `0 < e < 1`, and `target_n <= N`. Persistence uses exact decimal input text for `e`; the mandated fixture `N=121,e=0.05` produces approximately `92.8983` and target `93`.

## UI and states

Route `/app/research/sampling` uses the existing minimal-premium shell. The primary path is accepted snapshot → seed and margin form → evidence preview → create draft → lock confirmation → activate confirmation. It shows formula values, allocation columns `N_h/quota/floor/remainder/final`, algorithm label, shortened digests with copy affordance, run version/status and explicit immutable warnings.

Empty, forbidden, invalid input, stale/conflict, replay mismatch and unavailable-service states use Thai copy. Controls disable only while submitting or when lifecycle rules forbid the action. Layout is usable at 360 px, keyboard focus remains visible, and status is not conveyed by color alone.

## Error and audit behavior

Client-facing failures are non-enumerating categories: invalid input, forbidden, conflict/stale state, replay mismatch, or service unavailable. Raw database errors, seed text, member rows and credentials never enter logs. `LOG.md` records only development failures and remediations without secrets.

Successful draft, lock, activation/supersession and cancellation append allowlisted audit events with actor, UTC time, entity, before/after status, algorithm/digest/count metadata, and cancellation reason digest rather than raw reason. Denied direct writes remain denied by grants/RLS.

## Verification strategy

Focused tests run per change: domain unit vectors, service/gateway tests, pgTAP transition/RLS negatives and component interaction tests. A local authenticated E2E covers the primary manager path. Full lint, typecheck, unit, database lint/pgTAP, build and local E2E run once after the complete sampling milestone, with an extra full run only if a high-risk migration or auth boundary changes after that result.

Acceptance requires exact replay, allocation sum equal to target, the 121/0.05 result of 93, immutable locked evidence, one active run at most, atomic supersession, role isolation, complete text, no secrets and updated traceability/roadmap evidence.
