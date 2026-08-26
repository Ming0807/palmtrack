# Sampling acceptance evidence

หลักฐานนี้สร้างจาก local Supabase เท่านั้นด้วยข้อมูลสังเคราะห์ `FX-BASE` (121 ราย, `SYN-001`–`SYN-121`) และไม่มีข้อมูลเกษตรกรจริงหรือ secret ในไฟล์ภาพ

## Fixture and contract

- Fixture: [`population-acceptance-121.csv`](../../../e2e/fixtures/population-acceptance-121.csv)
- Seed: `palmtrack-acceptance-seed-v1`
- Margin of error: `e=0.05`
- Yamane result: `N=121`, unrounded `92.898272552783`, `ceil n=93`
- Strata: `NORTH=32`, `CENTRAL=32`, `SOUTH=57`; largest-remainder allocation totals 93
- The authenticated manager journey imports/accepts the snapshot, previews, creates a draft, locks, activates, reloads the created receipt, and verifies exact `N=121`, `e=0.05`, `n=93`, seed, algorithm, digest and active status. The same lifecycle checks evaluator aggregate-only access; collector/farmer negatives are independent tests.

## Captures

- [Desktop 1365×900](desktop.png)
- [Mobile 360×800](mobile.png)

ภาพเป็น full-page captures ของหน้า sampling ที่ผ่านการยืนยันตัวตนจริงใน local E2E; ป้าย `ข้อมูลสังเคราะห์เท่านั้น` ต้องมองเห็นในทั้งสองภาพ และภาพถูกบันทึกหลังย้าย focus ไปยังหัวข้อหลักเพื่อซ่อน skip link ภาพ mobile แสดง allocation ทั้งหกฟิลด์ด้วย row labels แบบ responsive พร้อม `เศษเหลือ` และ `จัดสรรจริง = 93` โดยไม่มี table overflow ภาพ desktop แสดง receipt สังเคราะห์ก่อนหน้าด้วยเพราะ Playwright projects ใช้ local reset เดียวกัน ส่วนภาพ mobile เป็น receipt แรกของ run

## Reproduction

รันเฉพาะ sampling spec หลัง local Supabase ทำงานและอ่าน loopback API/keys จาก `supabase status -o env` (ห้ามบันทึกค่าที่ได้ลงไฟล์):

```text
npx playwright test e2e/sampling.spec.ts --config playwright.local.config.ts
```

สำหรับ capture ใหม่ให้ตั้ง `PALMTRACK_E2E_CAPTURE_EVIDENCE=1` ใน process เดียวกับคำสั่งด้านบน ภาพนี้บันทึกเมื่อ 2026-08-26 และเป็นหลักฐาน local-only; ยังไม่อ้าง hosted migration หรือ full-suite verification
