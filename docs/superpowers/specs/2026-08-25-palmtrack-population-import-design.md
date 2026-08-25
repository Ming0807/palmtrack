# PalmTrack population import design

- Date: 2026-08-25
- Status: Approved for implementation under the accepted roadmap and the user's autonomous-continuation instruction
- Scope: FR-02 tracer bullet only; single workspace; synthetic data only

## Job and audience

`admin` และ `research_manager` ต้องนำเข้ารายชื่อประชากรที่ลดข้อมูลเหลือเฉพาะรหัสสังเคราะห์ ตรวจข้อผิดพลาดทั้งชุด และยืนยัน snapshot ที่ใช้เป็น input ของการสุ่มใน increment ถัดไป งานนี้ต้องทำบนมือถือได้แต่เหมาะกับ desktop/tablet มากกว่า และต้องไม่ทำให้ผู้ใช้เข้าใจผิดว่าไฟล์จริงหรือข้อมูลส่วนบุคคลได้รับอนุญาตแล้ว

## Approaches considered

1. **Population import tracer bullet — selected.** ส่งมอบ CSV → validation → atomic persistence → immutable accepted snapshot → RLS/audit → Thai UI ครบแนวดิ่ง ทำให้ review ความปลอดภัยและ contract ของข้อมูลได้ก่อนเพิ่ม sampling algorithm
2. **Population and sampling together.** ลดจำนวน migration แต่รวม import, deterministic algorithm และ lifecycle lock/activate ไว้ใน review เดียว ทำให้ความเสี่ยง SQL/RLS/audit สูงเกิน slice แรก
3. **Read-only sampling preview.** แสดงสูตรและ evidence ได้เร็ว แต่ยังไม่สร้างระบบนำเข้าที่ใช้งานจริงและไม่พิสูจน์ authorization/atomicity

## Outcome and proof

ผู้มีสิทธิ์อัปโหลด CSV สังเคราะห์ขนาดไม่เกิน 1 MiB ซึ่งใช้ UTF-8 และมี header ตรงตามลำดับ `farmer_code,stratum_code,eligible,exclusion_reason_code` ระบบตรวจทั้งไฟล์ก่อนเขียนฐานข้อมูล แสดงจำนวนทั้งหมด/ผ่าน/ไม่ผ่านและ error reason ต่อแถวโดยไม่สะท้อนค่าดิบที่อาจเป็น PII ผู้ใช้แก้ไฟล์ต้นทางแล้วนำเข้าใหม่; UI ไม่มี inline row editor

เมื่อ validation ผ่าน ผู้ใช้ยืนยันด้วย `source_label`, `reference_date`, synthetic source authorization reference, schema version คงที่ `synthetic-population-v1` และ eligibility rule version คงที่ `synthetic-eligibility-v1` Server ส่ง normalized rows และ SHA-256 input digest ไป RPC transaction เดียวเพื่อสร้าง `population_import` และ `population_member` ทั้งชุดพร้อม audit หากแถวใดผิด transaction ต้องไม่เหลือ partial batch ผู้ใช้กดยอมรับ batch เพื่อเปลี่ยน `validated → accepted`; accepted batch และสมาชิกแก้ไข/ลบไม่ได้ และ sampling slice ภายหลังจะอ้าง batch นี้เป็น immutable snapshot Contract สังเคราะห์นี้ไม่ถือเป็นการอนุมัติ source หรือ eligibility rule สำหรับข้อมูลจริง

หลักฐานตรวจรับของ slice คือ `FR-02`, `FR-15`, `NFR-01`, `NFR-03`, `NFR-05`, `NFR-06`, `NFR-08` ผ่าน `INT-01`, `E2E-02`, `E2E-15`, `SEC-02`, `RLS-09` ส่วน sampling IDs และ sampling lifecycle ยังไม่ถูกอ้างว่าเสร็จ

## Data and lifecycle

`population_import` มี `workspace_id`, `source_label`, `source_authorization_ref`, `reference_date`, `schema_version`, `eligibility_rule_version`, `input_digest`, `total_count`, `eligible_count`, `excluded_count`, `status`, attribution และ timestamps โดย status ของ slice นี้มี `validated | accepted` เท่านั้น ไฟล์ที่ validation ไม่ผ่านไม่ถูก persist จึงไม่มี persisted `rejected` row `accepted_at` ตั้งครั้งเดียวพร้อม audit

`population_member` มี parent import, `farmer_code`, `stratum_code`, `eligible`, optional `exclusion_reason_code` และ canonical `row_number` รหัสต้องเป็นตัวพิมพ์ใหญ่ ASCII รูปแบบ `SYN-[0-9]{3,6}` สำหรับ slice สังเคราะห์, `stratum_code` เป็นตัวพิมพ์ใหญ่ ASCII `[A-Z0-9_-]{1,24}`, `eligible=true` ต้องไม่มี exclusion reason และ `eligible=false` ต้องมี reason จาก allowlist `OUT_OF_SCOPE | DUPLICATE_SOURCE | INELIGIBLE_RULE` ห้ามมีชื่อ เบอร์โทร ที่อยู่ พิกัด หรือ free text ใน schema นี้

