# Test plan

## Strategy and evidence

ใช้ test pyramid ที่เน้น unit/invariant และ RLS ก่อน integration/E2E ทุก test ใช้ stable ID ต่อไปนี้ในชื่อหรือ metadata Evidence run เก็บ commit/migration version, synthetic fixture version, UTC start/end, environment, pass/fail, sanitized logs และ checksum ของ report ห้าม snapshot PII, token หรือ signed URL

### Current Safety Skeleton execution boundary — 2026-08-25

- TypeScript unit/component tests cover environment states, exact roles/permissions, session resolution, fixed-profile RPC adapter, credential parsing, role navigation, identity UI states และ safe application-event projection
- ESLint, TypeScript และ Next.js production build run without `.env`; the built client must not contain the server-only credential name or a credential value
- Playwright verifies `/`→`/sign-in`, truthful unconfigured `/sign-in` and `/app`, no production navigation to `/prototype`, axe serious/critical และ horizontal overflow on 360px/desktop
- `supabase/tests/database/001_safety_skeleton.test.sql` defines 55 assertions for role hardening, exact operator memberships, bootstrap, grants/RLS catalog state, Auth helper isolation, projection, cross-workspace deny, recovery boundary, audit allowlists และ database-hard mutation guards สถานะคือ **passed local + hosted** บน PostgreSQL 17 เมื่อ 2026-08-25; ผลนี้นับเป็น database/RLS evidence แต่ยังไม่แทน E2E-01 five-role authenticated browser sessions

### Current population-import execution boundary — 2026-08-25

- Domain/server/component suites cover strict UTF-8 CSV parsing, canonical SHA-256, exact roles, safe provider-error projection, RPC mapping, sanitized error download, immutable receipt และ Thai timestamp
- `supabase/tests/database/002_population_import.test.sql` ร่วมกับ Safety Skeleton ผ่าน **98/98 local pgTAP assertions**; schema lint ผ่าน และ compensating rollback ถูก rehearse บน disposable local database ก่อน reset/reapply สำเร็จ
- Authenticated local Playwright ผ่าน admin/research_manager positive flows, collector/farmer/evaluator negative route checks, invalid no-write, idempotent double-submit, offline blocking, keyboard focus, axe serious/critical และ 360px overflow พร้อม [mobile/desktop evidence](assets/population-import/README.md)
- Evidence นี้ใช้ synthetic fixture 3 แถวสำหรับ tracer bullet เท่านั้น ไม่แทน FX-BASE 121-member sampling acceptance และ migration `202608250002` ยังไม่ผ่าน hosted run

### Current Farm Core + Cash Ledger execution boundary — 2026-08-26

- Migration `202608260005` มี pgTAP สำหรับ schema/grant/RPC ownership, cross-farmer/non-farmer deny, canonical formulas, active-only report, plot-area invariant, PII-safe audit, soft/hard delete และ fixture cash result `9,000.25`
- Rollback ถูก execute จริงบนฐาน local สะอาด แล้ว suite ก่อนหน้า 001–003 ผ่าน 231 assertions หลัง restore shared `private.append_audit_event`
- TypeScript regression ครอบคลุม canonical decimal string ที่ Supabase gateway ทั้ง input/output และ route query failure ต้อง render error state ไม่ใช่ empty state
- Scope evidence นี้รับเฉพาะ farmer-owned farm/plot, expense, sale และ cash report; ไม่ปิด acceptance ของ activity, harvest, collector baseline, hosted migration, restore/retention หรือ real-data readiness

## Acceptance fixtures

`FX-BASE` เป็นข้อมูลสังเคราะห์: workspace `ws-synthetic`; user อย่างละหนึ่งต่อห้าบทบาทและ second collector/farmer สำหรับ cross-owner; population 121 member ที่ใช้ `farmer_code` `SYN-001` ถึง `SYN-121` กระจายในอย่างน้อย 3 strata; `e=0.05`; recorded seed `palmtrack-acceptance-seed-v1`; approved synthetic questionnaire metadata ที่ใช้ question code/type/options แต่ไม่มีคำถามวิจัยจริง; assignment ที่ present notice แล้วมี granted consent จับคู่ response `draft`, `submitted`, `returned`, `verified` อย่างละกรณี และ declined consent ที่ไม่มี baseline/response; withdrawn case เริ่มจาก consent granted แล้ว transition ทั้ง current consent และ response เป็น `withdrawn` จึง **ไม่ถือว่า current consent granted**; verified-correction chain ที่เก็บ prior snapshot; farmer สองราย/farm/plot; active/deleted expense และ sale; private attachments คนละ owner

