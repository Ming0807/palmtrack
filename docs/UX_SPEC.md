# UX specification

## Experience principles and IA

UI ภาษาไทยเป็นหลัก, mobile-first และออกแบบงานภาคสนามที่เครือข่ายไม่แน่นอน Header แสดงชื่อพื้นที่ทำงานเดียวโดยไม่มี tenant switcher วันที่แสดง พ.ศ. และเวลา Asia/Bangkok พร้อม label เขตเวลาเมื่อเป็นหลักฐาน

| Role | Primary navigation |
|---|---|
| `admin` | ภาพรวม, ผู้ใช้/บทบาท/workspace/reference config, audit, population import, PII export, การกู้คืน |
| `research_manager` | ภาพรวม, งานวิจัย, ประชากร, การสุ่ม, งานภาคสนาม, ตรวจคำตอบ, export |
| `field_collector` | ภาพรวม, งานของฉัน, consent/withdrawal, farmer/farm baseline, แบบฟอร์มที่กำลังกรอก, ประวัติส่ง |
| `farmer` | ภาพรวม, สวนของฉัน, แปลง, กิจกรรม, ค่าใช้จ่าย, เก็บเกี่ยว, ขาย, กำไร/ขาดทุน |
| `evaluator_readonly` | ภาพรวม, ผลรวม anonymized, methodology/evidence, รายงานอ่านอย่างเดียว |

Navigation/filter ทุกหน้าเป็น convenience; server authorization เป็นตัวตัดสินสิทธิ์

### Product dashboard

หน้า `/app` ใช้ลำดับคงที่: สรุปการดำเนินงานสวน → แนวโน้มการเงิน/ผลผลิต → งานที่ควรทำต่อของบทบาท → หลักฐานสนับสนุนงานวิจัย ส่วนวิจัยต้องมีน้ำหนักภาพต่ำกว่างานสวน Farmer/collector ไม่เห็น research link ที่ไม่ได้รับสิทธิ์ และ action ของโมดูลที่ยังไม่มี backend แสดง `รอเปิดใช้งาน` แบบไม่กดได้แทนลิงก์ลวง Production provider ห้าม import fixture; cash/harvest แสดง `not_enabled` จนมี farm-ledger aggregate จริง ส่วน prototype ต้องระบุ `ข้อมูลสังเคราะห์`, สลับห้าบทบาทและสถานะ `typical|empty|loading|partial|unavailable` ได้ด้วย URL ที่ทำซ้ำได้ Chart มีตารางข้อความเทียบเท่าเสมอ

## Primary flows

### Research manager

นำเข้าประชากร → ดู validation summary/ดาวน์โหลด error แบบจำกัด PII → ยืนยัน eligible snapshot → สร้าง workspace sampling run draft → กรอก N/e/seed → preview Yamane/allocation/algorithm evidence → replay check → lock → activate (supersede active เดิม) → assign collector → monitor funnel → review submitted response → verify หรือ return พร้อม reason → export anonymized ค่า default สำหรับ verified correction ผู้จัดการเลือก “ส่งกลับเพื่อแก้ไข” จาก verified, กรอก correction reason และเห็น snapshot เดิมแบบ read-only; ไม่มี control แก้ answer/capture consent/farm ledger

หน้าสุ่มต้องแสดงสูตร, input, unrounded/rounded n, ตาราง `N_h/quota/floor/remainder/final`, seed digest, `sha256-mulberry32-fy-v1`, ordered candidate-set hash และ ordered result hash ตาม contract `ordered-result-sha256-v1` ปุ่ม Lock ต้องมี confirmation ว่าแก้ไม่ได้ ใบเสร็จที่บันทึกแล้วแสดง algorithm, seed digest, candidate-set hash, ordered-result hash และผลลัพธ์เรียงลำดับ โดยแยกข้อความ “ผลคำนวณเบื้องต้น” สำหรับ preview ออกจากหลักฐานที่บันทึกแล้ว หน้ารายงานใช้ active run โดย default และ historical mode ต้องให้เลือก superseded version พร้อม label ชัด; cancelled เลือกไม่ได้

### Field collector

เปิด “งานของฉัน” → ดูข้อมูลติดต่อเท่าที่จำเป็น → **แสดง privacy notice ก่อน** → บันทึก `granted` หรือ `declined` หาก declined แสดง receipt แบบ minimal และจบ collection โดยไม่มี baseline/response หาก granted จึงสร้าง/แก้ farmer/farm baseline และ response `draft` → ตรวจข้อผิดพลาด → เชื่อม online และ `draft→submitted` หาก manager return ระบบแสดง required reason แต่ fields เป็น read-only; collector กด “เริ่มแก้ไข” เพื่อส่ง status-only `returned→draft` โดยห้ามเปลี่ยน answer/baseline request เดียวกัน เมื่อ server ยืนยัน draft แล้วจึง unlock fields ให้แก้และ submit ใหม่ หลัง submitted/verified/withdrawn แก้ไม่ได้และ collectorไม่มี return/verify control

