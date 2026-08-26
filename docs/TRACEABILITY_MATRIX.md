# Traceability matrix

ทุก V1 requirement จาก [Product requirements](PRODUCT_REQUIREMENTS.md) ต้องปรากฏหนึ่งแถวขึ้นไป Test ID อ้าง [Test plan](TEST_PLAN.md) และ evidence เป็นสิ่งที่ต้องเก็บจาก synthetic acceptance run โดยไม่รวมข้อมูลจริง

| Requirement | Objective | Role | Flow / screen | Data entity | Test IDs | Expected research evidence |
|---|---|---|---|---|---|---|
| FR-01 | access control | ทุกบทบาท | sign-in / protected route | user_profile | RLS-01, RLS-09, E2E-01, SEC-01 | exact role allowlist และ deny log สังเคราะห์ |
| FR-02 | valid population | admin, research_manager | population import/validation | population_import, population_member | INT-01, E2E-02, E2E-15, SEC-02 | successful actor-specific imports, input digest, accepted/rejected counts/reasons |
| FR-03 | reproducible active sample | research_manager | sampling draft/lock/activate/cancel | sampling_run, sample_member | UNIT-01, UNIT-02, UNIT-08, INT-02, E2E-03, AUD-01 | canonical `margin_of_error_text` (`0.050→0.05`), N/e/n, allocation, NFC/seed/digest/algorithm, candidate hash, ordered result plus `ordered-result-sha256-v1` hash, independently replayed locked membership/order, lifecycle audit |
| FR-04 | controlled field work | research_manager, field_collector | assignment / งานของฉัน | assignment | RLS-02, INT-03, E2E-04, AUD-05 | assignment/reassignment actor/time/before-after and required reason |
| FR-05 | notice/consent hard gate | field_collector | notice→granted/declined / withdrawal | consent_record, response, review_event | RLS-03, RLS-09, INT-04, E2E-05, REP-02, AUD-06, AUD-09, SEC-03 | exact four withdrawal sources, current consent withdrawn, minimal terminal audit/exclusion |
| FR-06 | separated resume/edit collection | field_collector | returned read-only → resume → draft edit → submit | questionnaire_version, response, answer | UNIT-03, RLS-09, RLS-10, INT-05, INT-11, OFF-01, OFF-02, AUD-08 | combined mutation denied; status-only resume preserves digests; later edit/submit receipt |
| FR-07 | manager status-only review/correction | research_manager, field_collector | return/verify / verified correction loop | response, review_event | RLS-04, RLS-09, RLS-10, INT-06, INT-11, E2E-06, AUD-07, AUD-08, SEC-04 | required reasons, immutable snapshot, separated resume/edit, full action/entity actor/time before-after chain |
| FR-08 | owned/assigned baseline | field_collector, farmer | assigned baseline / own farmer/farm/plot | farmer, farm, plot | RLS-05, RLS-09, RLS-10, INT-07, INT-11, E2E-07, AUD-03 | returned baseline mutation denied; resume preserves fields; draft ownership/attribution |
| FR-09 | expense/activity ledger | farmer | own activity/expense form | activity, expense | UNIT-04, RLS-05, INT-08, E2E-08, AUD-03 | decimal precision, owner allow/role denies, ledger soft-delete audit |
| FR-10 | sale ownership/trace | farmer | own harvest/sale form | farm, plot, harvest, sale | UNIT-05, RLS-05, INT-09, E2E-09, AUD-03 | required farm, optional plot/harvest, decimal/formula and soft-delete audit |
| FR-11 | correct cash result | farmer, evaluator_readonly | period report/drill-down | sale, expense | UNIT-06, REP-01, E2E-10 | expected sales-expenses reconciliation |
| FR-12 | privacy-preserving export | admin, research_manager | export preview/confirm | export_job, audit_event | RLS-06, REP-02, E2E-11, AUD-02, SEC-05 | both modes audit actor/time/mode/filter/run/rows; PII approval+reason; denied result |
| FR-13 | read-only evaluation | evaluator_readonly | anonymized dashboard/evidence | reporting views | RLS-07, E2E-12, SEC-06 | aggregate output plus denied mutations/PII |
| FR-14 | private attachment access | field_collector, farmer | attachment list/read/download/delete | file_object | RLS-08, INT-10, E2E-16, AUD-04, SEC-07 | object-ID audit for every access; delete reason/before-after; policy/checksum/denies |
| FR-15 | Thai locale/time | ทุกบทบาท | all screens/evidence detail | date/timestamp fields | UNIT-07, E2E-13 | พ.ศ./Asia-Bangkok display mapped to UTC/Gregorian |
| FR-16 | shared-base staged funnel | research_manager, evaluator_readonly | active default / explicit superseded history | population_member, sample_member, assignment, consent_record, response | INT-02, REP-02, E2E-14 | same workspace/run/cohort-date base, exact seven stage counts, early-stage independence, withdrawal removal, export reconciliation |
| FR-17 | farm-first role dashboard | ทุกบทบาท | `/app` / `/prototype/dashboard` | authorized aggregate read models | UNIT-09, E2E-17, A11Y-02 | role navigation begins at overview; production has no synthetic fixture; unavailable ledger remains explicit; prototype label/states/table/mobile-desktop evidence |
| NFR-01 | deny-by-default | ทุกบทบาท | all protected operations | all scoped tables/storage | RLS-01–RLS-10, SEC-01–SEC-07 | complete exact-role/status negative matrix including combined resume mutation deny |
| NFR-02 | privacy compliance | admin, research_manager | export/file/retention review | export_job, file_object, audit_event | SEC-05, SEC-07, ACC-01 | signed release checklist and anonymized manifest |
| NFR-03 | complete audit | privileged roles | semantic changes/audit viewer | audit_event, review_event | AUD-01–AUD-09 | actor UUID/UTC/action/entity plus event-specific fields: both export modes, attachment access/delete, reasons, status/answer before-after, correction resume/edit/resubmit/re-verify, withdrawal |
| NFR-04 | sampling reproducibility | research_manager, evaluator_readonly | replay/evidence | sampling_run, sample_member | UNIT-01, UNIT-02, UNIT-08, INT-02, AUD-01 | database independently reconstructs candidate ordering, allocation, Mulberry32/Fisher–Yates swaps, quota selection and full ordered membership/hash from the accepted snapshot; forged selection RPC fails |
| NFR-05 | mobile Thai usability | ทุกบทบาท | primary mobile flows | UI state | E2E-13, A11Y-01, ACC-01 | 360 px screenshots and task completion record |
| NFR-06 | accessible operation | ทุกบทบาท | forms/dialogs/charts | semantic UI | A11Y-01, A11Y-02 | automated scan plus keyboard/manual checklist |
| NFR-07 | free-tier recovery | admin | clean-target DB/storage/Auth restore | user_profile, identity/storage/database backup | BAK-01, BAK-02, BAK-03, OPS-01 | encrypted manifests/checksums, stable profile/Auth relink, sign-in/RLS reconciliation |
| NFR-08 | transaction integrity | ทุกเขียนข้อมูล | submit/transition/ledger | response, sale, expense | UNIT-04–UNIT-06, RLS-10, INT-04–INT-09, INT-11, SEC-03 | duplicate/invalid/orphan/combined-transition attempts denied; separated transition succeeds |
| NFR-09 | maintainable delivery | ทีมพัฒนา | migration/module/review | schema/docs | DOC-01, OPS-01 | link/trace scan, migration review and rollback evidence |

