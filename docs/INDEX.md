# ดัชนีเอกสาร PalmTrack

เอกสารชุดนี้เป็น source of truth สำหรับ V1 และมีสถานะ **Accepted for UX prototype and implementation planning** หลัง written-design review ผ่านและผู้ใช้สั่งเดินหน้าต่อเมื่อ 2026-08-25 การอนุมัตินี้ไม่ข้าม questionnaire, privacy/retention หรือ clean-target restore gates ก่อนใช้ข้อมูลจริง เจ้าของ (`Owner`) เป็นบทบาทรับผิดชอบ ไม่ใช่บัญชีผู้ใช้เฉพาะคน

| เอกสาร | สถานะ | Owner | วัตถุประสงค์ / authoritative source |
|---|---|---|---|
| [Product requirements](PRODUCT_REQUIREMENTS.md) | Accepted | research_manager | เป้าหมาย scope requirement ID และ acceptance |
| [Research protocol](RESEARCH_PROTOCOL.md) | Accepted with instrument gate | research_manager | population, sampling, consent, questionnaire contract, analysis eligibility |
| [Architecture](ARCHITECTURE.md) | Accepted | admin | system boundaries, module/data flow และ extension seam |
| [Data model](DATA_MODEL.md) | Accepted | admin | entity, key, lifecycle, precision, formula และ invariant |
| [UX specification](UX_SPEC.md) | Accepted for prototype | research_manager | Thai mobile-first IA, flow, screen state และ accessibility |
| [Security and PDPA](SECURITY_PDPA.md) | Accepted with real-data gates | admin | classification, authorization, RLS/storage, privacy และ incident control |
| [Traceability matrix](TRACEABILITY_MATRIX.md) | Accepted | research_manager | mapping requirement-to-evidence ครบทุก V1 ID |
| [Test plan](TEST_PLAN.md) | Accepted | admin | test level, stable test ID, fixture และ security negative |
| [Deployment runbook](DEPLOYMENT_RUNBOOK.md) | Accepted with restore gate | admin | environment, deploy/rollback, backup/restore และ free-tier risk |
| [Roadmap](ROADMAP.md) | Accepted | research_manager | phase, increment, approval gate, V1.1 และ non-goal |
| [ADR index](adr/README.md) | Accepted | admin | decision log และวิธี supersedeหลัง approval |
| [ADR-0001](adr/0001-nextjs-supabase-modular-monolith.md) | Accepted | admin | Next.js + Supabase modular monolith |
| [ADR-0002](adr/0002-single-workspace-future-tenancy.md) | Accepted | admin | single workspace และ future tenancy seam |
| [ADR-0003](adr/0003-indexeddb-offline-draft.md) | Accepted | admin | IndexedDB local draft, submit online |
| [ADR-0004](adr/0004-zero-cost-hosting-risk.md) | Accepted | admin | zero-cost hosting risk/backup |
| [Design synthesis](superpowers/specs/2026-08-25-palmtrack-student-research-design.md) | Accepted for UX prototype and implementation planning | research_manager | สรุป design และ implementation review gate |
| [Field UI direction](superpowers/specs/2026-08-25-palmtrack-field-ui-direction.md) | Accepted for prototype | research_manager | ทิศทาง queue-first + evidence route และเกณฑ์เปรียบเทียบ A/B/C |
| [UI decision comps](assets/ui-comps/README.md) | Review evidence | research_manager | ภาพเปรียบเทียบ A/B/C และ prompt provenance แบบ synthetic-only |
| [Implemented prototype screenshots](assets/ui-prototype/README.md) | Verified prototype evidence | research_manager | ภาพ mobile/desktop ของ queue-first และ evidence route ที่ implement แล้ว |
| [UX/UI prototype plan](superpowers/plans/2026-08-25-palmtrack-ui-prototype.md) | Approved for execution | admin | ขั้นตอน scaffold, test-first prototype, visual QA และ handoff ไป Safety Skeleton |

ไฟล์ระดับ root: [product context](../PRODUCT.md), [implemented design system](../DESIGN.md), [project overview](../README.md), [contribution instructions](../AGENTS.md) และ [sanitized development error/incident ledger](../LOG.md) (ไม่ใช่ application runtime log)

## Reading paths

- ผู้วิจัย: Product requirements → Research protocol → UX → Traceability → Test plan
- ผู้พัฒนา: Product requirements → ADRs → Architecture → Data model → Security → Test plan → Deployment
- ผู้ประเมิน: Product requirements → Research protocol → Traceability → หลักฐาน test ที่เกิดขึ้นภายหลัง
- ผู้ดูแลข้อมูล: Security → Research protocol → Data model → Deployment backup/restore

รายละเอียดกฎต้องอยู่เพียงเอกสาร authoritative ในตาราง เอกสารอื่นอ้างลิงก์และสรุปเฉพาะสิ่งที่ต้องใช้ในบริบทของตน