### Farmer ledger

เลือกสวน/แปลง → เพิ่ม activity/expense/harvest → เพิ่ม sale โดยเลือก farm บังคับ, plot ไม่บังคับ และ harvest ไม่บังคับได้หนึ่งรายการ → เห็น gross/net preview → ดู cash profit/loss ตามช่วงพร้อมยอดขาย/ค่าใช้จ่ายและรายการ drill-down Active/deleted status ต้องชัดและ deletion ขอเหตุผล/สร้าง audit

สถานะ production ณ 2026-08-26: `/app/gardens` รองรับสวน/แปลง และ `/app/garden-account` รองรับ expense/sale/cash report พร้อม empty/loading/error/forbidden, mobile/desktop และ delete reason แล้ว Activity, harvest และ harvest selector ยังไม่แสดงจน backend slice พร้อม Query error ต้องแสดง error state ห้ามลดรูปเป็น empty state

### Withdrawal

ผู้เข้าร่วมส่ง request ตามช่องทางที่อนุมัติ → manager assign/reassign collector ผู้ดำเนินการโดยไม่แก้ consent → assigned collector ยืนยันตัวตน/คำขอตาม protocol → หาก response อยู่ exactly `draft|submitted|returned|verified` แสดงผลที่จะ lock/exclude → บันทึก required withdrawal reason code → เปลี่ยน current consent/response เป็น withdrawn → แสดง minimal receipt และสถานะ terminal “ถอนแล้ว—ไม่รวมในการเก็บ/วิเคราะห์” โดยไม่แสดง answer

## Screen-state contract

ทุกหน้าข้อมูลมี `loading`, `empty`, `ready`, `validation_error`, `forbidden`, `not_found`, `conflict/stale`, `offline`, `service_unavailable` และ `success` ที่แยกชัด Empty state บอกเหตุผล/next action ที่ผู้ใช้มีสิทธิ์ Forbidden ไม่บอกว่าข้อมูลเป้าหมายมีอยู่หรือไม่ Conflict ห้ามทับข้อมูลและให้ refresh/review Service unavailable รักษา input ที่ไม่ sensitive เท่าที่ปลอดภัย

Global application fallback states ใน Next.js (`loading.tsx`, `error.tsx`, `not-found.tsx`) ใช้ UI ภาษาไทยตาม PalmTrack design system:
- `loading.tsx`: มี `role="status"` และ `aria-live="polite"` ประกาศต่อ assistive technology และรองรับ `prefers-reduced-motion`
- `error.tsx`: เป็น Client Component พร้อมปุ่มลองใหม่อีกครั้งที่เรียก `reset()` และลิงก์กลับหน้าหลัก โดยไม่แสดงหรือส่ง raw error ไป browser console ซึ่งอาจเปิดเผย stack trace, message ภายใน, UUID, environment หรือ secret
- `not-found.tsx`: แสดงรหัส 404 และคำอธิบายภาษาไทย พร้อมลิงก์กลับหน้าหลัก (`/app`) ใช้งานได้จริงและปลอดภัยจาก overflow ที่ 360px
- Route สถานะโมดูลตามสิทธิ์ (`/app/[section]` สำหรับ `settings`, `audit`, `my-work`, `reports`, `evaluation`): แสดงชื่อภาษาไทย ขอบเขตที่วางแผนไว้ สถานะ "ยังไม่เปิดใช้งาน" และเหตุผล/ขั้นตอนถัดไปอย่างซื่อสัตย์ โดย direct URL จาก role ที่ไม่มีสิทธิ์ได้รับ non-enumerating forbidden state และไม่มีปุ่มหลอก (no dead action)

Authenticated shell แสดงปุ่ม “ออกจากระบบ” ที่เข้าถึงด้วย keyboard และมี touch target อย่างน้อย 44×44 CSS px ระหว่างส่งคำขอปุ่มถูกปิดเพื่อป้องกันการส่งซ้ำและประกาศ “กำลังออกจากระบบ...” ต่อ assistive technology การออกจากระบบยุติเฉพาะ session ของ browser ปัจจุบันด้วย explicit local scope แล้วนำไป `/sign-in`; configuration/provider failure ใช้ข้อความผิดพลาดแบบทั่วไปและไม่เปิดเผย provider detail หรือ secret

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
