# Product requirements

## เป้าหมายและผู้ใช้

PalmTrack ช่วยทีมวิจัยนักศึกษาเก็บข้อมูลตัวอย่างที่ให้ความยินยอมอย่างตรวจสอบย้อนกลับได้ และช่วยเกษตรกรบันทึกกระแสเงินสดสวนปาล์ม โดยไม่ใช้ข้อมูลจริงก่อนระบบผ่านการยอมรับ กลุ่มผู้ใช้คือ `admin`, `research_manager`, `field_collector`, `farmer`, `evaluator_readonly` ตามสิทธิ์ใน [Security and PDPA](SECURITY_PDPA.md)

V1 มี research workspace เดียวและไม่มี UI จัดการ tenant แม้ root aggregate จะมี `workspace_id` สำหรับ migration ในอนาคต

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | ระบบต้อง authenticate ผู้ใช้และบังคับหนึ่งในห้าบทบาทที่กำหนดด้วย server authorization และ RLS |
| FR-02 | `admin`/`research_manager` import population แบบสังเคราะห์หรือได้รับอนุญาต ตรวจ eligibility และแสดงผล reject รายแถวโดยไม่รับข้อมูลครึ่งชุดแบบเงียบ ๆ |
| FR-03 | `research_manager` สร้าง sampling run แบบ versioned ด้วย Yamane, largest-remainder allocation และ deterministic algorithm `sha256-mulberry32-fy-v1`; lifecycle ต้องเป็น `draft \| locked \| active \| superseded \| cancelled`, มี active run exactly one ต่อ workspace เมื่อเริ่ม sampling และ lock แล้วแก้ input/candidate/result ไม่ได้ |
| FR-04 | `research_manager` มอบหมาย sample ให้ `field_collector`; ผู้เก็บเห็นเฉพาะ assignment ของตนและผู้จัดการ reassign ได้พร้อมเหตุผล/audit |
| FR-05 | หลังมี assignment `field_collector` ต้อง present privacy notice version ก่อน record consent `granted` หรือ `declined`; เฉพาะ granted จึงสร้าง/แก้ response หรือ farmer/farm baseline ได้ Decline เก็บ minimal consent/refusal audit แล้วจบ collection Withdrawal อนุญาตจาก `draft \| submitted \| returned \| verified`, เปลี่ยน current consent/response เป็น withdrawn, ล็อกและตัดออกจาก collection/analysis/exportทันที โดยเหลือ minimal withdrawal/audit record; `admin`/`research_manager` ห้ามเปลี่ยน consent |
| FR-06 | assigned `field_collector` แก้ answer/content ได้เฉพาะเมื่อ consent ยัง granted, assignment ยัง valid และ response status `draft` เท่านั้น เมื่อ status `returned` อนุญาตเฉพาะ status-only operation `returned → draft`; operation นี้ห้ามเปลี่ยน answer หรือ farmer/farm baseline field เดียวกัน หลัง resume สำเร็จจึง edit ใน operation ถัดไปและทำ `draft → submitted` Response อ้าง approved questionnaire version, stable `question_code`/typed value, รองรับ IndexedDB local draft/online submit; collector ห้าม return/verify |
| FR-07 | `research_manager` ทำ `submitted → returned` พร้อม required reason หรือ `submitted → verified`; verified correction เริ่มได้เฉพาะ manager ทำ `verified → returned` พร้อม required correction reason โดย manager ไม่แก้ answer จากนั้น assigned collector ทำ `returned → draft → submitted` และ manager re-verifies ต้องรักษา prior verified snapshot กับ full before/after audit; `admin` ห้ามเปลี่ยน response |
| FR-08 | `farmer` จัดการ profile/farm/plot ของตน; assigned `field_collector` สร้าง/แก้ farmer/farm baseline ได้เฉพาะหลัง consent granted, assignment valid และ response `draft`; `returned → draft` resume ห้ามเปลี่ยน baseline field `admin`/`research_manager` ห้ามแก้ farm record โดยทุก root aggregate มี `workspace_id` และ record สำคัญมี create/update/soft-delete attribution |
| FR-09 | `farmer` บันทึก activity และ expense ของตน; money ทุก field ใช้ `decimal(14,2)` และ quantity/weight/area ใช้ `decimal(14,3)`; role อื่นห้ามแก้ farm ledger |
| FR-10 | `farmer` บันทึก harvest และ sale ของตน; sale ทุกแถวต้องมี `farm_id`, มี `plot_id` ได้ และอ้าง `harvest_id` ได้ไม่เกินหนึ่งรายการโดยไม่บังคับ; `unit_price`, `gross_amount`, `deductions`, `net_amount` เป็น `decimal(14,2)`, `gross_amount = quantity * unit_price`, sale เป็นแหล่งรายรับเดียว และ soft-delete ต้อง audit |
| FR-11 | ระบบรายงาน cash profit/loss ตามช่วงเวลาเป็นผลรวม active `sales.net_amount` ลบผลรวม active `expenses.amount` พร้อม drill-down ตามสิทธิ์ |
| FR-12 | export ปริยาย anonymized และตัด withdrawn/non-verified response; full PII export จำกัด `admin`/`research_manager`, ต้องยืนยันเจตนาและสร้าง audit event |
| FR-13 | `evaluator_readonly` อ่าน dashboard/ผลรวม/หลักฐานวิจัยแบบ anonymized เท่านั้น และห้ามแก้ไข ดาวน์โหลด PII หรือเข้าถึงไฟล์ระบุตัวบุคคล |
| FR-14 | ระบบจัดเก็บไฟล์ใน private storage และอนุญาต upload/list/read/download/delete attachment ตาม ownership, assignment/farm purpose และ object-level policy; ทุก list/read/download/delete ต้อง audit object ID และ authorized delete ต้องมี reason, soft-delete metadata/delete object ตาม retention |
| FR-15 | UI แสดงภาษาไทย วันที่ พ.ศ. และเวลา Asia/Bangkok แต่ persistence เก็บ Gregorian date และ UTC timestamp |
| FR-16 | dashboard ใช้ shared base cohort: workspace เดียว, selected sampling run (active default; superseded เมื่อเลือก historical), eligible/non-soft-deleted population/sample, not withdrawn และ shared date filter จากนั้นนับ stage แยก `population`, `sampled`, `assigned`, `consent`, `submitted`, `verified`, `export-eligible` ตาม [Research protocol](RESEARCH_PROTOCOL.md); early stages ห้ามใช้ final export predicate |

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Security deny-by-default: auth, server validation, RLS และ private storage ต้องผ่าน negative tests ก่อนเปิดใช้ |
| NFR-02 | Privacy: data minimization, purpose limitation, anonymized default, audited privileged action และกระบวนการ retention/deletion ที่อนุมัติก่อนข้อมูลจริง |
| NFR-03 | Auditability: sampling, assignment, consent, review/return/verify, verified-correction resume/edit/resubmit/re-verify, withdrawal, anonymized/full-PII export, attachment list/read/download/delete และ soft delete ต้องเก็บ actor UUID, UTC timestamp, action/entity และ before/after status/answer snapshot ตามเหตุการณ์ Export เก็บ mode/filter/sampling run/row count; PII export มี approval/reason; attachment event มี object ID และ delete มี reason; transition ที่กำหนดต้องมี reason/purpose |
| NFR-04 | Reproducibility: seed normalization/hash, Mulberry32/Fisher-Yates, candidate ordering/hash และ result ของ `sha256-mulberry32-fy-v1` ต้องสร้างสมาชิก/ลำดับเดียวกันจาก immutable evidence ทุก implementation |
| NFR-05 | Usability: mobile-first ภาษาไทย ใช้ได้ที่กว้าง 360 px, สถานะ/ข้อผิดพลาดชัด และงานหลักไม่พึ่ง hover |
| NFR-06 | Accessibility: keyboard operation, visible focus, semantic label, contrast ตาม WCAG 2.1 AA และประกาศ error/status ต่อ assistive technology |
| NFR-07 | Reliability on free tier: ไม่มี SLA; มี manual verified backup/restore และแผนรับ cold start/quota/outage โดยไม่อ้าง provider guarantee |
| NFR-08 | Data integrity: transaction/constraint/idempotency ป้องกัน duplicate submit, invalid transition, orphan และ precision drift |
| NFR-09 | Maintainability: modular monolith, schema migration แบบ reviewable, stable identifier และเอกสาร traceability ที่ปรับพร้อม requirement |

