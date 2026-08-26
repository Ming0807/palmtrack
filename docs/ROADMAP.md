# Roadmap

Roadmap นี้จัดให้ทีม 2–3 คนทำงาน 4–6 เดือนแบบ vertical increment วันที่จริงกำหนดหลัง design review และไม่รับประกันตาม free tier

## Phase 0 — documentation foundation (complete)

จัดทำ requirement/protocol/architecture/data/UX/security/test/deployment/ADR และตรวจ traceability เสร็จแล้ว Written-design review ผ่านและผู้ใช้อนุมัติให้เข้าสู่ UX/UI prototype กับ implementation planning เมื่อ 2026-08-25 โดย gates สำหรับ questionnaire, privacy/retention, restore และข้อมูลจริงยังมีผลเหมือนเดิม

## Phase 0.5 — UX/UI prototype (complete)

สร้าง local prototype ด้วยข้อมูลสังเคราะห์เพื่อเปรียบเทียบ queue-first, receipt และ evidence-route composition เสร็จแล้ว แนวทางที่ implement คือ queue-first สำหรับหน้า `งานของฉัน` และ evidence route ภายในงานหนึ่งรายการ Prototype ไม่เชื่อม cloud, ไม่เก็บข้อมูลจริง และไม่ข้าม questionnaire/privacy/restore gates รายละเอียดอยู่ใน [field UI direction](superpowers/specs/2026-08-25-palmtrack-field-ui-direction.md), [prototype implementation plan](superpowers/plans/2026-08-25-palmtrack-ui-prototype.md) และ [design system](../DESIGN.md)

## Questionnaire approval gate (separate artifact)

ก่อนสร้าง renderer, schema migration ที่เก็บ answer หรือเริ่ม collection ต้องได้รับ approved questionnaire version/codebook ตาม [Research protocol](RESEARCH_PROTOCOL.md): Thai wording/notice, stable question codes, typed values/options/validation/skip logic, schema digest, approval identity/time และ analysis treatment คำถามจริงไม่อยู่ใน documentation foundation นี้ Failure gate หมายถึงพัฒนาส่วน auth/farm/infrastructure ด้วย synthetic contract ได้ตาม plan ที่อนุมัติ แต่ห้ามแต่ง/ฝังคำถามหรือเก็บ response จริง

## V1 increments

1. **Safety skeleton** — repository/runtime plan, schema migration harness, Auth/profile/5 roles, workspace seam, RLS test harness, audit foundation, Thai shell ด้วย synthetic data
2. **Research population and sample** — admin/manager import validation, eligibility snapshot, Yamane, largest remainder, `sha256-mulberry32-fy-v1`, exact sampling lifecycle และ audit evidence
3. **Field collection** — assignment, consent hard gate, approved questionnaire renderer, typed answer, IndexedDB device draft/online idempotent submit
4. **Review and privacy** — return/verify/revision correction, withdrawal lock/exclusion, private file object policy, anonymized/full-PII export control
5. **Farm cash ledger** — farmer/farm/plot, activity/expense/harvest/sale, precision/formula, profit report
6. **Acceptance and readiness** — anonymized evaluator views/funnel, accessibility/mobile QA, security negatives, backup/storage restore drill, acceptance with synthetic fixture, limited launch approval

Safety Skeleton increment เริ่ม implementation planning หลัง prototype ผ่าน verification เมื่อ 2026-08-25 รายละเอียดและลำดับ test-first อยู่ใน [Safety Skeleton implementation plan](superpowers/plans/2026-08-25-palmtrack-safety-skeleton.md) โดยยังไม่อนุมัติ cloud provisioning หรือข้อมูลจริง

