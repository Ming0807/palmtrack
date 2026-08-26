# PalmTrack Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router แบบ modular monolith, Supabase Auth/PostgreSQL/RLS/private Storage, Vercel และ GitHub ตามสถาปัตยกรรมที่อนุมัติ การพัฒนาจะเริ่มจาก UX/UI prototype ก่อนเขียน production implementation และยังไม่ผูก business logic กับ provider เกิน interface ที่ระบุในเอกสาร

## Users

- `field_collector` ใช้โทรศัพท์ลงพื้นที่ในสภาพเครือข่ายไม่แน่นอน ต้องเข้าใจงานค้าง Consent และสถานะการส่งได้ทันที
- `farmer` บันทึกกิจกรรม ต้นทุน ผลผลิต และการขายของสวนตนด้วยภาษาไทยและขั้นตอนสั้น
- `research_manager` จัดการประชากร การสุ่ม Assignment การตรวจข้อมูล และหลักฐานงานวิจัย
- `admin` ดูแลผู้ใช้ ข้อมูลอ้างอิง Audit และการดำเนินระบบ โดยไม่แก้เนื้อหาคำตอบหรือบัญชีสวนแทนผู้ใช้
- `evaluator_readonly` อ่านผลรวมที่ anonymize แล้วเพื่อประเมินงานโดยไม่เข้าถึง PII

## Product Purpose

PalmTrack คือระบบบริหารสวนปาล์มและวิเคราะห์ข้อมูลการดำเนินงานสำหรับเกษตรกรและทีมดูแล ช่วยจัดโครงข้อมูลสวน แปลง กิจกรรม ต้นทุน ผลผลิต การขาย และกำไรเงินสดให้อ่านและตรวจสอบย้อนกลับได้ งานวิจัยเป็นความสามารถสนับสนุนที่ใช้ข้อมูลและหลักฐานจากระบบอย่างมีสิทธิ์ ไม่ใช่ตัวตนหลักของผลิตภัณฑ์ ความสำเร็จของ V1 คือผู้ใช้ทำงานหลักบนมือถือได้ด้วยข้อมูลสังเคราะห์ โดยสูตร สิทธิ์ ความเป็นส่วนตัว และ audit ผ่านเกณฑ์ที่กำหนด

## Positioning

PalmTrack วางตำแหน่งเป็น farm operations and data analytics SaaS ที่เริ่มจากพื้นที่ทำงานเดียวใน V1 หน้าหลักต้องนำด้วยสถานะสวน บัญชีเงินสด ผลผลิต และงานที่ควรทำต่อ ส่วน sampling, assignment, consent และ research provenance อยู่ในชั้นสนับสนุนที่แยกสิทธิ์ชัดเจน

## Operating Context

ระบบเริ่มใช้กับสวนปาล์มในอำเภอศรีสาคร จังหวัดนราธิวาส ผู้ใช้หลักทำงานบนโทรศัพท์ จอเล็ก และอินเทอร์เน็ตไม่สม่ำเสมอ งานประจำคือดูสถานะสวน บันทึกรายจ่าย ผลผลิต และการขาย แล้วอ่านผลวิเคราะห์ที่อธิบายย้อนกลับได้ ทีมภาคสนามและผู้จัดการยังใช้ระบบสำหรับ assignment, consent, ตรวจข้อมูล และ export หลักฐานเมื่อทำกิจกรรมวิจัย

## Capabilities and Constraints

- V1 มี workspace เดียว ไม่มี tenant switcher, billing, native app หรือ bidirectional offline sync
- แบบร่างอยู่ใน IndexedDB และส่งเมื่อ online หลัง server ตรวจ Auth, Assignment, Consent, version และ idempotency ใหม่
- คำถามวิจัยและแบบประเมินระบบจริงเป็น artifact แยกที่ต้องอนุมัติก่อนใช้งาน ห้าม UI prototype ประดิษฐ์คำถามแล้วทำให้ดูเหมือนผ่านอนุมัติ
- UI ภาษาไทย แสดง พ.ศ. และเวลา Asia/Bangkok; persistence ใช้ Gregorian date และ UTC timestamp
- ข้อมูลตัวอย่างใน prototype ต้องระบุว่าเป็นข้อมูลสังเคราะห์ และห้ามใช้ชื่อ เบอร์โทร พิกัด หรือคำตอบของบุคคลจริง
- ระยะ V1 สำหรับทีม 2–3 คนใน 4–6 เดือน ใช้บริการ free tier เพื่อการศึกษาและยอมรับข้อจำกัดที่ระบุใน runbook

## Brand Commitments

ชื่อผลิตภัณฑ์คือ **PalmTrack** บุคลิกที่ผู้ใช้กำหนดคือ **minimal premium**: สุขุม ชัดเจน น่าเชื่อถือ และร่วมสมัย โดยความสวยต้องไม่ลด scanability ของงานภาคสนาม ไม่ใช้ความหรูหราแบบตกแต่งเกินจำเป็น และไม่ทำให้ระบบดูเป็น dashboard template ทั่วไป

## Evidence on Hand

- ข้อกำหนด สถาปัตยกรรม ข้อมูล UX ความปลอดภัย และ test traceability อยู่ใน [documentation index](docs/INDEX.md)
- มีสูตรและ acceptance fixture สำหรับ Yamane `N=121`, `e=0.05` ซึ่งได้ตัวอย่าง 93 ราย และ deterministic sampling contract
- ยังไม่มีโลโก้ ภาพถ่ายสวน แบบสอบถามจริง testimonial benchmark หรือข้อมูลผู้ใช้จริง งานออกแบบห้ามสร้าง claim หรือหลักฐานเหล่านี้ขึ้นเอง

## Product Principles

1. งานสวนและตัวเลขดำเนินงานต้องมาก่อนบนลำดับข้อมูลหลัก โดย Consent และสิทธิ์ยังเป็น hard gate เมื่อข้อมูลถูกใช้เพื่อการวิจัย
2. งานภาคสนามต้องสั้น ชัด และฟื้นจาก offline draft ได้โดยไม่สร้างข้อมูลซ้ำ
3. ตัวเลขเดียวกันต้องอธิบายย้อนกลับถึง sampling run, source record และสูตรได้
4. ค่าเริ่มต้นต้องปกป้อง PII; การเปิดเผยมากขึ้นเป็น privileged action ที่ audit ได้
5. ความเรียบหรูเกิดจากลำดับข้อมูล ภาษา และรายละเอียดที่แม่นยำ ไม่ใช่เอฟเฟ็กต์รบกวนงาน

## Accessibility & Inclusion

รองรับหน้าจอกว้างตั้งแต่ 360 px, keyboard operation, visible focus, semantic labels, status/error announcement และ contrast ระดับ WCAG 2.1 AA งานหลักต้องไม่พึ่ง hover สี หรือไอคอนเพียงอย่างเดียว ภาษาไทยต้องอ่านง่ายและหลีกเลี่ยงศัพท์เทคนิคเมื่อมีคำธรรมดาที่แม่นกว่า

## Inferred Decisions

ผู้ใช้สั่งให้เดินหน้าต่อโดยไม่รอคำถามเพิ่มเติม ข้อมูลข้างต้นจึงสกัดจาก design ที่อนุมัติและคำสั่ง minimal premium โดยไม่เพิ่มแพลตฟอร์ม ผู้ใช้ หรือ claim ใหม่
