# PalmTrack farmer ledger and analysis dashboard design

- Date: 2026-09-23
- Status: Approved for implementation under the accepted roadmap and the user's reprioritization instruction (งานตามหัวข้อหลัก; พักงานวิจัย increments 3–4 ชั่วคราว)
- Scope: FR-08 + FR-09 + FR-10 + FR-11 (+ FR-15 Thai locale); single workspace; synthetic data only

## Job and audience

ชาวบ้านสวนปาล์ม (`farmer`) ใช้โทรศัพท์บันทึกเรื่องสวนด้วยภาษาไทยและขั้นตอนสั้น: สวนของฉัน → แปลง → กิจกรรม/ค่าใช้จ่าย → เก็บเกี่ยว/ขาย → เห็นกำไรขาดทุน จากนั้นวิเคราะห์ต่อ 3 แบบ: (1) กำไรรายเดือน + ต้นทุนตามหมวด (2) ราคาขาย + ผลผลิตแนวโน้ม (3) เปรียบเทียบแปลง งานนี้คืองานตามหัวข้อ ไม่ใช่ระบบวิจัย

## Approaches considered

1. **Farmer vertical slice first — selected.** farmer/farm/plot → activity/expense → harvest/sale → profit report → 3 หน้าวิเคราะห์ ครบแนวดิ่ง รวม RLS/audit/Thai UI/E2E ตรงตาม FR-08–FR-11 และ UX_SPEC IA ชาวบ้าน
2. **Research increments first.** ขัดคำสั่งผู้ใช้และไม่ใช่หัวข้อหลัก — ไม่เลือก
3. **Charts-only บนข้อมูลสมมติ.** สร้างกราฟโดยไม่มี ledger จริงรองรับ ทำให้ตัวเลขเชื่อถือไม่ได้ — ไม่เลือก

## Outcome and proof

farmer จัดการ profile/farm/plot ของตน (ชื่อสวน, พื้นที่ `decimal(14,3)`, soft-delete มี attribution) บันทึก activity/expense (เงิน `decimal(14,2)`, ปริมาณ/น้ำหนัก/พื้นที่ `decimal(14,3)`) บันทึก harvest และ sale โดย sale บังคับ `farm_id`, เลือก `plot_id` ได้, อ้าง `harvest_id` ได้ไม่เกินหนึ่งรายการ, `gross_amount = quantity × unit_price`, `net_amount = gross − deductions` พร้อม preview ตรงกับ server รายงานกำไรขาดทุนตามช่วง = `SUM(active sales.net_amount) − SUM(active expenses.amount)` พร้อม drill-down ถึงแถว ledger และตัดแถว soft-delete ออก หน้าวิเคราะห์ 3 แบบอ่านจาก ledger จริงเท่านั้น

หลักฐานตรวจรับของ slice คือ `FR-08–FR-11`, `FR-15`, `NFR-01`, `NFR-03`, `NFR-05`, `NFR-06`, `NFR-08`, `NFR-09` ผ่าน `UNIT-04`, `UNIT-05`, `UNIT-06`, `RLS-05`, `INT-07`, `INT-08`, `INT-09`, `E2E-07`, `E2E-08`, `E2E-09`, `E2E-10` (fixture กำไร 9,000.25), `AUD-03`, `REP-01`

## Data and lifecycle

`farmer` (owner `owner_user_id`, workspace), `farm` (farmer, ชื่อ, พื้นที่), `plot` (farm, ชื่อ, พื้นที่), `activity`, `expense` (amount, หมวด, business date), `harvest` (plot, น้ำหนัก, วันที่), `sale` (farm บังคับ, plot/harvest ไม่บังคับ, quantity, unit_price, gross, deductions, net) ทุก root aggregate มี non-null `workspace_id` ทุกแถวสำคัญมี create/update/soft-delete attribution; soft-delete ขอเหตุผลและ audit ไม่ลบจริง

## Trust boundary

farmer mutate ได้เฉพาะของตน (`owner_user_id = auth.uid()`); role อื่น (รวม `admin`/`research_manager`) ห้ามเขียน ledger เด็ดขาด (RLS-05 negative) collector แตะ baseline ได้เฉพาะ flow วิจัยที่พักไว้ ไม่เกี่ยว slice นี้ รายงาน/กราฟอ่านเฉพาะ active rows ของ owner

## Surface and interaction

IA ชาวบ้านตาม UX_SPEC: `สวนของฉัน แปลง กิจกรรม ค่าใช้จ่าย เก็บเกี่ยว ขาย กำไร/ขาดทุน` + เมนู `วิเคราะห์` ที่มี 3 หน้า (รายเดือน/หมวด, ราคา/ผลผลิต, เปรียบเทียบแปลง) ทุกฟอร์มไทย ขั้นตอนสั้น ปุ่ม ≥44 px, focus ชัด, error/status ผ่าน live region, ตัวเลขไทย, วันที่ พ.ศ. Asia/Bangkok, 360 px ไม่ overflow กราฟใช้ reporting module เดิม (Recharts + table fallback + aria) ห้ามศัพท์เทคนิคเมื่อมีคำธรรมดา

## States and errors

`empty` (ชวนเริ่มจากสร้างสวน), `editing` (validate เงิน/วันที่/หน่วยไทย), `preview` (gross/net ตรง server), `saved`, `deleted` (ต้องมีเหตุผล + เห็นสถานะชัด), `forbidden` (ข้าม owner), `conflict` (idempotency/duplicate submit), `service_unavailable` (fail-closed) error ไม่รั่ว SQL/state

## Boundaries and anti-goals

- ไม่ทำ accrual accounting, inventory valuation, payroll, sensor/IoT, GIS analytics (out of scope ตาม PRODUCT_REQUIREMENTS)
- ไม่รับ real farmer data จนกว่า questionnaire/privacy/retention/restore gates ผ่าน; ใช้ synthetic fixture เท่านั้น
- ไม่แตะ research flow (population/sampling คงสภาพ local-done; hosted pending เหมือนเดิม)
- ไม่เพิ่ม tenant selector, billing, native app, bidirectional sync

## Verification contract

- Domain: decimal precision, สูตร gross/net, profit fixture 9,000.25 (UNIT-04/05/06) แบบ test-first red/green
- pgTAP: owner allow/cross-owner deny/admin-manager deny (RLS-05), soft-delete audit (AUD-03), formula recompute (INT-07/08/09)
- E2E: farmer สร้าง/แก้/ลบ farm/plot (E2E-07), บันทึก expense/sale พร้อม preview (E2E-08/09), report ตรง fixture + drill-down ตัด deleted rows (E2E-10), axe + 360px
