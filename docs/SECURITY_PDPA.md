# Security and PDPA design

เอกสารนี้กำหนด privacy/security control เชิงระบบ ไม่ใช่คำวินิจฉัยกฎหมาย ก่อนใช้ข้อมูลจริง ทีมต้องได้รับการอนุมัติฐานการประมวลผล, notice, retention และช่องทางสิทธิของเจ้าของข้อมูลจากผู้รับผิดชอบของสถาบัน

## Data classification

| Class | Examples | Control |
|---|---|---|
| Restricted PII | ชื่อ/contact/exact location/consent linkage, identifying file, encrypted recovery identity manifest | need-to-know, private storage, RLS/object auth, encryption in transit/at provider, no evaluator access; manifest excludes credentials/tokens |
| Restricted research | answer/free text, sample membership, response revision | assigned/research management scope, analysis eligibility, export minimization |
| Confidential operational | expense/sale/plot detail, audit actor, backup | farmer ownership/assigned baseline scope; admin sees audit/configuration metadata, private backup |
| Internal | aggregate methodology, synthetic fixture, non-identifying diagnostics | authenticated unless approved for release |
| Public-approved | methodology/output ที่ตรวจ disclosure แล้ว | explicit publication approval only |

Data minimization: ไม่เก็บเลขประจำตัวประชาชน, credential, precise coordinate หรือไฟล์เกิน protocol ที่อนุมัติ Field/free-text ที่เสี่ยงระบุตัวต้องถูกกำกับใน questionnaire approval

## Role permission matrix

| Capability | admin | research_manager | field_collector | farmer | evaluator_readonly |
|---|---:|---:|---:|---:|---:|
| Manage users/roles/workspace/reference configuration | ✓ | – | – | – | – |
| Review audit | ✓ | research subset | own action receipt | own relevant receipt | aggregate method evidence only |
| Import population | ✓ audited | ✓ audited | – | – | – |
| Draft/lock/activate/cancel sampling run | – | ✓ audited | – | – | read aggregate method only |
| Assign/reassign field work | – | ✓ audited | own list read only | – | – |
| Present notice / capture granted, declined, withdrawn consent | – | – | own assignment; withdrawal from `draft\|submitted\|returned\|verified` | request channel only | – |
| Resume returned response | – | – | status-only `returned→draft`; granted consent + valid assignment; no content/baseline mutation | – | – |
| Create/edit response content | – | – | own assignment, granted consent, `draft` only | – | – |
| Return/verify/initiate verified correction | – | ✓ status transition only; never answer edit | – | – | – |
| Assigned farmer/farm baseline | – | – | own assignment, granted consent, `draft` only | – | – |
| Profile/farm ledger/activity/expense/harvest/sale CRUD | – | – | – | own records only | – |
| Anonymized analysis/export | – | ✓ | – | own cash report only | aggregate read only; no base export |
| Full-PII export | ✓ audited | ✓ audited | – | – | – |
| Identifying attachment list/read/download/upload | configuration/audit metadata only | research purpose list/read/download | own assignment purpose | own farm purpose | – |
| Delete attachment | – | – | own assignment purpose before submit | own farm purpose | – |

Allowed path เป็น allowlist: ช่อง `–` ต้องถูก deny ทั้ง UI, server และ RLS/RPC `admin` ไม่มี emergency override เพื่อเขียน consent/response/farm ledger; `research_manager` ห้าม capture consent, แก้ answer หรือเขียน farm ledger; assigned collector ต้องมี granted consent/valid assignmentและ edit response/baseline ได้เฉพาะ `draft` ขณะ `returned` อนุญาต status-only `returned→draft` ที่ before/after answer และ baseline digest ต้องเท่ากัน Combined resume+content payload ถูก denyทั้ง transaction; evaluator อ่านได้เฉพาะ aggregate anonymized output

## Object authorization and RLS concept

ทุก request ต้อง authenticated (ยกเว้นหน้า static ที่อนุมัติ), membership active และ `workspace_id` ตรง Object rule:

- `admin`: จัดการ user/role/workspace/reference configuration/audit, import population และทำ full-PII export แบบ purpose-confirmed/audited; policy deny consent/response/review/farm-ledger mutation ทุกกรณี
- `research_manager`: import population, draft/lock/activate/cancel sampling, assign/reassign, ทำ `submitted→returned|verified` และ `verified→returned` correction initiation, analyze/export; manager ไม่แก้ answer และ policy deny consent/farm-ledger mutation
- `field_collector`: assignment `collector_id = auth.uid()`; present notice/capture consent แล้วสร้าง baseline/response ได้เมื่อ granted เท่านั้น Content edit เฉพาะ `draft`; `returned` ทำได้เพียง status-only resume เป็น draft โดยไม่มี field mutation แล้วจึง edit ใน operation ถัดไป Policy deny record อื่น, invalid assignment, `submitted|verified|withdrawn` mutation, return/verify และ sampling/export privilege
- `farmer`: `farmer.owner_user_id = auth.uid()`; mutate เฉพาะ own profile/farm/plot/activity/expense/harvest/sale และ authorized attachment
- `evaluator_readonly`: database view/RPC aggregate anonymized เท่านั้น ไม่มี base-table select, mutation, identifying file หรือ row-level export

