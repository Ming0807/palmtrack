# ADR-0002: Single workspace V1 with future-tenancy seam

- Status: Design draft — awaiting user review
- Date: 2026-08-25

## Context

V1 เป็นโครงการวิจัยเดียว การสร้าง tenant provisioning/switching/billing เพิ่ม UI, RLS และ recovery risk แต่ schema ที่ไม่รู้ขอบเขตเลยจะย้ายในอนาคตยาก

## Decision

Provision workspace เดียวและไม่มี tenant management/selector ใน V1 Root aggregate มี non-null `workspace_id`; child สืบ scope ผ่าน parent FK Auth profile มี active membership เดียว Helper/policy ใช้ workspace context ที่ server ตรวจ Future multi-tenancy ต้องเป็น migration/ADR ใหม่พร้อม isolation tests

## Consequences

V1 UX และ operation เรียบง่าย ขณะมี migration seam แต่ทุก query/index/policy ต้องเคารพ workspace และห้ามถือค่า client เป็น trusted การมี field นี้ไม่แปลว่าระบบรองรับหลาย tenant แล้ว

## Rejected alternatives

- Full multi-tenancy V1: เกิน scopeและเพิ่ม cross-tenant breach surface
- ไม่มี workspace key: ลดงานวันนี้แต่เพิ่ม risky backfill/ownership ambiguity

## Links

[Data model](../DATA_MODEL.md) · [Security and PDPA](../SECURITY_PDPA.md)