Deterministic test-vector artifact ของ fixture ต้องผ่าน review และบันทึก seed text สองรูปที่ NFC-equivalent, normalized UTF-8 hex, SHA-256 digest hex/`seed_u32`, canonical ordered candidate byte stream/hash, initial order, `(i,j)` ทุก iteration, shuffled order, allocation และ final ordered results ตาม `sha256-mulberry32-fy-v1` เอกสารนี้ไม่กำหนด field data เพิ่มเติม

ชุด finance คาดหวังในช่วงเดียว: active sales net 10,000.00 + 2,500.50, deleted sale 999.00, active expenses 3,000.25 + 500.00, deleted expense 100.00 ดังนั้น cash profit = **9,000.25** Deleted rows ไม่ถูกนับ

## Unit tests

| ID | Assertion |
|---|---|
| UNIT-01 | Yamane `N=121,e=0.05` gives unrounded ≈92.8983 and ceil 93; boundary/invalid N/e rejected |
| UNIT-02 | largest remainder sums exactly 93, honors floors/capacity, deterministic bytewise stratum tie-break |
| UNIT-03 | question code/value type accepts exactly one compatible typed value and rejects changed-meaning code reuse |
| UNIT-04 | every money field accepts `decimal(14,2)` only and quantity/weight/area accepts `decimal(14,3)` only; overflow/extra precision/negative invalid value rejected |
| UNIT-05 | `unit_price/gross_amount/deductions/net_amount` are `decimal(14,2)`; gross rounds `quantity × unit_price` to 2, net subtracts deductions, inconsistent client amount rejected/recomputed server-side |
| UNIT-06 | period profit uses active sale net minus active expense and fixture result equals 9,000.25 |
| UNIT-07 | Gregorian/UTC persistence formats to Thai พ.ศ./Asia-Bangkok and round-trips DST-independent Bangkok time |
| UNIT-08 | `sha256-mulberry32-fy-v1` test vector proves NFC→UTF-8→SHA-256→big-endian seed, Mulberry32 outputs, Fisher–Yates `(i,j)`, candidate hash and final order match across implementations |
| UNIT-09 | dashboard model keeps money as canonical decimal strings, filters research support by role, does not call research gateways for farmer/collector, and renders truthful loading/not-enabled states without fabricated production values |

## RLS and authorization tests

| ID | Assertion |
|---|---|
| RLS-01 | anonymous/inactive/unknown role denied; each valid role receives only allowed projection/action |
| RLS-02 | collector cannot read/update other collector assignment or change collector/workspace; manager reassign allowed with audit path |
| RLS-03 | baseline/response/answer write before notice+granted consent, after declined consent, or after withdrawal is denied; withdrawal from draft/submitted/returned/verified succeeds only for assigned collector and is terminal |
| RLS-04 | manager can do `submitted→returned\|verified` and `verified→returned` correction initiation through audited RPC but cannot edit answer; assigned collector content mutation is limited to granted/valid `draft`, while returned permits only status-only resume; admin/direct revision mutation denied |
| RLS-05 | farmer can mutate own profile/farm/ledger; farmer A cannot select/write farmer B; collector baseline allowed only for own assignment with granted consent/valid assignment in `draft`; resume from returned cannot mutate baseline; admin/manager ledger writes and cross-workspace FK denied |
| RLS-06 | admin/manager full-PII export succeeds only with purpose/audit; collector/farmer/evaluator requests and altered flags are denied |
| RLS-07 | evaluator can select approved anonymized view but base table, mutation, file and PII projection denied |
| RLS-08 | authorized manager research-purpose and collector/farmer own-purpose list/read/download follow object policy; collector own-assignment delete before submit and farmer own-purpose delete succeed with reason/audit; wrong-owner/purpose/path and unauthorized delete denied even when object UUID/path is known |
| RLS-09 | exact role allowlist passes every privileged path: admin workspace/reference config/audit/import/PII export only; manager import/sampling/assignment/status-only review/analysis only; collector notice/consent, status-only returned resume and assigned response/baseline content in `draft` only; farmer own profile/ledger only; evaluator aggregate read only |
| RLS-10 | returned response rejects answer/farmer/farm baseline mutation and rejects combined `returned→draft`+content payload atomically; assigned collector with granted consent/valid assignment may change only status `returned→draft` |

