# PalmTrack student research design synthesis

- Date: 2026-08-25
- Status: Accepted for UX prototype and implementation planning (2026-08-25)
- Scope: single-workspace, zero-cost, non-commercial student research V1

## Design

PalmTrack เป็น Thai mobile-first Next.js modular monolith ที่วางแผนใช้ Supabase Auth/PostgreSQL RLS/private Storage และ Vercel Hobby Workspace คือ research scope เดียวของ V1 Research flow คือ locked population → Yamane/largest-remainder sampling run `draft|locked|active|superseded|cancelled` ด้วย `sha256-mulberry32-fy-v1` → assignment → privacy notice → collector-only granted/declined consent → baseline/response เฉพาะ granted → collector content edit ใน draft เท่านั้น → manager status-only return/verify Returned อนุญาตเพียง status-only resume เป็น draftก่อน operation แก้ไข Verified correction คือ manager verified→returned พร้อม reason, collector resume/edit/resubmit, manager re-verify โดยรักษา snapshot/audit Withdrawal จาก draft/submitted/returned/verified เป็น terminal Current analysis ใช้ active run exactly one/workspace; historical analysis ต้องเลือก superseded run Farm flow คือ farmer → farm → plot → activity/expense/harvest/sale → cash profit/loss Sale ต้องมี farm และอาจมี plot/harvest Offline รองรับเพียง IndexedDB device draft และ online submission

Security ใช้ exact role allowlist และ deny-by-default RLS/object authorization: admin จัดการ workspace/reference config/audit/import/PII export แต่ไม่แก้ consent/response/farm ledger; manager จัดการ sampling/assignment/review status/export แต่ไม่ capture consent/แก้ answer/ledger; collector ทำ notice/consent, status-only returned resume และ assigned response/baseline content เฉพาะ granted+valid assignment+`draft`; farmer ทำ own profile/ledger; evaluator อ่าน aggregate anonymized เท่านั้น Files private, anonymized export เป็นค่าเริ่มต้น และ full PII เฉพาะ admin/manager ที่ audit

## Detailed sources

[Requirements](../../PRODUCT_REQUIREMENTS.md) · [Research protocol](../../RESEARCH_PROTOCOL.md) · [Architecture](../../ARCHITECTURE.md) · [Data model](../../DATA_MODEL.md) · [UX](../../UX_SPEC.md) · [Security/PDPA](../../SECURITY_PDPA.md) · [Traceability](../../TRACEABILITY_MATRIX.md) · [Test plan](../../TEST_PLAN.md) · [Deployment](../../DEPLOYMENT_RUNBOOK.md) · [Roadmap](../../ROADMAP.md) · [ADRs](../../adr/README.md)

## Gate before implementation planning

Reviewer (`research_manager` for protocol/scope and `admin` for architecture/security) must record approval that: every V1 ID is traced/testable; sampling/consent/withdrawal/formula/role rules are consistent; questionnaire remains a separately approved artifact; privacy/retention/real-data authority is identified; free-tier backup/restore plan is feasible; and no unresolved design decision blocks the first vertical slice

Written-design review ผ่านและผู้ใช้อนุมัติให้เดินหน้าเมื่อ 2026-08-25 จึงเริ่ม UX/UI prototype และเขียน implementation plan ได้ Questionnaire-dependent response implementation/collection ยังต้องผ่าน artifact approval gate แยก และข้อมูลจริงยังต้องผ่าน privacy/retention/restore gates การไม่ผ่าน gate ใดต้องย้อนแก้ authoritative document และ traceability; ห้ามตัดสินใจโดยนัยในโค้ด

## Approval evidence

- `research_manager` scope/protocol axis: ผู้ใช้อนุมัติ role, consent, sampling, data model และ workflow ทีละส่วนในการ design session วันที่ 2026-08-25 และสั่งให้นำแผนฉบับรวมไปสร้างเอกสาร
- `admin` architecture/security axis: Luna final documentation review ของ commit `751884c` ให้ผล PASS โดยไม่มี Critical/Important หลังตรวจ authorization, withdrawal, audit, cohort, questionnaire gate และ Git state
- User gate: ผู้ใช้สั่ง `PLEASE IMPLEMENT THIS PLAN`, ต่อด้วยการให้ตั้ง goal และเดินหน้าต่อเมื่อ 2026-08-25 จึงถือเป็น approval สำหรับ UX prototype และ implementation planning เท่านั้น ไม่ใช่การอนุมัติใช้ข้อมูลจริง
