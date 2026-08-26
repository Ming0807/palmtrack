# Farm Core + Cash Ledger evidence

Evidence นี้ใช้ข้อมูลสังเคราะห์เท่านั้นสำหรับ production routes `/app/gardens`, `/app/garden-account` และ farmer dashboard `/app` ใน local Supabase ไม่มีข้อมูลเกษตรกรจริง credential หรือ hosted mutation

## Covered behavior

- farmer สร้างสวนและแปลงของตน โดย active plot area รวมไม่เกินพื้นที่สวน
- farmer บันทึก expense/sale ด้วย canonical decimal string; database คำนวณ gross/net และ cash result
- fixture รายรับสุทธิ `12,500.50` ลบค่าใช้จ่าย `3,500.25` ได้ cash result `9,000.25`
- soft-deleted ledger row และ row ใต้ soft-deleted farm ไม่อยู่ใน active report
- role อื่นและ farmer คนอื่นถูก deny; direct table write ไม่มี grant
- audit ใช้ digest/metadata ไม่เขียน raw farmer/farm/plot name, phone, location หรือ buyer name

## Reproducible evidence

| Gate | Command or artifact |
|---|---|
| Database/RLS/formula | `npx supabase test db` — 306/306 assertions passed |
| Database lint | `npx supabase db lint --local --schema public,private --level error --fail-on error` — no errors |
| Domain/gateway/component | `npm run test` — 328/328 tests passed in the current worktree |
| Authenticated mobile/desktop | `npm run test:e2e:local -- e2e/farm-core-ledger.spec.ts` — 2/2 passed |
| Rollback | execute `supabase/rollback/202608260005_farm_core_cash_ledger_rollback.sql`, then database suites 001–003 — 231/231 passed before reset/reapply |

Visual captures จาก authenticated local synthetic journey เป็น review artifacts และไม่ถูก import เข้า application:

- [Mobile — สวนและแปลง](mobile-gardens.png)
- [Mobile — สมุดบัญชีแบบ stacked records](mobile-garden-account.png)
- [Desktop — สวนและแปลง](desktop-gardens.png)
- [Desktop — สมุดบัญชี](desktop-garden-account.png)

ภาพยืนยันเมนู mobile ไม่ถูกตัด, action target อย่างน้อย 44px, ledger ไม่ต้องเลื่อนแนวนอน และวันที่แสดงปฏิทินไทย พ.ศ.

## Scope boundary

This increment does not implement activity, harvest, optional sale `harvest_id`, assigned-collector baseline, offline ledger draft, hosted migration or real-data acceptance Those remain governed by PRODUCT_REQUIREMENTS, DATA_MODEL and TEST_PLAN
