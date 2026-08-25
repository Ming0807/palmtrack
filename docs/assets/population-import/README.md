# Population import visual evidence

ภาพหน้าจอใช้ข้อมูลสังเคราะห์จาก `e2e/fixtures/population-valid.csv` เท่านั้น และสร้างจาก route `/app/research/population` หลังรับ snapshot แล้ว

| ไฟล์ | Viewport | หลักฐาน |
|---|---:|---|
| `mobile.png` | 360 × 800 | layout มือถือ ไม่มี horizontal overflow |
| `desktop.png` | 1365 × 900 | evidence sheet และ immutable receipt |

- วันที่ตรวจ: 2026-08-25
- Branch: `codex/population-import`
- Fixture SHA-256: `eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b`
- ห้ามใช้ภาพนี้เป็นหลักฐานของ hosted deployment; เป็น local Supabase evidence เท่านั้น
