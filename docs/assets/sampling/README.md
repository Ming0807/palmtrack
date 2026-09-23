# Sampling visual evidence

ภาพนี้จับจาก authenticated local E2E (`e2e/sampling.spec.ts`) บน route `/app/research/sampling` หลัง manager สร้างฉบับร่างจาก snapshot FX-BASE, ล็อก และเปิดใช้ เห็นสูตร Yamane, ตาราง largest remainder, `sha256-mulberry32-fy-v1`, candidate/seed digest, version chain (`ใช้งานอยู่` + `ถูกแทนที่แล้ว`) และเวลาจบไทย

| ไฟล์ | Viewport | สิ่งที่พิสูจน์ |
|---|---:|---|
| `mobile.png` | 360 x 800 | ฟอร์มฉบับร่าง, preview สูตร/จัดสรร, receipt ล็อก, ไม่มี horizontal overflow |
| `desktop.png` | 1365 x 900 | version chain 4 รอบ, badge สถานะ, ตารางจัดสรร, evidence digest |

- วันที่จับภาพ: 2026-09-14 (Asia/Bangkok)
- Seed: `palmtrack-acceptance-seed-v1` (synthetic)
- Fixture: `e2e/fixtures/population-valid.csv` 3 แถว (eligible 2) — ไม่ใช่ข้อมูลเกษตรกรจริง
- ภาพมีเฉพาะ digest/รหัสสังเคราะห์ ไม่มี PII, token หรือ signed URL
- หลักฐานนี้มาจาก local Supabase เท่านั้น ยังไม่ครอบคลุม hosted deployment