Digest คำนวณจาก UTF-8 canonical rows ที่เรียงตาม `row_number` และใช้ line ending `\n`; server และ database ตรวจจำนวน, uniqueness, field allowlist และ digest ที่ส่งมาซ้ำก่อน commit Direct table insert/update/delete จาก API role ถูกปฏิเสธ; write ทำผ่าน RPC ที่ตรวจ exact role และ workspace จาก verified profile เท่านั้น

## Surface and interaction

หน้า production อยู่ที่ `/app/research/population` และสืบทอด visual system minimal-premium ที่ implement แล้ว:

- แถบหัวเรื่องระบุ workspace เดียวและ badge `ข้อมูลสังเคราะห์เท่านั้น`
- ขั้นตอนเรียงเป็น `เลือกไฟล์ → ตรวจทั้งชุด → ยืนยันแหล่งข้อมูล → รับ snapshot` บน evidence route เดียว ไม่ใช้ grid ของ KPI cards
- validation summary ใช้ตัวเลขหลักสามค่าและรายการ error แบบ row/reason ที่ไม่ echo raw cell; error download เป็น CSV ที่มีเพียง `row_number,reason_code,field_code`
- confirmation แสดง source authorization reference และ eligibility rule version ที่ใช้กับ fixture สังเคราะห์อย่างชัดเจน; ไม่มี control เปลี่ยนเป็น rule จริงใน slice นี้
- accepted snapshot แสดง digest แบบย่อพร้อม control คัดลอกค่าเต็ม, actor/time ไทย และสถานะ immutable ไม่มีปุ่มแก้ไข
- control ที่ยังไม่ทำงานจริง เช่น `สร้างการสุ่ม`, assignment หรือ export ไม่แสดงเป็น enabled action; อาจแสดงข้อความลำดับถัดไปแบบ read-only

Mobile 360 px ใช้ step stack และ error rows แบบ key/value; desktop ใช้ ruled evidence sheet ความกว้างอ่านง่าย ปุ่มหลักสูงอย่างน้อย 44 px, focus ชัด, status ใช้ข้อความร่วมกับ icon/shape และ error summary ประกาศผ่าน live region

## States and errors

- `idle`: อธิบาย contract และยังไม่มีไฟล์
- `validating`: ปิด submit ซ้ำและประกาศความคืบหน้าโดยไม่อ้าง upload สำเร็จ
- `invalid`: แสดง summary กับ sanitized row errors; ห้ามเขียน database
- `ready`: validation ผ่านและรอ metadata/confirmation
- `submitting`: transaction กำลังทำงานและ idempotency key ป้องกัน double submit
- `accepted`: แสดง immutable receipt และลิงก์กลับรายการ batch
- `forbidden`/`not_found`: ใช้ non-enumerating identity state เดิม
- `conflict`: digest/idempotency ซ้ำหรือ active source เปลี่ยน ให้ refresh/review ไม่ overwrite
- `offline`/`service_unavailable`: เก็บไฟล์ไว้เฉพาะ memory ของหน้า ไม่ persist CSV ใน IndexedDB และไม่ claim ว่าส่งแล้ว

ข้อความผิดพลาด client ไม่แสดง SQL, stack, Auth UID, database identifier หรือค่าดิบจากไฟล์ Event log ใช้ safe projection และ `LOG.md` รับเฉพาะ development incident ที่ sanitize แล้ว

## Boundaries and anti-goals

- ไม่ apply migration ไป hosted Supabase ในรอบนี้; ผู้ใช้เป็นผู้รัน SQL ภายหลัง
- ไม่สร้าง sampling calculation, lock/activate, assignment, questionnaire, consent, answer หรือ response
- ไม่รับ real farmer data และไม่เพิ่ม PII columns, Storage bucket, service-role browser access หรือ tenant selector
- ไม่แก้ requirement authoritative; implementation ต้องใช้ stable IDs และปรับ traceability evidence status โดยไม่กล่าวอ้างว่า FR-03 สำเร็จ
- accepted snapshot ไม่มี rollback แบบแก้ย้อนหลัง การแก้ข้อมูลคือ import batch ใหม่ตาม Research protocol

## Verification contract

- Domain tests ต้องพิสูจน์ CSV header/encoding/size, duplicate code, eligibility/reason pair, canonicalization, digest และ sanitized error projection ด้วย test-first red/green evidence
- pgTAP ต้องพิสูจน์ exact admin/manager positive paths สำหรับ create/accept/list, other-role/anonymous/cross-workspace negatives, atomic failure, validated→accepted เพียง transition เดียว, immutable accepted rows, idempotency, provenance fields และ exact audit before/after fields
- Component/E2E ต้องพิสูจน์ Thai flow, both authorized roles, non-enumerating denied roles, double-submit protection, invalid-file no-write, 360 px no overflow, keyboard operation และ axe serious/critical clean
- Full verification ใช้ local Supabase/Docker เท่านั้น พร้อม `npm run verify`, `npm run test:e2e`, `npx supabase test db`, secret scan, documentation link/marker scan และ migration lint