## Coverage rule

Automated documentation verification ต้องเปรียบเทียบชุด ID ใน product requirements กับ column แรก: ไม่มี missing และไม่มี unknown ID เมื่อ requirement เพิ่ม/เปลี่ยน ต้องปรับ objective, flow, entity, test และ evidence ใน commit เดียวกัน; test ที่ retire ต้องมี replacement หรือ change decision ที่อนุมัติ

## Safety Skeleton evidence status — 2026-08-25

| Requirement | Implemented evidence in this increment | Status boundary |
|---|---|---|
| FR-01 | exact five-role TypeScript allowlist/deny matrix, verified-session resolver, fixed `get_current_profile` RPC adapter, Thai role navigation, `/`→`/sign-in`, protected `/app/*`, non-enumerating states | unit/component/build and anonymous/unconfigured browser paths verified; five seeded-role authenticated browser sessions remain a separate unverified slice |
| NFR-01 | deny-by-default authorization kernel, no broad admin override, base-profile query removed from application adapter, public publishable-key clients with legacy anon-key fallback, `server-only` boundary for server configuration/client | TypeScript and bundle/build boundaries verified; PostgreSQL 17 enforcement and exact function ACLs passed local and hosted database tests |
| NFR-03 | strict safe-event projection tests plus ordered SQL migration for non-null actor/workspace audit, allowlisted action/detail values, internal writer role chain and insert/update/delete/truncate guards | application sanitizer verified; PostgreSQL 17 migration/schema lint passed locally, migration applied to hosted Supabase, and all 55 pgTAP assertions passed against both targets |

