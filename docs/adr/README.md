# Architecture decision records

ADR ชุดนี้เป็น **Design draft — awaiting user review** เมื่อผู้ใช้อนุมัติจึงเปลี่ยนสถานะเป็น Accepted และถือเหตุผล immutable ในสาระ หลังจากนั้นเมื่อเปลี่ยน decision ให้สร้าง ADR ใหม่ระบุ `Supersedes` และปรับ index/เอกสาร authoritative ห้าม rewrite trade-off เดิมแบบไม่มีร่องรอย

| ADR | Status | Decision |
|---|---|---|
| [0001](0001-nextjs-supabase-modular-monolith.md) | Design draft — awaiting user review | Next.js + Supabase modular monolith |
| [0002](0002-single-workspace-future-tenancy.md) | Design draft — awaiting user review | one workspace V1 with tenancy seam |
| [0003](0003-indexeddb-offline-draft.md) | Design draft — awaiting user review | device-local draft, submit online |
| [0004](0004-zero-cost-hosting-risk.md) | Design draft — awaiting user review | zero-cost hosting with explicit operational risk |

Template ขั้นต่ำสำหรับ ADR ต่อไป: Title, Status/Date, Context, Decision, Consequences, Rejected alternatives, Links และ Supersedes/Superseded by ถ้ามี
