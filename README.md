# PalmTrack

PalmTrack คือเว็บแอปงานวิจัยนักศึกษาแบบไม่มีค่าใช้จ่ายสำหรับจัดการการเก็บข้อมูลและบันทึกเศรษฐกิจสวนปาล์มน้ำมันในอำเภอศรีสาคร จังหวัดนราธิวาส เป้าหมายคือให้ทีม 2–3 คนพัฒนาและทำวิจัยให้เสร็จใน 4–6 เดือน โดยคุ้มครองข้อมูลส่วนบุคคลและทำให้การสุ่มตัวอย่างตรวจสอบย้อนกลับได้

## สถานะปัจจุบัน

Repository มี **UX/UI prototype ที่รันได้** บน Next.js App Router พร้อมโครง A/B/C, เส้นทางแนะนำ A→C, IndexedDB checkpoint แบบสังเคราะห์ และ automated verification แล้ว ยังไม่มี authentication, Supabase/live API, CI, deployment หรือ cloud resource และยังห้ามเก็บข้อมูลจริงจน questionnaire/privacy/retention/restore gates ผ่านตาม [design synthesis](docs/superpowers/specs/2026-08-25-palmtrack-student-research-design.md) ภาษาภาพที่ implement แล้วอยู่ใน [design system](DESIGN.md)

## รัน prototype ในเครื่อง

ต้องใช้ Node.js `26.1.0` และ npm `11.5.2` ตาม `.node-version` และ lockfile

```bash
npm install
npm run dev
```

เปิด `/prototype/field?variant=A` แล้วใช้ switcher เพื่อเปรียบเทียบ A/B/C หรือเปิด `/prototype/field/SSK-024?variant=C` สำหรับเส้นทางหลักฐาน คำสั่งตรวจหลักคือ `npm run verify` และ `npm run test:e2e`

## ลำดับการอ่าน

1. [Product context](PRODUCT.md) และ [documentation index](docs/INDEX.md)
2. [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
3. [Research protocol](docs/RESEARCH_PROTOCOL.md)
4. [Architecture](docs/ARCHITECTURE.md) และ [data model](docs/DATA_MODEL.md)
5. [UX specification](docs/UX_SPEC.md) และ [security/PDPA](docs/SECURITY_PDPA.md)
6. [Traceability matrix](docs/TRACEABILITY_MATRIX.md), [test plan](docs/TEST_PLAN.md), [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md), และ [roadmap](docs/ROADMAP.md)

ข้อผิดพลาดและเหตุการณ์ของการพัฒนา/tooling ที่ sanitize แล้วบันทึกใน [development error and incident ledger](LOG.md) ซึ่งไม่ใช่ application runtime logging

## วงจรพัฒนา

ออกแบบและอนุมัติเอกสาร → อนุมัติ questionnaire artifact แยกต่างหาก → วางแผน increment → พัฒนาแบบ vertical slice → ทดสอบตาม traceability → ทดลองกับข้อมูลสังเคราะห์ → review ความปลอดภัย/งานวิจัย → เปิดใช้แบบจำกัด → เก็บหลักฐานและสำรองข้อมูล → ปิดโครงการ/ส่งมอบ เอกสาร [roadmap](docs/ROADMAP.md) เป็น authoritative source ของลำดับและ gate

## เทคโนโลยี

Prototype ใช้ Next.js App Router, React, TypeScript, Tailwind CSS, Fontsource, Lucide, Vitest และ Playwright โดยยังไม่มี live backend สถาปัตยกรรมเป้าหมายเพิ่ม Supabase Auth/PostgreSQL/RLS/private Storage, Vercel Hobby และ GitHub ตามแผน ข้อจำกัด free tier และวิธีสำรองแบบ zero-cost อยู่ใน [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md)

แนวทางการเปลี่ยนเอกสารและข้อห้ามด้านข้อมูลอยู่ใน [AGENTS.md](AGENTS.md)
