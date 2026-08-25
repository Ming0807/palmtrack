# ADR-0003: IndexedDB device-local offline draft

- Status: Design draft — awaiting user review
- Date: 2026-08-25

## Context

ภาคสนามอาจสัญญาณไม่คงที่ ผู้เก็บต้องไม่สูญสิ่งที่กำลังกรอก แต่ bidirectional sync ต้องแก้ conflict, revocation และ multi-device consistency ซึ่งไม่เหมาะกับเวลา/ความเสี่ยง V1

## Decision

เก็บ form draft ใน browser IndexedDB บนอุปกรณ์เท่านั้น ลด PII เท่าที่ทำได้และแสดงสถานะ device-local ชัดเจน Submit ได้เมื่อ online หลัง server revalidate auth, assignment, consent, questionnaire version และ idempotency ไม่มี background/bidirectional sync และไม่มี server draft mirroring จากกลไก offline นี้

## Consequences

ผู้ใช้ทำงานต่อหลัง reload/offline ได้ แต่ draft อาจสูญเมื่อ clear browser/เปลี่ยนอุปกรณ์และมี shared-device privacy risk UI ต้องมีลบ draft/last saved/conflict state Success/withdrawal ต้อง clear หรือ invalidate draft และ tests ต้องจำลอง reconnect/revocation

## Rejected alternatives

- Full offline sync: conflict/security complexity สูง
- No offline support: เสี่ยงสูญงานภาคสนาม
- `localStorage`: typing/transaction/size และ structured form lifecycle ด้อยกว่า IndexedDB

## Links

[Architecture](../ARCHITECTURE.md) · [UX specification](../UX_SPEC.md) · [Test plan](../TEST_PLAN.md)
