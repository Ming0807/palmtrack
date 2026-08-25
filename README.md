# PalmTrack

PalmTrack คือเว็บแอปงานวิจัยนักศึกษาแบบไม่มีค่าใช้จ่ายสำหรับจัดการการเก็บข้อมูลและบันทึกเศรษฐกิจสวนปาล์มน้ำมันในอำเภอศรีสาคร จังหวัดนราธิวาส เป้าหมายคือให้ทีม 2–3 คนพัฒนาและทำวิจัยให้เสร็จใน 4–6 เดือน โดยคุ้มครองข้อมูลส่วนบุคคลและทำให้การสุ่มตัวอย่างตรวจสอบย้อนกลับได้

## สถานะปัจจุบัน

Repository มี Safety Skeleton และ vertical slice **นำเข้าประชากรสังเคราะห์** ที่ใช้งานกับ Supabase local ได้แล้ว: strict CSV validation, atomic RPC, immutable accepted snapshot, exact admin/research-manager authorization, audit, Thai responsive UI และ fail-closed local E2E Migration `202608250001` ถูก apply ไป hosted Supabase และผ่าน pgTAP 55/55 ทั้ง local/hosted ส่วน `202608250002` ผ่าน local pgTAP รวม 98 assertions แต่ **ยังไม่ apply ไป hosted**; ยังไม่มี CI หรือ production deployment และห้ามเก็บข้อมูลจริงจน questionnaire/privacy/retention/restore gates ผ่านตาม [design synthesis](docs/superpowers/specs/2026-08-25-palmtrack-student-research-design.md) ภาษาภาพที่ implement แล้วอยู่ใน [design system](DESIGN.md)

## รันในเครื่อง

ต้องใช้ Node.js `26.1.0` และ npm `11.5.2` ตาม `.node-version` และ lockfile

```bash
npm ci
npm run dev
```

เปิด `/` สำหรับ production entry ซึ่งจะไป `/sign-in`; หากยังไม่มี `.env.local` ระบบต้องแสดงสถานะ `ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน` โดยไม่สร้างผู้ใช้จำลอง คัดลอกชื่อค่าจาก `.env.example` เมื่อต้องเชื่อม Supabase ที่ได้รับอนุญาต เปิด `/prototype/field?variant=A` โดยตรงเมื่อต้อง review prototype เท่านั้น คำสั่งตรวจหลักคือ `npm run verify` และ `npm run test:e2e`; database/RLS test แบบ local ต้องมี Docker engine แล้วใช้ `npx supabase start`, `npm run test:db` และ `npm run lint:db` ส่วน authenticated local journey ใช้ `npm run test:e2e:local -- e2e/population-import.spec.ts` ซึ่งรับเฉพาะ loopback Supabase และ reset synthetic state ก่อน/หลังรัน

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

ระบบใช้ Next.js App Router, React, TypeScript, Tailwind CSS, Fontsource, Lucide, Vitest และ Playwright พร้อม Supabase SSR/JavaScript clients, Zod และ Supabase CLI ที่ pin version แล้ว Supabase hosted มีเฉพาะ Safety Skeleton schema/RLS/audit foundation จาก migration `202608250001` และยังไม่มีข้อมูลจริง; migration ประชากร `202608250002`, private Storage, Vercel deployment และ CI เป็นขั้นถัดไปตามแผน ส่วน GitHub remote ถูกตั้งค่าไว้แต่ยังไม่ push การเปลี่ยนแปลงรอบนี้ ข้อจำกัด free tier และวิธีสำรองแบบ zero-cost อยู่ใน [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md)

แนวทางการเปลี่ยนเอกสารและข้อห้ามด้านข้อมูลอยู่ใน [AGENTS.md](AGENTS.md)