## Integration tests

| ID | Assertion |
|---|---|
| INT-01 | successful population import/accept works independently for both admin and research_manager; duplicate/invalid strata fails atomically and accepted snapshot digest/count is immutable |
| INT-02 | sampling `draft→locked→active`, activation superseding prior active, and draft/locked cancellation follow exact lifecycle; lock freezes evidence, exactly one active/workspace holds after sampling starts, cancelled is unselectable, database replay independently matches ordered membership/order/hash, and every semantic transition audits |
| INT-03 | assignment/reassignment updates current assignment and appends AUD-05 actor/time/action/entity/before-after and required reassign/cancel reason atomically |
| INT-04 | assignment→notice→granted/declined ordering holds; decline stores minimal audit and creates no baseline/response; collector-only withdrawal from draft/submitted/returned/verified is terminal/immediately excluded; unauthorized transitions fail |
| INT-05 | collector edits content only in granted/valid `draft`; idempotent `draft→submitted` revalidates auth/assignment/consent/version; returned/submitted/verified content mutation denied |
| INT-06 | manager-only `submitted→returned(reason)\|verified` and `verified→returned(correction reason)` work without answer edit; collector status-only resumes, separately edits/resubmits, manager re-verifies; each action/entity has actor/time, status+answer before/after and required reason, prior snapshot persists; invalid paths fail |
| INT-07 | farmer own farmer→farm→plot and collector assigned baseline only after granted consent/valid assignment in `draft` succeed; returned resume cannot alter baseline and pre-consent/declined/submitted/admin/manager/cross-owner writes fail; attribution/FK/workspace integrity hold |
| INT-08 | activity/expense transaction validates ownership/date/precision and active report projection |
| INT-09 | sale requires `farm_id`, optional `plot_id` and optional single `harvest_id` belong to same farm; no-harvest sale succeeds; formula/decimal precision and audited soft-delete update report without hard delete |
| INT-10 | upload→private object→metadata/checksum→authorized list/read/download/delete succeeds; every access audits object ID/action, delete requires reason/soft-deletes metadata/applies retention action; cross-owner/orphan/wrong-type handling is safe |
| INT-11 | positive two-operation returned flow: first authorized RPC changes only `status returned→draft` with identical answer/baseline digests; after commit, second operation edits content in draft, then a later operation submits |

## End-to-end tests

| ID | User-visible journey |
|---|---|
| E2E-01 | sign in each role, see correct Thai navigation, direct forbidden URL gives non-enumerating state |
| E2E-02 | manager imports fixture, reviews row errors, accepts corrected snapshot |
| E2E-03 | manager previews formula/allocation, locks sample 93, activates it, supersedes prior run and views exact algorithm/candidate/result evidence |
| E2E-04 | manager assigns/reassigns; collector sees only “งานของฉัน” |
| E2E-05 | collector must present notice before consent; declined stores minimal receipt/no baseline-response; granted unlocks collection; withdrawal works from each exact source `draft\|submitted\|returned\|verified`, changes current consent/response to withdrawn, retains minimal audit and becomes terminal/excluded; admin/manager controls denied |
| E2E-06 | collector submits; manager returns with reason; returned screen is read-only and combined edit is denied; collector sends resume-only operation, receives draft, then edits/resubmits separately; manager verifies; verified correction repeats the separated flow and preserves snapshot/audit |
| E2E-07 | farmer creates/edits/deletes own farm/plot; collector cannot create baseline before granted consent/after decline/in returned, can resume without field change then edit assigned baseline in draft; admin/manager writes are denied |
| E2E-08 | farmer records activity/expense with Thai date/unit validation |
| E2E-09 | farmer records sale with required farm, optional plot and with/without optional harvest; sees decimal/formula preview consistent with server |
| E2E-10 | farmer period report equals fixture 9,000.25 and drill-down excludes deleted rows |
| E2E-11 | anonymized default and full-PII export both audit actor/time/action/entity/mode/filter/selected run/row count; full PII additionally requires approval reference/reason and denied roles fail |
| E2E-12 | evaluator reads anonymized dashboard/evidence and every edit/PII/file attempt is blocked |
| E2E-13 | 360 px Thai UI completes critical flows and displays พ.ศ./Asia-Bangkok from stored values |
| E2E-14 | one workspace/run/cohort-date filter produces base and seven stage counts: population eligible; sampled member; valid assignment; granted consent; submitted-or-verified; verified; export-eligible; early stages remain without final export predicate, active is default, superseded requires explicit history, withdrawal removes member from all stages/export |
| E2E-15 | admin imports the same valid population fixture successfully through the authorized audited path |
| E2E-16 | authorized attachment list/read/download receipts audit actor/time/action/entity/object ID; collector/farmer authorized delete adds reason/before-after result; collector post-submit and cross-owner access/delete are denied |
| E2E-17 | synthetic dashboard proves farm-first heading order, visible synthetic label, role/scenario controls, table equivalent, loading without fabricated totals, no 360px overflow and no serious/critical axe finding |

