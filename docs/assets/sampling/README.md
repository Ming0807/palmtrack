# Sampling acceptance evidence

หลักฐานนี้สร้างจาก local Supabase เท่านั้นด้วยข้อมูลสังเคราะห์ `FX-BASE` (121 ราย, `SYN-001`–`SYN-121`) และไม่มีข้อมูลเกษตรกรจริงหรือ secret ในไฟล์ภาพ

## Fixture and contract

- Fixture: [`population-acceptance-121.csv`](../../../e2e/fixtures/population-acceptance-121.csv)
- Seed: `palmtrack-acceptance-seed-v1`
- Margin of error: `e=0.05`
- Yamane result: `N=121`, unrounded `92.898272552783`, `ceil n=93`
- Strata: `NORTH=32`, `CENTRAL=32`, `SOUTH=57`; largest-remainder allocation totals 93
- The authenticated manager journey imports/accepts the snapshot, previews, creates a draft, locks, activates, reloads the receipt, and checks focus/no-overflow and role negatives.

## Captures

- [Desktop 1365×900](desktop.png)
- [Mobile 360×800](mobile.png)

ภาพเป็น full-page captures ของหน้า sampling ที่ผ่านการยืนยันตัวตนจริงใน local E2E; ป้าย `ข้อมูลสังเคราะห์เท่านั้น` ต้องมองเห็นในทั้งสองภาพ ภาพ desktop แสดง receipt สังเคราะห์ก่อนหน้าด้วยเพราะ Playwright projects ใช้ local reset เดียวกัน ส่วนภาพ mobile เป็น receipt แรกของ run

## Reproduction

รันเฉพาะ sampling spec หลัง local Supabase ทำงานและอ่าน loopback API/keys จาก `supabase status -o env` (ห้ามบันทึกค่าที่ได้ลงไฟล์):

```text
npx playwright test e2e/sampling.spec.ts --config playwright.local.config.ts
```

สำหรับ capture ใหม่ให้ตั้ง `PALMTRACK_E2E_CAPTURE_EVIDENCE=1` ใน process เดียวกับคำสั่งด้านบน ภาพนี้บันทึกเมื่อ 2026-08-26 และเป็นหลักฐาน local-only; ยังไม่อ้าง hosted migration หรือ full-suite verification