Evidence นี้เป็น progress ของ increment ไม่ใช่ V1 acceptance sign-off และไม่แทน RLS/restore tests ที่ยังไม่รัน

## Population Import evidence status — 2026-08-25

| Requirement | Implemented evidence in this increment | Status boundary |
|---|---|---|
| FR-02 | strict synthetic CSV parser/canonical digest; atomic create/list/accept RPCs; immutable accepted snapshot; source authorization, eligibility rule, counts and actor timestamps; Thai `/app/research/population` flow | unit, server, 98 local pgTAP assertions and authenticated local E2E pass; the 121-member acceptance fixture is also accepted in focused sampling E2E; migration `202608250002` is not hosted |
| NFR-01 | application role gate plus database RPC role gate; no direct API table privileges; RLS forced; collector/farmer/evaluator and anonymous denial | exact local negative matrix passes; hosted evidence remains at Safety Skeleton migration 001 |
| NFR-03 | create and accept audit events contain allowlisted provenance/count/status fields with stable profile actors; accepted record cannot be edited or deleted | local pgTAP checks exact before/after evidence and mutation guards; hosted 002 audit evidence pending |
| NFR-05 | Thai minimal-premium evidence sheet at 360px and desktop with synthetic-only boundary and no horizontal overflow | [bounded screenshots](assets/population-import/README.md) and authenticated browser run pass |
| NFR-06 | semantic labels/status/alert, keyboard focus, disabled pending action and axe serious/critical scan | local mobile and desktop browser evidence passes; field usability sign-off remains pending |
| NFR-08 | full-file validation before RPC, transactional member insert, canonical digest recheck and idempotency key | invalid fixture writes zero rows and double submission adds exactly one import in local E2E |
| NFR-09 | ordered migration, 98 assertions, schema lint, reviewed compensating rollback and sanitized incident ledger | local implementation evidence complete; deploy/restore/hosted migration evidence remains pending |

Evidence นี้เป็น tracer-bullet progress ไม่ใช่ FR-02/V1 acceptance sign-off และไม่อนุญาตข้อมูลจริง

## Sampling acceptance evidence status — 2026-08-26

| Requirement | Implemented evidence in this increment | Status boundary |
|---|---|---|
| FR-03 | synthetic `FX-BASE` fixture with 121 eligible members across `NORTH`, `CENTRAL`, `SOUTH`; authenticated manager preview shows Yamane `N=121/e=0.05/n=93`, largest-remainder rows, normalized seed, algorithm and digest evidence; manager completes first and second draft → locked → active lifecycles, then reloads the created receipts | focused local `e2e/sampling.spec.ts` passes 6/6 and the final local-auth suite passes 22/22 across mobile and desktop, scoping lifecycle assertions by run ID, proving distinct seed/idempotency values, and checking first `superseded` versus second `active` plus exact receipt values; hosted migration remains unverified |
| NFR-01 | collector and farmer receive non-enumerating forbidden state; evaluator receives the created run's summary/aggregate receipt only and no mutation form or transition controls | focused local role negatives pass independently and evaluator checks run inside the manager lifecycle; this is not the complete V1 RLS negative matrix |
| NFR-04 | persisted sampling receipt includes seed, candidate/result digest and ordered stratum evidence for the active run | focused E2E confirms exact `N`, `e`, `n`, v2 seed, algorithm and concrete lowercase 64-hex seed/candidate/result digests after reload; deterministic unit/database evidence remains separately bounded |
| NFR-05 | Thai authenticated sampling page captured at 360×800 and 1365×900 with visible synthetic-only boundary and six labeled mobile allocation fields | [sampling screenshots](assets/sampling/README.md) and focused local browser run pass; field usability sign-off remains pending |
| NFR-06 | manager confirmation dialogs receive focus, the primary journey completes, both configured viewports have no document/table horizontal overflow, and the skip link remains keyboard reachable while unfocused off-canvas | focused local assertions pass for Tab→Enter focus transfer to `main`; sampling acceptance now runs an axe serious/critical scan on the authenticated sampling receipt; field usability sign-off remains pending |

