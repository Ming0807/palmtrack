# UX specification

## Experience principles and IA

UI ภาษาไทยเป็นหลัก, mobile-first และออกแบบงานภาคสนามที่เครือข่ายไม่แน่นอน Header แสดงชื่อพื้นที่ทำงานเดียวโดยไม่มี tenant switcher วันที่แสดง พ.ศ. และเวลา Asia/Bangkok พร้อม label เขตเวลาเมื่อเป็นหลักฐาน

| Role | Primary navigation |
|---|---|
| `admin` | ภาพรวมระบบ, ผู้ใช้/บทบาท/workspace/reference config, audit, population import, PII export, การกู้คืน |
| `research_manager` | ภาพรวมวิจัย, ประชากร, การสุ่ม, งานภาคสนาม, ตรวจคำตอบ, export |
| `field_collector` | งานของฉัน, consent/withdrawal, farmer/farm baseline, แบบฟอร์มที่กำลังกรอก, ประวัติส่ง |
| `farmer` | สวนของฉัน, แปลง, กิจกรรม, ค่าใช้จ่าย, เก็บเกี่ยว, ขาย, กำไร/ขาดทุน |
| `evaluator_readonly` | ภาพรวม anonymized, methodology/evidence, รายงานอ่านอย่างเดียว |

Navigation/filter ทุกหน้าเป็น convenience; server authorization เป็นตัวตัดสินสิทธิ์

## Primary flows

### Research manager

นำเข้าประชากร → ดู validation summary/ดาวน์โหลด error แบบจำกัด PII → ยืนยัน eligible snapshot → สร้าง workspace sampling run draft → กรอก N/e/seed → preview Yamane/allocation/algorithm evidence → replay check → lock → activate (supersede active เดิม) → assign collector → monitor funnel → review submitted response → verify หรือ return พร้อม reason → export anonymized ค่า default สำหรับ verified correction ผู้จัดการเลือก “ส่งกลับเพื่อแก้ไข” จาก verified, กรอก correction reason และเห็น snapshot เดิมแบบ read-only; ไม่มี control แก้ answer/capture consent/farm ledger

หน้าสุ่มต้องแสดงสูตร, input, unrounded/rounded n, ตาราง `N_h/quota/floor/remainder/final`, seed digest, `sha256-mulberry32-fy-v1`, ordered candidate-set hash และ result digest ปุ่ม Lock ต้องมี confirmation ว่าแก้ไม่ได้ หน้ารายงานใช้ active run โดย default และ historical mode ต้องให้เลือก superseded version พร้อม label ชัด; cancelled เลือกไม่ได้

### Field collector

เปิด “งานของฉัน” → ดูข้อมูลติดต่อเท่าที่จำเป็น → **แสดง privacy notice ก่อน** → บันทึก `granted` หรือ `declined` หาก declined แสดง receipt แบบ minimal และจบ collection โดยไม่มี baseline/response หาก granted จึงสร้าง/แก้ farmer/farm baseline และ response `draft` → ตรวจข้อผิดพลาด → เชื่อม online และ `draft→submitted` หาก manager return ระบบแสดง required reason แต่ fields เป็น read-only; collector กด “เริ่มแก้ไข” เพื่อส่ง status-only `returned→draft` โดยห้ามเปลี่ยน answer/baseline request เดียวกัน เมื่อ server ยืนยัน draft แล้วจึง unlock fields ให้แก้และ submit ใหม่ หลัง submitted/verified/withdrawn แก้ไม่ได้และ collectorไม่มี return/verify control

### Farmer ledger

เลือกสวน/แปลง → เพิ่ม activity/expense/harvest → เพิ่ม sale โดยเลือก farm บังคับ, plot ไม่บังคับ และ harvest ไม่บังคับได้หนึ่งรายการ → เห็น gross/net preview → ดู cash profit/loss ตามช่วงพร้อมยอดขาย/ค่าใช้จ่ายและรายการ drill-down Active/deleted status ต้องชัดและ deletion ขอเหตุผล/สร้าง audit

### Withdrawal

