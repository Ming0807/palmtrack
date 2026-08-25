# ดัชนีเอกสาร PalmTrack

เอกสารชุดนี้เป็น source of truth ฉบับร่างสำหรับ V1 สถานะทุกฉบับคือ **Design draft — awaiting user review** ห้ามวางแผนหรือเริ่ม implementation จนกว่าผู้ใช้จะอนุมัติ written design ผ่าน gate ใน design synthesis เจ้าของ (`Owner`) เป็นบทบาทรับผิดชอบ ไม่ใช่บัญชีผู้ใช้เฉพาะคน

| เอกสาร | สถานะ | Owner | วัตถุประสงค์ / authoritative source |
|---|---|---|---|
| [Product requirements](PRODUCT_REQUIREMENTS.md) | Design draft — awaiting user review | research_manager | เป้าหมาย scope requirement ID และ acceptance |
| [Research protocol](RESEARCH_PROTOCOL.md) | Design draft — awaiting user review | research_manager | population, sampling, consent, questionnaire contract, analysis eligibility |
| [Architecture](ARCHITECTURE.md) | Design draft — awaiting user review | admin | system boundaries, module/data flow และ extension seam |
| [Data model](DATA_MODEL.md) | Design draft — awaiting user review | admin | entity, key, lifecycle, precision, formula และ invariant |
| [UX specification](UX_SPEC.md) | Design draft — awaiting user review | research_manager | Thai mobile-first IA, flow, screen state และ accessibility |
| [Security and PDPA](SECURITY_PDPA.md) | Design draft — awaiting user review | admin | classification, authorization, RLS/storage, privacy และ incident control |
| [Traceability matrix](TRACEABILITY_MATRIX.md) | Design draft — awaiting user review | research_manager | mapping requirement-to-evidence ครบทุก V1 ID |
| [Test plan](TEST_PLAN.md) | Design draft — awaiting user review | admin | test level, stable test ID, fixture และ security negative |
| [Deployment runbook](DEPLOYMENT_RUNBOOK.md) | Design draft — awaiting user review | admin | environment, deploy/rollback, backup/restore และ free-tier risk |
| [Roadmap](ROADMAP.md) | Design draft — awaiting user review | research_manager | phase, increment, approval gate, V1.1 และ non-goal |
| [ADR index](adr/README.md) | Design draft — awaiting user review | admin | decision log และวิธี supersedeหลัง approval |
| [ADR-0001](adr/0001-nextjs-supabase-modular-monolith.md) | Design draft — awaiting user review | admin | Next.js + Supabase modular monolith |
| [ADR-0002](adr/0002-single-workspace-future-tenancy.md) | Design draft — awaiting user review | admin | single workspace และ future tenancy seam |
| [ADR-0003](adr/0003-indexeddb-offline-draft.md) | Design draft — awaiting user review | admin | IndexedDB local draft, submit online |
| [ADR-0004](adr/0004-zero-cost-hosting-risk.md) | Design draft — awaiting user review | admin | zero-cost hosting risk/backup |
| [Design synthesis](superpowers/specs/2026-08-25-palmtrack-student-research-design.md) | Design draft — awaiting user review | research_manager | สรุป design และ implementation review gate |

ไฟล์ระดับ root: [project overview](../README.md), [contribution instructions](../AGENTS.md) และ [sanitized development error/incident ledger](../LOG.md) (ไม่ใช่ application runtime log)

## Reading paths

- ผู้วิจัย: Product requirements → Research protocol → UX → Traceability → Test plan
- ผู้พัฒนา: Product requirements → ADRs → Architecture → Data model → Security → Test plan → Deployment
- ผู้ประเมิน: Product requirements → Research protocol → Traceability → หลักฐาน test ที่เกิดขึ้นภายหลัง
- ผู้ดูแลข้อมูล: Security → Research protocol → Data model → Deployment backup/restore

รายละเอียดกฎต้องอยู่เพียงเอกสาร authoritative ในตาราง เอกสารอื่นอ้างลิงก์และสรุปเฉพาะสิ่งที่ต้องใช้ในบริบทของตน
