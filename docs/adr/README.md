# Architecture decision records

ADR ชุดนี้มีสถานะ **Accepted** หลัง written-design review และการอนุมัติเมื่อ 2026-08-25 เหตุผลจึง immutable ในสาระ หลังจากนี้เมื่อเปลี่ยน decision ให้สร้าง ADR ใหม่ระบุ `Supersedes` และปรับ index/เอกสาร authoritative ห้าม rewrite trade-off เดิมแบบไม่มีร่องรอย

| ADR | Status | Decision |
|---|---|---|
| [0001](0001-nextjs-supabase-modular-monolith.md) | Accepted | Next.js + Supabase modular monolith |
| [0002](0002-single-workspace-future-tenancy.md) | Accepted | one workspace V1 with tenancy seam |
| [0003](0003-indexeddb-offline-draft.md) | Accepted | device-local draft, submit online |
| [0004](0004-zero-cost-hosting-risk.md) | Accepted | zero-cost hosting with explicit operational risk |

Template ขั้นต่ำสำหรับ ADR ต่อไป: Title, Status/Date, Context, Decision, Consequences, Rejected alternatives, Links และ Supersedes/Superseded by ถ้ามี