หลักฐานนี้เป็น local synthetic acceptance evidence ของ sampling slice โดย final verification ผ่าน lint, typecheck, 263 unit/component tests, production build, database lint, 231 pgTAP assertions และ 22 local-auth E2E tests แล้ว แต่ไม่ใช่ V1 acceptance sign-off และไม่อนุญาตให้สรุป hosted migration หรือ real-data readiness

## Farm Core and Cash Ledger Foundation evidence status — 2026-08-26

| Requirement | Implemented evidence in this increment | Status boundary |
|---|---|---|
| FR-08 | `farmer`, `farm`, `plot` tables with `workspace_id`, RLS isolating farmer's own records, cross-farmer deny, other role mutation deny, soft-delete attribution (`deleted_at`, `deleted_by`, `delete_reason`) with audit logging (`farm.created`, `farm.updated`, `farm.soft_deleted`, `plot.created`, `plot.updated`, `plot.soft_deleted`), hard deletion blocked by database trigger, and production route `/app/gardens` | 69 pgTAP subtests, 38 domain/service/UI tests, Next.js build and authenticated Playwright E2E pass on mobile/desktop; migration `202608260005` is local-only |
| FR-09 | `expense` table with `amount decimal(14,2)` (`amount >= 0.00`), area `decimal(14,3)`, soft-delete with required delete reason and audit logging (`expense.created`, `expense.soft_deleted`), RLS denying other roles, and production recording UI on `/app/garden-account` | database constraints, domain decimal arithmetic, service layer, UI forms and E2E pass |
| FR-10 | `sale` table with required `farm_id`, optional `plot_id`, `quantity decimal(14,3)`, `unit_price`, `gross_amount`, `deductions`, `net_amount decimal(14,2)`, database check constraints for `gross_amount = round(quantity * unit_price, 2)` and `net_amount = gross_amount - deductions`, soft-delete with required reason and audit logging (`sale.created`, `sale.soft_deleted`), and live calculation UI on `/app/garden-account` | database formula checks, domain formula unit tests, service layer, UI forms and E2E pass |
| FR-11 | Cash profit/loss calculation `SUM(active sales.net_amount) - SUM(active expenses.amount)` excluding soft-deleted rows, drilldown workbench with farm and period filter, dashboard `/app` integration for farmer with truthful empty/available states and profit tone, exact finance fixture reconciliation matching `9,000.25` cash profit | pgTAP exact fixture check, domain aggregation tests, service tests, overview integration tests, and authenticated E2E verification pass |
| NFR-01 | Deny-by-default RLS and security definer functions owned by `palmtrack_transaction_owner`; non-farmer roles denied from farm ledger routes and RPCs | pgTAP cross-role negatives pass; E2E verifies manager/evaluator forbidden state on `/app/gardens` and `/app/garden-account` |
| NFR-03 | Audit allowlists extended for all farm ledger create/update/soft_delete events with actor UUID, workspace, and non-PII details; hard delete prohibited | pgTAP audit logging tests pass; database rejection triggers tested |
| NFR-05 | Thai responsive mobile-first UI for `/app/gardens` and `/app/garden-account` tested at 360×800 and 1365×900 without horizontal overflow | Playwright mobile and desktop E2E suites pass |
| NFR-06 | Semantic dialogs, focus management, required labels, clear feedback alerts, and axe accessibility scan | `@axe-core/playwright` automated scan on both `/app/gardens` and `/app/garden-account` reports 0 violations |
| NFR-08 | Transactional RPCs, scaled BigInt arithmetic preventing floating-point drift, check constraints, non-negative amounts, and soft-delete retention | unit, pgTAP, and E2E arithmetic checks pass |

หลักฐานนี้เป็น local synthetic acceptance evidence ของ Farm Core + Cash Ledger Foundation vertical slice โดย final verification ผ่าน lint (0 errors/0 warnings), typecheck (0 errors), 318 unit/component tests (40 test files), production build, database lint (0 errors), 300 pgTAP assertions (4 test files) และ 24 local-auth E2E tests แล้ว แต่ไม่ใช่ V1 acceptance sign-off และไม่อนุญาตให้สรุป hosted migration หรือ real-data readiness

