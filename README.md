# PalmTrack

PalmTrack คือแหล่งข้อมูลออกแบบสำหรับเว็บแอปงานวิจัยนักศึกษาแบบไม่มีค่าใช้จ่าย ใช้จัดการการเก็บข้อมูลและบันทึกเศรษฐกิจสวนปาล์มน้ำมันในอำเภอศรีสาคร จังหวัดนราธิวาส เป้าหมายคือให้ทีม 2–3 คนพัฒนาและทำวิจัยให้เสร็จใน 4–6 เดือน โดยคุ้มครองข้อมูลส่วนบุคคลและทำให้การสุ่มตัวอย่างตรวจสอบย้อนกลับได้

## สถานะปัจจุบัน

Repository นี้อยู่ในระยะ **documentation only** และเอกสารทุกฉบับมีสถานะ **Design draft — awaiting user review** เอกสารกำหนดผลิตภัณฑ์ สถาปัตยกรรม ข้อมูล ความปลอดภัย การทดสอบ และการนำขึ้นระบบ แต่ยังไม่มี application code, runtime configuration, dependency, CI หรือ cloud resource ใด ๆ ห้ามวางแผนหรือเริ่ม implementation จนกว่าผู้ใช้จะอนุมัติ written design ผ่าน review gate ใน [design synthesis](docs/superpowers/specs/2026-08-25-palmtrack-student-research-design.md)

## ลำดับการอ่าน

1. [Documentation index](docs/INDEX.md)
2. [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
3. [Research protocol](docs/RESEARCH_PROTOCOL.md)
4. [Architecture](docs/ARCHITECTURE.md) และ [data model](docs/DATA_MODEL.md)
5. [UX specification](docs/UX_SPEC.md) และ [security/PDPA](docs/SECURITY_PDPA.md)
6. [Traceability matrix](docs/TRACEABILITY_MATRIX.md), [test plan](docs/TEST_PLAN.md), [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md), และ [roadmap](docs/ROADMAP.md)

ข้อผิดพลาดและเหตุการณ์ของการพัฒนา/tooling ที่ sanitize แล้วบันทึกใน [development error and incident ledger](LOG.md) ซึ่งไม่ใช่ application runtime logging

## วงจรพัฒนาที่วางแผนไว้

ออกแบบและอนุมัติเอกสาร → อนุมัติ questionnaire artifact แยกต่างหาก → วางแผน increment → พัฒนาแบบ vertical slice → ทดสอบตาม traceability → ทดลองกับข้อมูลสังเคราะห์ → review ความปลอดภัย/งานวิจัย → เปิดใช้แบบจำกัด → เก็บหลักฐานและสำรองข้อมูล → ปิดโครงการ/ส่งมอบ เอกสาร [roadmap](docs/ROADMAP.md) เป็น authoritative source ของลำดับและ gate

## เทคโนโลยีที่วางแผน

Next.js App Router แบบ modular monolith, Supabase Auth/PostgreSQL/RLS/private Storage, Vercel Hobby และ GitHub ทั้งหมดเป็นเพียงแผน ณ สถานะนี้ ข้อจำกัด free tier และวิธีสำรองแบบ zero-cost อยู่ใน [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md)

แนวทางการเปลี่ยนเอกสารและข้อห้ามด้านข้อมูลอยู่ใน [AGENTS.md](AGENTS.md)