## Specialized tests

| ID | Level | Assertion |
|---|---|---|
| REP-01 | report | date boundaries, no-row zero, deleted row, rounding and fixture profit reconciliation |
| REP-02 | research report/export | shared base enforces workspace, selected active/superseded run, locked-at date, eligible/non-soft-deleted population/sample and not-withdrawn; each exact stage predicate reconciles independently; early stages do not use export predicate; export-eligible is granted+verified+not-withdrawn |
| OFF-01 | offline | IndexedDB draft survives reload, visibly remains device-only, cannot submit or claim server receipt offline |
| OFF-02 | reconnect | online returned resume revalidates granted consent/assignment/version and is status-only; content edit/submit occurs only after draft confirmation; declined/withdrawn/reassigned conflict blocks and offers safe draft deletion; success clears draft |
| A11Y-01 | automated/manual | 360/desktop critical pages have semantics, labels, contrast, focus and no serious/critical WCAG 2.1 AA finding; sampling receipt runs a page-specific axe scan |
| A11Y-02 | keyboard/screen reader | modal focus, error summary/live status, chart table alternative and primary journeys operate without pointer |
| BAK-01 | database recovery | logical export + encrypted identity manifest/checksum restore app data into clean target while preserving stable profile UUIDs and relinking new Auth UIDs |
| BAK-02 | storage recovery | private object manifest/checksum copied, restored privately, metadata/object reconciliation and access policies pass |
| BAK-03 | Auth recovery | Admin API recreates synthetic Auth users with temporary credentials, sets `must_change_password=true`, phone requires admin-assisted reset; recovered fixture signs in and proves stable profile/role/workspace linkage, allowed RLS success and cross-role deny; password hashes/sessions/tokens are absent |
| OPS-01 | deployment | migration forward/rollback rehearsal, previous app compatibility, health checks and secret absence scan pass |
| DOC-01 | documentation | relative links resolve; banned/secret/PII patterns absent; product IDs exactly match traceability; draft status, exact roles, notice/consent ordering, response/correction transitions, workspace-only sampling, AUD-01–AUD-09 fields, sale ownership and decimal/formula strings consistent |
| ACC-01 | acceptance | all acceptance criteria and privacy/release checklist signed against FX-BASE with no severity-high defect |

## Audit tests

| ID | Assertion |
|---|---|
| AUD-01 | sampling draft/lock/activate/supersede/cancel/regenerate records actor UUID, UTC timestamp, workspace/run action/entity, reason where required, before/after status, candidate hash, authoritative ordered-result hash/version, population size, target and algorithm without raw PII |
| AUD-02 | every anonymized and full-PII export records actor UUID, UTC timestamp, action/entity, `export_mode`, filter digest, selected `sampling_run_id`, row count and result without exported rows; full PII additionally requires approval reference and reason/purpose; denied attempts record result safely |
| AUD-03 | farm/plot/activity/expense/harvest/sale soft-delete records actor UUID, UTC timestamp, action/entity, required reason, before/after active/deleted status and report digest; direct hard delete is denied |
| AUD-04 | authorized/denied attachment list/read/download/delete records actor UUID, UTC timestamp, action/entity, object metadata ID and result; deletion additionally requires reason and before/after metadata/object status; audit excludes signed URL/path leakage |
| AUD-05 | initial assignment/reassignment/cancel records actor UUID, UTC timestamp, action/entity, before/after collector+status; reassign/cancel requires reason |
| AUD-06 | notice presentation and granted/declined consent records collector actor UUID, UTC timestamp, action/entity, notice version and before/after decision; decline audit is minimal and contains no baseline/answer |
| AUD-07 | submitted return/verify records manager actor UUID, UTC timestamp, action/entity and before/after status+response digest; return requires reason and verify cannot change answer digest |
| AUD-08 | verified correction chain records: manager initiation actor UUID/UTC timestamp/action/entity/required correction reason and verified→returned status/prior answer snapshot; collector resume actor UUID/UTC timestamp/action/entity with returned→draft and identical answer/baseline snapshots; separate collector edit+resubmit actor UUID/UTC timestamp/action/entity with draft→submitted and answer before/after; manager re-verification actor UUID/UTC timestamp/action/entity with submitted→verified and answer snapshot; prior verified snapshot remains immutable |
| AUD-09 | withdrawal from draft/submitted/returned/verified records collector actor UUID, UTC timestamp, action/entity, required withdrawal reason code, before/after status and analysis-eligibility change; no later mutation succeeds |