สถานะ increment 2 เมื่อ 2026-08-26: tracer bullet **population import** และ local **sampling acceptance** เสร็จตั้งแต่ parser → RPC/RLS/audit → server action → Thai responsive UI → authenticated E2E; final verification ผ่าน lint, typecheck, 263 unit/component tests, production build, database lint, 231 pgTAP assertions และ 22 local-auth E2E tests มี [population visual evidence](assets/population-import/README.md) และ [sampling acceptance evidence](assets/sampling/README.md) Sampling evidence ครอบคลุม FX-BASE 121 ราย, Yamane `e=0.05/n=93`, canonical decimal input, largest remainder แบบหกฟิลด์บน mobile, seeded shuffle, independent database replay ก่อน lock, first/second draft → locked → active พร้อม supersession, exact v2 receipt reload, lowercase 64-hex digest evidence, sampling axe scan, keyboard skip-link และ role negatives/aggregate-only ส่วน hosted migrations `202608250002`–`202608260004` และ restore/privacy gates ยัง pending จึงยังไม่ถือว่า V1 พร้อมข้อมูลจริง

สถานะ product shell เมื่อ 2026-08-26: `/app` เปลี่ยนจาก Safety Skeleton เป็น dashboard ตามบทบาทที่นำด้วย farm operations/data analytics และวาง research provenance เป็นส่วนรอง Production แสดง farm-ledger `not_enabled` อย่างซื่อสัตย์จน increment 5 มี backend จริง ส่วน `/prototype/dashboard` ใช้ fixture สังเคราะห์สำหรับ `typical|empty|loading|partial|unavailable` พร้อม [mobile/desktop evidence](assets/dashboard/README.md) งานถัดไปจึงควรเดิน increment 5 แบบ vertical slice เพื่อแทนสถานะดังกล่าวด้วย farm/plot และ cash-ledger aggregate จริง โดยไม่รอ questionnaire gate

FR-16 staged research funnel ยังไม่ implement ใน product shell รอบนี้ เพราะ assignment/consent/response aggregate ยังไม่มี backend ที่เชื่อถือได้ งานดังกล่าวอยู่ใน increment 3, 4 และ 6 ตามลำดับและห้ามแทนด้วย fixture บน production dashboard

แต่ละ increment ต้องมี requirement/test IDs, migration rollback, no-real-data review และ evidence ก่อนเริ่ม increment ต่อไป Slice ควรส่ง UI→server→RLS→audit→test ครบ ไม่สร้าง layer ทั้งก้อนล่วงหน้า

## V1.1 candidates

พิจารณาหลัง V1 evidence: usability refinements จากภาคสนามที่ไม่เปลี่ยน protocol, scheduled backup reminder (ยังต้อง verified restore), richer anonymized chart/export template, configurable farm categories ที่ versioned และ performance/index optimization จาก sanitized measurements ทุก candidate ต้องผ่าน scope/privacy review

## Future, not V1

Multi-tenancy อาจเพิ่ม workspace membership, tenant selector, per-workspace provider/billing/retention และ migration จาก seam ที่ `workspace_id`; ต้องมี threat model/RLS isolation/recovery plan ใหม่ หากต้องรองรับหลายงานวิจัยใน workspace อนาคตจึงค่อยเสนอ migration เพิ่ม `research_project` entity; V1 ไม่มี entity/alias นี้และ workspace คือ research scope เดียว System-evaluation instrument เป็น post-V1 proposal และต้องผ่าน separate questionnaire/instrument approval gate โดยไม่กำหนดคำถามไว้ล่วงหน้า Native app, bidirectional offline sync, external analytics/IoT/GIS, commercial hosting และ multi-project research เป็น proposal ใหม่ ไม่ใช่ implied promise

## Explicit non-goals

ไม่สร้าง exact questionnaire ใน repository ก่อน gate, ไม่ใช้ real farmer data ใน development, ไม่ให้ public storage/PII evaluator export, ไม่ทำ accrual accounting/inventory/payroll, ไม่รับประกัน SLA/automatic backup, ไม่เพิ่ม microservices หรือ multi-tenant UI เพื่อ “เผื่อไว้” และไม่เพิ่ม cloud resource ใน documentation phase