เปิด RLS ทุก schema/table ที่ exposed Policy แยก `SELECT/INSERT/UPDATE/DELETE`, default deny, ตรวจ `WITH CHECK` ป้องกันเปลี่ยน owner/workspace/role Client ห้ามกำหนด actor/verification fields เอง Security-definer function ต้อง fixed `search_path`, minimal grant และ review Service-role secret อยู่ server/controlled recovery เท่านั้น

## Private storage

Bucket ทุกใบ private Path ใช้ opaque workspace/aggregate/object UUID ไม่ใส่ PII Metadata table ผูก purpose, owner aggregate, uploader, checksum, content type/size และ status Upload ใช้ allowlist type/size และ scanning/validation เท่าที่ zero-cost ทำได้; ไฟล์ไม่ผ่านไม่ถูก serve Download signed URL อายุสั้นหลัง database object authorization; ห้าม log URL Authorized delete ต้องตรวจ assignment/farm ownership และ purpose, soft-delete metadata พร้อม actor/reason, ลบ object ตาม retention policy และสร้าง audit ใน operation ที่ reconcile ได้ Cross-owner delete ถูก deny Delete/restore สอดคล้อง retention และ orphan reconciliation ตาม runbook

## Anonymization and exports

Anonymized default **exclude**: name, contact, auth/user ID, source external ID, exact address/location, free text/rare combination ที่เสี่ยง, file/path/signed URL, consent signature และ audit actor **include เมื่ออนุมัติ**: random research ID ที่ไม่ย้อนด้วย export alone, broad stratum, questionnaire version, typed coded answer และ generalized date/location ตาม disclosure review

ก่อน export ใช้ analysis eligibility จาก [Research protocol](RESEARCH_PROTOCOL.md), suppression/generalization สำหรับ small cell ตาม approved analysis plan และ preview fields/count Full PII export ต้อง role check, purpose/reason, explicit confirmation, row/field scope, audit และ secure short-lived delivery ห้าม email/public link

## Audit, retention, correction, deletion

Audit append-only ครอบคลุม login risk ที่สำคัญ, role change, population import, sampling draft/lock/activate/supersede/cancel, assignment/reassignment, notice/consent/decline/withdrawal, submit/return/verify, verified-correction initiation/collector status-only resume/edit+resubmit/manager re-verification, anonymized/full-PII export, farm/ledger soft-delete, attachment list/read/download/delete, backup/Auth relink/restore และ privileged workspace/reference configuration ทุก event เก็บ actor UUID, UTC timestamp, action/entity และ before/after status/answer digest ตามเหตุการณ์ Export event ต้องมี `export_mode`, filter digest, selected `sampling_run_id`, row count และ PII approval reference/reasonเมื่อ full PII Attachment event ต้องมี object metadata ID; deletion ต้องมี reason Resume auditต้องพิสูจน์ answer/baselineไม่เปลี่ยน ส่วน correction chainเก็บ snapshotก่อน/หลังโดยไม่ log raw answer/PII/secret/signed URL

Retention duration ไม่ถูกแต่งขึ้นในเอกสารนี้ ก่อนข้อมูลจริงต้องมีตารางที่อนุมัติแยกตาม population PII, consent/minimal withdrawal, response, ledger, file, audit และ backup พร้อม trigger/owner/legal-research basis เมื่อครบกำหนดให้ restrict → verified backup handling → delete/anonymize ตาม approval → evidence log Soft-delete ให้ recover ทางปฏิบัติแต่ไม่แทน approved erasure Verified correction สร้าง revision; withdrawal lock และ exclude ทันทีตาม protocol

## Incident handling

1. รับแจ้งและบันทึก incident ID/time โดยไม่คัดลอก PII ลงช่องทางไม่ปลอดภัย
2. Contain: revoke session/key, disable affected export/file route หรือจำกัด role; ห้ามลบหลักฐาน
3. ประเมิน data/subjects/scope/timeline จาก audit และ provider logs ที่มีจริง
4. แจ้งผู้รับผิดชอบสถาบัน/อาจารย์และดำเนิน notification ตามข้อกำหนดที่อนุมัติ ไม่สัญญากรอบเวลาที่ไม่ได้กำหนด
5. Recover จาก artifact/backup ที่ตรวจ integrity, rotate secrets และทดสอบ authorization
6. Post-incident review, corrective control และบันทึก evidence

## Privacy and security release checklist

- approval/notice/consent text/questionnaire/retention roster พร้อมและ versioned
- ไม่มีข้อมูลจริงใน source, test, log, analytics หรือ preview deployment
- RLS/object/storage negative tests ผ่านทุก role/cross-owner/cross-workspace
- anonymous export field review และ withdrawal exclusion ผ่าน; full PII audited
- secret อยู่ provider env เท่านั้น, least privilege, rotation/revocation documented
- backup encrypted/private, checksum/restore drill ผ่าน และผู้เข้าถึงจำกัด
- clean-target Auth users ถูกสร้างใหม่/relink stable profile, `must_change_password=true`, phone admin-assisted reset และ sign-in/RLS recovery test ผ่าน; password hash/session/token เดิมไม่ถือว่ากู้คืนได้
- incident contacts/data-subject request channel ได้รับอนุมัติ
- dependency/migration/deploy review และ rollback rehearsal ผ่านก่อน production-like collection
