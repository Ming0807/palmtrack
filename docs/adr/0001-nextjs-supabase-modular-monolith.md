# ADR-0001: Next.js and Supabase modular monolith

- Status: Accepted (2026-08-25)
- Date: 2026-08-25

## Context

ทีม 2–3 คนมีเวลา 4–6 เดือน ต้องทำ Thai web UI, auth, relational integrity, private files, auditable research workflow และ zero-cost deployment Microservices เพิ่ม deployment/consistency/observability burden ที่ไม่ช่วยเป้าหมายวิจัย

## Decision

วางแผน Next.js App Router เป็น modular monolith หนึ่ง deploy บน Vercel Hobby แยก in-process modules Identity, Research, Farm ledger, Reporting/export, Files, Audit ใช้ Supabase Auth, PostgreSQL พร้อม RLS และ private Storage Schema migration/review และ server-side transaction เป็นจุดบังคับ invariant

## Consequences

ทีม deploy/debug ง่ายและ transaction ข้าม entity ทำได้ แต่ต้องรักษา module boundary ไม่ query table กันโดยไร้ contract, ทดสอบ RLS แยกจาก UI และรับ vendor/free-tier constraints Application deploy กับ database migrationต้อง compatible/rollback ได้

## Rejected alternatives

- Microservices/serverless function per domain: operational overhead และ distributed consistency สูงเกินขนาดทีม
- Firebase/document store: relational workflow/report/RLS-like policies และ reproducible evidence ไม่ตรงเท่า PostgreSQL
- Custom auth/file server: เพิ่ม security surface และงานดูแล

## Links

[Architecture](../ARCHITECTURE.md) · [Deployment runbook](../DEPLOYMENT_RUNBOOK.md)
