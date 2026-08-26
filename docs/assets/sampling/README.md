# Sampling acceptance evidence

หลักฐานนี้สร้างจาก local Supabase เท่านั้นด้วยข้อมูลสังเคราะห์ `FX-BASE` (121 ราย, `SYN-001`–`SYN-121`) และไม่มีข้อมูลเกษตรกรจริงหรือ secret ในไฟล์ภาพ

## Fixture and contract

- Fixture: [`population-acceptance-121.csv`](../../../e2e/fixtures/population-acceptance-121.csv)
- Seeds: first run `palmtrack-acceptance-seed-v1`; second run `palmtrack-acceptance-seed-v2` becomes active and supersedes the first
- Margin of error: `e=0.05`
- Yamane result: `N=121`, unrounded `92.898272552783`, `ceil n=93`
- Strata: `NORTH=32`, `CENTRAL=32`, `SOUTH=57`; largest-remainder allocation totals 93
- The authenticated manager journey imports/accepts the snapshot, previews, creates/locks/activates the first run, creates/locks/activates a second run with a different seed and idempotency key, then reloads and verifies the first receipt is superseded and the second is active with exact `N=121`, `e=0.05`, `n=93`, seed, algorithm and lowercase 64-hex seed/candidate/result digests. The same lifecycle checks evaluator aggregate-only access in an isolated local context; collector/farmer negatives are independent tests.

## Captures

- [Desktop 1365×900](desktop.png)
- [Mobile 360×800](mobile.png)

ภาพเป็น full-page captures ของหน้า sampling ที่ผ่านการยืนยันตัวตนจริงใน local E2E; ป้าย `ข้อมูลสังเคราะห์เท่านั้น` ต้องมองเห็นในทั้งสองภาพ ภาพ mobile เป็นโปรเจกต์แรกหลัง reset จึงแสดง v2 active และ v1 superseded; ภาพ desktop เป็นโปรเจกต์ถัดไปใน reset เดียวกัน จึงแสดง v4 active และ v3 superseded พร้อมคู่ก่อนหน้า v2/v1 ทั้งหมดเป็นข้อมูลสังเคราะห์ ภาพ mobile แสดง allocation ทั้งหกฟิลด์ด้วย row labels แบบ responsive พร้อม `เศษเหลือ` และ `จัดสรรจริง = 93` โดยไม่มี table overflow ภาพถูกบันทึกหลังทดสอบ Tab→Enter ของ skip link แล้ว blur main เพื่อไม่ให้มี focus ring ชั่วคราว

## Reproduction

รันเฉพาะ sampling spec หลัง local Supabase ทำงานและอ่าน loopback API/keys จาก `supabase status -o env` (ห้ามบันทึกค่าที่ได้ลงไฟล์):

```text
npx playwright test e2e/sampling.spec.ts --config playwright.local.config.ts
```

สำหรับ capture ใหม่ให้ตั้ง `PALMTRACK_E2E_CAPTURE_EVIDENCE=1` ใน process เดียวกับคำสั่งด้านบน ภาพนี้บันทึกเมื่อ 2026-08-26 และเป็นหลักฐาน local-only Milestone เดียวกันผ่าน full lint/typecheck/unit/build/database/local-auth E2E แล้ว แต่ยังไม่อ้าง hosted migration หรือความพร้อมใช้ข้อมูลจริง