ผู้เข้าร่วมส่ง request ตามช่องทางที่อนุมัติ → manager assign/reassign collector ผู้ดำเนินการโดยไม่แก้ consent → assigned collector ยืนยันตัวตน/คำขอตาม protocol → หาก response อยู่ exactly `draft|submitted|returned|verified` แสดงผลที่จะ lock/exclude → บันทึก required withdrawal reason code → เปลี่ยน current consent/response เป็น withdrawn → แสดง minimal receipt และสถานะ terminal “ถอนแล้ว—ไม่รวมในการเก็บ/วิเคราะห์” โดยไม่แสดง answer

## Screen-state contract

ทุกหน้าข้อมูลมี `loading`, `empty`, `ready`, `validation_error`, `forbidden`, `not_found`, `conflict/stale`, `offline`, `service_unavailable` และ `success` ที่แยกชัด Empty state บอกเหตุผล/next action ที่ผู้ใช้มีสิทธิ์ Forbidden ไม่บอกว่าข้อมูลเป้าหมายมีอยู่หรือไม่ Conflict ห้ามทับข้อมูลและให้ refresh/review Service unavailable รักษา input ที่ไม่ sensitive เท่าที่ปลอดภัย

Form ใช้ inline error เชื่อม label และมี error summary; ปุ่ม submit ป้องกันกดซ้ำแต่ idempotency อยู่ server Confirmation จำเป็นสำหรับ lock sample, withdrawal, full-PII export, delete/restore และ verified correction Success สำคัญแสดง reference ID/time และ next state

## Validation and warnings

- จำนวนเงินรับเลขทศนิยมไม่เกิน 2; น้ำหนัก/พื้นที่ไม่เกิน 3; แสดงหน่วยข้าง field และไม่ parse separator แบบกำกวม
- Date picker แสดง พ.ศ. แต่ส่ง Gregorian date; audit timestamp แสดง Asia/Bangkok พร้อม UTC ใน evidence detail
- Privacy notice version ต้องถูก present ก่อนเปิด consent control; consent ห้าม preselect ถ้า `declined` ห้ามสร้าง baseline/response และถ้า withdrawn ให้ซ่อน/disable questionnaire แบบ terminal
- Sampling lock blocked เมื่อ seed normalization/digest, candidate hash, replay หรือ allocation ไม่ผ่าน หรือ strata รวมไม่เท่า target; activate blocked หาก run ไม่ใช่ locked
- Sale แสดง `quantity × unit_price = gross_amount`, deductions และ `net_amount`; warning เมื่อค่าผิดสูตร
- Full-PII export แสดง purpose/reason field, scope/row estimate, privacy warning และ second confirmation

## Offline draft

แถบสถานะแยก “ออฟไลน์—บันทึกในเครื่องแล้ว” จาก “ส่งเข้าระบบแล้ว” Draft มี last-saved time/device-only label และปุ่มลบ ผู้ใช้ submit ไม่ได้เมื่อ offline; เมื่อ online ระบบ revalidate session, assignment, consent และ version หาก conflict ให้หยุดและอธิบาย ห้าม merge สองทางหรือถือ local draft เป็น authoritative ดู flow ใน [Architecture](ARCHITECTURE.md)

ไม่ควรเก็บ PII ใน draft เกินจำเป็น; shared device มีคำเตือนออกจากระบบ/ลบ draft และ IndexedDB clear หลัง server receipt หรือ withdrawal confirmation

## Responsive and accessibility

ที่ 360 px งานหลักใช้ single column, touch target อย่างน้อย 44×44 CSS px, table สำคัญเปลี่ยนเป็น card หรือ horizontal region ที่มี label ไม่ตัด column เงียบ Desktop เพิ่ม side navigation/parallel detail แต่ flow เดิม

ใช้ semantic HTML, heading order, explicit labels, keyboard reachability, visible focus, skip link, error/status live region และ contrast WCAG 2.1 AA ไม่ใช้สี/ไอคอนอย่างเดียวสื่อ status Chart ทุกอันมี text/table equivalent, locale number อ่านได้, dialog จัด focus/คืน focus และ session timeout เตือนก่อนพร้อมทางรักษา local draft ที่ปลอดภัย
