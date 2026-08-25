# ADR-0004: Zero-cost hosting with explicit risk

- Status: Design draft — awaiting user review
- Date: 2026-08-25

## Context

โครงการนักศึกษาไม่มีงบและไม่ใช่เชิงพาณิชย์ แต่ข้อมูลวิจัย/PII ต้อง private และ recoverable Free services มี quota/terms/outage/cold-start risk; Supabase Free ไม่มี automatic backups ที่โครงการควรอ้างพึ่ง

## Decision

วางแผน Vercel Hobby, Supabase Free และ GitHub ภายในข้อกำหนด non-commercial/student research ไม่อ้าง SLA หรือ provider backup guarantee ใช้ manual encrypted database/storage/identity-manifest backup พร้อม checksum และ clean-target restore/Auth relink/sign-in drill; password hashes/sessions/tokens กู้คืนไม่ได้และผู้ใช้ต้อง credential reset ตรวจ quota/terms ก่อน deployและระหว่าง collection หาก control จำเป็นทำไม่ได้ให้หยุด/ลด scope/ขอทรัพยากรที่อนุมัติ

## Consequences

ต้นทุนเงินเป็นศูนย์แต่ต้นทุน operation สูงขึ้น ทีมต้องสำรองหลังวันเก็บข้อมูล/ก่อน migration, มี restore evidence และยอมรับ outage Research schedule ต้องมี buffer และ manual fallback ที่ไม่ลด consent/privacy

## Rejected alternatives

- Assume provider continuity/backup: ไม่มีหลักฐานและเสี่ยงสูญข้อมูล
- Store backup in GitHub/public drive: privacy/secret/size risk
- Claim production-grade availability: ไม่เหมาะกับ free tier และ project purpose

## Links

[Deployment runbook](../DEPLOYMENT_RUNBOOK.md) · [Security and PDPA](../SECURITY_PDPA.md)