## Out of scope

- multi-tenant UI, billing, commercial use, native mobile app และ bidirectional offline sync
- questionnaire คำถามจริง; ต้องเป็น approved artifact แยกตาม [Research protocol](RESEARCH_PROTOCOL.md)
- accrual accounting, inventory valuation, payroll, sensor/IoT, GIS analytics และคำรับรอง uptime/backup จาก free tier
- public file bucket, public farmer directory หรือ full-PII analytics สำหรับ evaluator

## V1 acceptance criteria

V1 ยอมรับได้เมื่อทุก FR/NFR มี test ใน [traceability matrix](TRACEABILITY_MATRIX.md), ชุด acceptance fixture สังเคราะห์ผ่าน, RLS/security negative ไม่มีช่องข้ามสิทธิ์, ตัวอย่าง Yamane `N=121,e=0.05` ปัดขึ้นเป็น 93 และ strata รวม 93, algorithm `sha256-mulberry32-fy-v1` ทำซ้ำจาก evidence ได้, withdrawal หายจาก report/export ทันที, สูตร profit ตรงกับ active ledger, offline draft ไม่ส่งขณะ offline, database/storage/Auth identity manifest ถูก restore ใน clean target พร้อม sign-in/RLS linkage และ questionnaire version ที่ใช้ผ่าน approval gateแล้ว
