# PalmTrack contribution instructions

ใช้ข้อกำหนดนี้กับมนุษย์และ automation ทุกชนิดใน repository

## Source-of-truth precedence

เมื่อข้อความขัดกัน ให้ใช้ลำดับ: (1) ADR ที่ผู้ใช้อนุมัติเป็น Accepted สำหรับการตัดสินใจเชิงสถาปัตยกรรม (2) `PRODUCT_REQUIREMENTS.md` สำหรับ scope/requirement (3) เอกสาร authoritative ตามตารางใน `docs/INDEX.md` (4) design synthesis (5) `README.md` หากยังขัดกันให้หยุดการเปลี่ยนแปลงและเสนอการแก้เอกสารต้นทางพร้อมผลกระทบ ห้ามทำให้ implementation กลายเป็น source of truth โดยปริยาย

## Change discipline

- เปลี่ยน requirement ด้วย stable ID และปรับ traceability/test/acceptance ที่เกี่ยวข้องใน commit เดียวกัน
- เปลี่ยนการตัดสินใจที่ Accepted ด้วย ADR ใหม่ซึ่ง supersede ของเดิม ห้ามแก้เหตุผลย้อนหลังแบบไร้ร่องรอย
- รักษา V1 เป็นหนึ่ง workspace; ไม่เพิ่ม multi-tenant UI หรือพฤติกรรมที่ขัดกับ `workspace_id` migration seam
- questionnaire จริงเป็น approved artifact แยกต่างหาก ห้ามแต่งคำถามหรือฝังคำถามก่อนผ่าน gate
- ใช้ภาษาไทยสำหรับ UI/เอกสารผู้ใช้ และใช้ technical identifier ภาษาอังกฤษเมื่อชัดกว่า
- ห้ามเพิ่ม runtime, dependency, CI หรือ cloud resource จนกว่า design review gate จะผ่านและมี implementation plan ที่อนุมัติ

## Security and data

- ห้าม commit ข้อมูลเกษตรกรจริง, PII, secret, credential, access token, provider key หรือ URL ที่แอบอ้างว่าเป็น production
- ใช้เฉพาะข้อมูลสังเคราะห์ที่ระบุชัดในการทดสอบ ไฟล์ทุกชนิด private และดาวน์โหลดผ่าน authorization ระดับ object
- export ปริยายต้อง anonymized; full-PII export จำกัด `admin` และ `research_manager` และต้อง audit
- authorization ต้องบังคับที่ server/database ด้วย RLS ไม่พึ่งการซ่อน UI
- การแก้ verified research record ต้องมีเหตุผลและ audit; withdrawal ต้องตัดข้อมูลออกจาก analysis/export ทันที

## Verification expectations

ทุกการเปลี่ยนต้องตรวจ relative links, คำต้องห้าม/secret pattern, requirement-to-test traceability, role/status/formula consistency และ Markdown rendering ที่มีผลต่อความหมาย เมื่อมี code ให้เพิ่ม automated unit/RLS/integration/E2E ตาม [test plan](docs/TEST_PLAN.md) และบันทึกหลักฐานการทดสอบใน PR/commit description โดยไม่ใส่ข้อมูลจริง