## Privileged transition matrix

| Path | Allowed | Must be denied | Test IDs |
|---|---|---|---|
| user/workspace/reference config and audit review | admin | manager, collector, farmer, evaluator | RLS-09, SEC-01 |
| population import | admin, research_manager | collector, farmer, evaluator | INT-01, E2E-02, E2E-15, RLS-09 |
| sampling/assignment transitions | research_manager | admin, collector, farmer, evaluator | INT-02, INT-03, AUD-01, AUD-05, RLS-09 |
| notice/consent, returned resume, draft content edit | assigned field_collector after granted with valid assignment | admin, manager, other collector, farmer, evaluator; combined resume+edit | INT-04, INT-05, INT-11, AUD-06, RLS-03, RLS-09, RLS-10 |
| response return/verify/correction initiation | research_manager status-only | admin, collector, farmer, evaluator; manager answer edit | INT-06, AUD-07, AUD-08, RLS-04, SEC-04 |
| assigned farmer/farm baseline in draft | assigned field_collector after granted with valid assignment | admin, manager, other collector, evaluator; pre-consent/declined/returned/submitted | INT-07, INT-11, RLS-05, RLS-10 |
| own farm ledger | farmer owner | admin, manager, collector, other farmer, evaluator | INT-07–INT-09, RLS-05, AUD-03 |
| PII export | admin, research_manager with audit | collector, farmer, evaluator | RLS-06, E2E-11, AUD-02, SEC-05 |
| aggregate anonymized read | research_manager, evaluator_readonly | evaluator row/base access; other scope violations | RLS-07, REP-02, SEC-06 |
| attachment delete | collector assigned purpose or farmer owner purpose | admin/manager content delete, wrong owner/purpose, evaluator | RLS-08, INT-10, E2E-16, AUD-04, SEC-07 |

## Explicit security negatives

| ID | Attack/negative case | Expected result |
|---|---|---|
| SEC-01 | forged role/workspace/actor fields, expired session, direct API call | 401/403 or RLS deny; no existence disclosure/no write |
| SEC-02 | spreadsheet formula payload, duplicate code, oversized/malformed import, unauthorized raw-error download | neutralized/rejected; batch safe; sanitized diagnostic |
| SEC-03 | skip notice, create baseline/answer before granted or after decline, admin/manager consent change, reuse submit key, mutate after withdrawal | denied; no baseline/answer/duplicate/change; minimal/full audit as applicable |
| SEC-04 | manager edits answer, collector mutates content while returned/submitted/verified, combined resume+field mutation, direct verified overwrite, missing correction/return reason, forged verifier/time/digest | denied atomically; prior verified snapshot and audit chain intact |
| SEC-05 | evaluator/collector requests PII fields, changes anonymized flag/filter, guesses export URL | denied; no file; privileged attempt audited |
| SEC-06 | evaluator sends POST/SQL-like filter/direct base-table/file request | denied with same non-enumerating response |
| SEC-07 | guess storage path, replay expired signed URL, upload executable/wrong MIME/oversize, admin/manager/evaluator/cross-owner delete | denied/quarantined; object private; denied-delete audit/cleanup evidence |

## Entry, exit, and defect policy

Test เริ่มเมื่อ requirement/ADR/questionnaire metadata/fixture version lock และ environment ไม่มี real data V1 exit เมื่อทุก mapped test ผ่าน, security/privacy checklist ผ่าน, severity high/critical เป็นศูนย์, restore drill ผ่าน และ acceptance owner ลงชื่อ Medium defect ที่ยอมรับต้องมี risk owner/mitigation/date ภายในระยะโครงการ; ห้าม waive consent, RLS, withdrawal, calculation หรือ restore invariant
