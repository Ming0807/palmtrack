# Research protocol

เอกสารนี้เป็น authoritative source ของ population, sampling, consent, questionnaire contract และ analysis eligibility การดำเนินการจริงต้องได้รับอนุมัติจากอาจารย์/คณะกรรมการที่เกี่ยวข้องและใช้ data collection notice ที่อนุมัติ

## Population import and eligibility

1. `admin` หรือ `research_manager` สร้าง import batch ระบุแหล่งที่ได้รับอนุญาต, วันที่อ้างอิง และ schema version; ทั้งสองบทบาทใช้ validation/audit contract เดียวกัน
2. ระบบ parse/validate ทั้งไฟล์ในพื้นที่ private: required identifier, duplicate, stratum code, format และ scope อำเภอศรีสาคร แถวผิดแสดง reason code โดยไม่เผย PII แก่ผู้ไม่มีสิทธิ์
3. ผู้จัดการแก้ที่แหล่งข้อมูลแล้ว re-import เป็น batch ใหม่; ห้ามแก้ accepted snapshot แบบเงียบ ๆ
4. Eligibility rule/version ที่ได้รับอนุมัติประเมินทุก member เป็น eligible/excluded พร้อม reason code ผู้จัดการยืนยันจำนวน `N` และ input digest ก่อน lock
5. Snapshot ที่ lock เป็น immutable input ของ sampling run Population ใหม่สร้าง sampling version ใหม่และไม่เปลี่ยน assignment เดิม

ห้ามใช้ข้อมูลเกษตรกรจริงจน privacy notice, lawful basis/approval, retention schedule และ access roster ผ่านการอนุมัติ ชุดพัฒนา/ทดสอบใช้ synthetic code เท่านั้น

## Sample size: Taro Yamane

ใช้สูตร

`n = N / (1 + N e^2)`

โดย `N` คือจำนวนประชากร eligible ใน locked snapshot และ `e` คือค่าความคลาดเคลื่อนที่อนุมัติ ผลลัพธ์ปัดขึ้น (`ceil`) เพื่อไม่ให้ตัวอย่างต่ำกว่าค่าเป้าหมาย

ตัวอย่างบังคับ: `N = 121`, `e = 0.05`

`n = 121 / (1 + 121 × 0.05^2) = 121 / 1.3025 ≈ 92.8983` ดังนั้นปัดขึ้นเป็น **93**

Sampling run บันทึก `N`, `e`, unrounded result, rounding rule, `target_n`, formula version, population snapshot ID/digest, stratum definition version, deterministic-selection evidence, ordered-result digest contract/hash, actor และ UTC timestamp

### Canonical margin input contract

FormData รับ `margin_of_error_text` เป็นข้อความ decimal และ server ส่งค่าข้อความนี้ต่อผ่าน action/service/gateway ถึงฐานข้อมูลโดยไม่แปลงเป็น `number` ก่อน persistence ฐานข้อมูลและ domain canonicalize เพียงครั้งเดียวตามรูปแบบ `^0\.0*[1-9](?:\d*[1-9])?$`: ต้องเป็นเลขทศนิยมบวกที่น้อยกว่า 1, ไม่มี exponent/sign/whitespace และไม่มีศูนย์ท้ายที่ไม่มีความหมาย ดังนั้น `0.050` จะ canonicalize และ persist เป็นข้อความ **`0.05`** ค่าตัวเลข `e` ถูก derive จาก canonical text เฉพาะเพื่อคำนวณ Yamane และ replay เท่านั้น โดย canonical text ต้องอยู่ใน `sampling_run.margin_of_error_text`, result evidence และ receipt/UI เสมอ

## Proportional stratification: largest remainder

ให้แต่ละ stratum `h` มี `N_h`; คำนวณ quota `q_h = target_n × N_h / N`:

1. ให้ base allocation `a_h = floor(q_h)`
2. คำนวณ remainder `r_h = q_h - a_h`
3. แจกที่นั่งที่เหลือทีละหนึ่งตาม `r_h` จากมากไปน้อยจน `Σa_h = target_n`
4. ถ้า remainder เท่ากัน เรียงตาม canonical `stratum_code` แบบ bytewise ascending ซึ่งบันทึกเป็น algorithm contract
5. ตรวจว่าไม่มี allocation มากกว่า eligible `N_h`; หากเกิดจาก strata เล็ก/ข้อจำกัด ให้ run ล้มเหลวและต้องอนุมัติ design ใหม่ ห้ามปรับมือ

สำหรับตัวอย่าง N=121 ผลรวม allocation ต้องเท่ากับ **93** เสมอ บันทึก `N_h`, quota, floor, remainder, final allocation เป็น evidence

## Deterministic selection: `sha256-mulberry32-fy-v1`

Algorithm contract ต่อไปนี้เป็น byte-for-byte contract ของ V1 และห้ามเปลี่ยนภายใต้ identifier เดิม:

1. รับ `seed_text` ที่บันทึกตามที่ผู้จัดการยืนยัน Normalize ด้วย Unicode NFC เป็น `seed_normalized`, encode ด้วย UTF-8 แบบไม่มี BOM แล้วคำนวณ SHA-256 เป็น 32-byte `seed_digest`
2. อ่าน digest 4 byte แรกเป็น unsigned 32-bit **big-endian** (`seed_u32`) และใช้เป็น initial state ของ Mulberry32 Seed text ไม่ใช่ secret
3. กรอง population snapshot ให้เหลือ eligible candidates จากนั้น pre-sort ทั้งชุดด้วย `farmer_code` ascending แบบ bytewise บน UTF-8 bytes; code ต้อง unique ใน snapshot
4. สร้าง canonical candidate byte stream ตามลำดับนั้นจากค่าที่ persist ใน locked snapshot สำหรับแต่ละ candidate ต่อ `uint32BE(length(UTF8(farmer_code))) || UTF8(farmer_code) || uint32BE(length(UTF8(stratum_code))) || UTF8(stratum_code)` ห้าม code มี control character แล้วคำนวณ SHA-256 เป็น `ordered_candidate_set_hash`
5. Fisher–Yates shuffle candidate array ทั้งชุดจาก `i = candidate_count - 1` ลงถึง `1`; ทุก iteration ให้ `j = floor(next_random() * (i + 1))` แล้ว swap ตำแหน่ง `i,j`
6. เดิน shuffled array จากต้นไปท้าย เลือก candidate เมื่อจำนวนที่เลือกใน `stratum_code` นั้นยังต่ำกว่า final largest-remainder allocation บันทึก global `selection_order`; หยุดเมื่อทุก stratum เต็ม ตรวจผลรวมเท่ากับ `target_n`

Mulberry32 ใช้ unsigned 32-bit wraparound, logical right shift และ `imul` low 32-bit เท่านั้น; `next_random()` คืนค่าใน `[0,1)`:

```text
state = seed_u32
function next_random():
  state = uint32(state + 0x6D2B79F5)
  t = state
  t = imul32(t xor (t >>> 15), t or 1)
  t = t xor uint32(t + imul32(t xor (t >>> 7), t or 61))
  out = uint32(t xor (t >>> 14))
  return out / 4294967296

candidates = eligible_population
  .sort(compare_bytes(UTF8(farmer_code)))
shuffled = copy(candidates)
for i = length(shuffled) - 1 downto 1:
  j = floor(next_random() * (i + 1))
  swap(shuffled[i], shuffled[j])

selected_count = zero_by_stratum()
results = []
for candidate in shuffled:
  h = candidate.stratum_code
  if selected_count[h] < final_allocation[h]:
    results.append(candidate with selection_order = length(results) + 1)
    selected_count[h] += 1
assert length(results) == target_n
```

7. หลังเลือกผลลัพธ์ ให้เรียง `ordered_selected_members` ตาม `selection_order` แล้วสร้าง canonical ordered-result stream ของแต่ละแถวเป็น `uint32BE(length(UTF8(member_id))) || UTF8(member_id) || uint32BE(length(UTF8(stratum_code))) || UTF8(stratum_code) || uint32BE(selection_order)` จากนั้นคำนวณ SHA-256 lowercase hex เป็น `ordered_result_hash` ภายใต้ evidence contract แยก `ordered-result-sha256-v1`; field นี้เป็นหลักฐานตรวจสอบผลลัพธ์และไม่เปลี่ยน selection algorithm เดิม

Sampling run ต้องเก็บ `seed_text`, `seed_normalized`, `seed_digest_hex` (lowercase), `seed_u32`, identifier `sha256-mulberry32-fy-v1`, `ordered_candidate_set_hash` (lowercase hex), `ordered_result_digest_version`/`ordered_result_hash`, allocation evidence และ ordered results Test vector ของ implementation ต้องระบุ seed text ที่ทดสอบ NFC equivalence, normalized UTF-8 hex, digest hex, first-four-byte `seed_u32`, canonical candidate byte-stream/hash, initial candidate order, every `(i,j)`, shuffled order, allocation, final ordered results และ ordered-result hash ตาม byte contract Test fixture ใช้ข้อมูลสังเคราะห์ที่ review แล้ว; เอกสารนี้ไม่แต่ง field data

## Sampling-run lifecycle and version lock

`sampling_run.status` มีค่าเท่านั้น `draft | locked | active | superseded | cancelled`:

- `draft`: ผู้จัดการแก้ input/seed/allocation และ regenerate candidate/result evidence ได้
- `draft → locked`: replay algorithm แล้วผลตรงกัน จากนั้น freeze population input, N/e, seed fields/digest, algorithm, ordered candidate-set hash, ordered-result digest contract/hash, allocation และ results ทั้งหมด
- `locked → active`: transaction เดียว activate run และเปลี่ยน active run เดิมของ workspace เป็น `superseded`; database constraint บังคับ active ได้ exactly one เมื่อ workspace เริ่ม sampling
- `locked → cancelled` หรือ `draft → cancelled`: ต้องมี reason/audit; cancelled เป็น terminal และไม่ selectable
- `active → superseded`: เกิดจาก activation ของ locked run ใหม่เท่านั้น; superseded immutable และใช้ได้เฉพาะ historical analysis ที่ผู้ใช้เลือก version อย่างชัดเจน

Assignment ใหม่ออกได้จาก `active` run เท่านั้น การเปลี่ยน active run หลังเริ่มเก็บข้อมูลต้องผ่าน change approval และไม่ย้าย assignment/consent/response อัตโนมัติ

## Assignment, consent, response, and review

1. `research_manager` assign sample member จาก active run ให้ collector ที่ active; collector เห็น contact เท่าที่จำเป็นและเฉพาะ assignment ตน Reassign/cancel ต้อง reasoned/audited; assignment ที่มี response submitted ไม่เปลี่ยน collector แบบ silent
2. Assigned collector **present privacy notice version ก่อน** แล้วจึง record consent decision ของ assignment เป็น `granted` หรือ `declined`; `admin`/`research_manager` ห้ามสร้างหรือเปลี่ยน consent
3. `declined`: เก็บเฉพาะ assignment reference, notice version, decision, collector actor UUID และ UTC timestamp ใน minimal consent/refusal audit; ห้ามสร้าง/แก้ farmer/farm baseline, response หรือ answer และจบ collection
4. `granted`: จึงอนุญาต collector สร้าง farmer/farm baseline และ response `draft` ที่ผูก assignment/approved questionnaire version ก่อน granted ทุก server/RLS write ต้อง deny
5. Assigned collector สร้าง/แก้ baseline/answer ได้เฉพาะ response `draft` ที่ consent ยัง granted และ assignment ยัง valid ขณะ `returned` มีสิทธิ์เพียง status-only resume `returned → draft`; transaction/RPC นี้ต้อง compare answer snapshot และ farmer/farm baseline fields ก่อน/หลังให้เหมือนเดิมทั้งหมด หาก payload พยายามเปลี่ยน content ต้อง reject ทั้ง operation หลัง resume commit สำเร็จ collector จึง edit content ใน operation ถัดไป แล้ว submit แบบ `draft → submitted` เมื่อ validation ผ่าน/online Idempotency ป้องกัน duplicate Collector ห้าม return/verify
6. `research_manager` review `submitted`: `submitted → returned` ต้องมี return reason หรือ `submitted → verified` พร้อม actor/time/schema digest Manager ไม่แก้ answer และห้าม capture consent/แก้ farm ledger
7. Verified correction เริ่มได้เฉพาะ manager ทำ `verified → returned` พร้อม required correction reason ระบบ preserve prior verified snapshot/digest และ audit before/after status จากนั้น assigned collector ทำ status-only `returned → draft` โดย content ไม่เปลี่ยน, edit answer ใน operation ถัดไป, แล้ว `draft → submitted`; manager ตรวจและทำ `submitted → verified` อีกครั้ง Full audit chain ต้องเชื่อม correction initiation, collector resumption, edit/resubmission และ re-verification โดยไม่ overwrite snapshot เดิม
8. `admin` ห้ามสร้างหรือเปลี่ยน response ทุกสถานะ Direct answer mutation โดย manager และ collector mutation ขณะ `submitted|verified|withdrawn` ต้องถูก deny

## Consent and withdrawal hard gate

Consent เป็น hard gate ทั้ง UI, server และ database constraint ผู้เข้าร่วมแจ้ง withdrawal request ได้ตามช่องทางที่อนุมัติ; `research_manager` assign/reassign ผู้รับดำเนินการ แต่ `field_collector` ที่ถือ assignment เท่านั้นเป็นผู้ capture `withdrawn` ในระบบ `admin`/manager ห้ามแก้ consent Withdrawal อนุญาตจาก response exactly `draft | submitted | returned | verified` และเป็น terminal ระบบทำ transaction เดียว: บันทึก required withdrawal reason code/notice, actor UUID, UTC timestamp และ before/after status, เปลี่ยน current consent และ response เป็น `withdrawn`, lock answer/review mutation, revoke draft/submission capability และ invalidate collection/analysis/export eligibility ทันที เก็บเพียง minimal withdrawal/audit record ที่จำเป็นตาม protocol/retention ไม่ถือ current consent ว่า granted และไม่ใช้คำตอบที่ถอนแม้เคย verified

Local draft ที่ยังอยู่บนอุปกรณ์ต้องถูกทำให้ส่งไม่ได้เมื่อเชื่อมต่อและระบบแจ้งให้ลบ การมี draft ไม่ถือเป็น consent หรือ server submission

## Questionnaire artifact contract

คำถามวิจัยจริง **จงใจไม่รวมอยู่ในเอกสารชุดนี้** และต้องผ่าน approval gate แยกก่อน implementation/collection Artifact ที่อนุมัติต้องมี:

- immutable `questionnaire_version`, approval identity/time และ content/schema digest
- stable `question_code`; เปลี่ยนความหมายต้อง code ใหม่
- Thai display text และ notice ที่ผ่านอนุมัติ ซึ่งไม่ถูกนิยามในเอกสารนี้
- typed answer (`text`, `integer`, `decimal`, `boolean`, `date`, `single_choice`, `multi_choice`), required/validation/skip-logic contract
- codebook: question code, type, option code/label, missing/refusal code, version range และ analysis treatment
- migration rule: response คงอ้าง version เดิม ไม่มี reinterpretation ย้อนหลัง

System-evaluation instrument ไม่ใช่ V1 entity หรือ CRUD capability หากเสนอหลัง V1 ต้องผ่าน approval gate แยกแบบเดียวกับ questionnaire/instrument contract นี้ พร้อม version/codebook/typed-answer approval โดยเอกสารนี้ไม่กำหนดคำถาม

## Funnel, analysis, and export eligibility

ทุก funnel/report query รับ `workspace_id`, `sampling_run_id` และ `[from_date,to_date]` ชุดเดียว `sampling_run_id` default เป็น run `active`; historical view ต้องเลือก run `superseded` อย่างชัดเจนพร้อมแสดง version `draft|locked|cancelled` เลือกไม่ได้ เพื่อให้ date filter ไม่เปลี่ยนความหมายระหว่าง stage, `cohort_date` ใช้ `sampling_run.locked_at` เดียวกันทุก stage และต้องอยู่ในช่วงวันที่ที่เลือก

**Shared base cohort predicate** คือ record อยู่ workspace เดียวกับ selected run, ผูก population snapshot ของ run นั้น, population record eligible และไม่ soft-delete, sample record (เมื่อมี) ไม่ soft-delete, `cohort_date` ผ่าน shared date filter และไม่มี consent/response withdrawal ของ member ใน run นั้น Stage predicate ต่อไปนี้ apply บน base เดียวกัน:

| Stage | Predicate เพิ่มจาก shared base |
|---|---|
| `population` | eligible population record ใน locked input snapshot ของ selected run |
| `sampled` | มี active/non-soft-deleted `sample_member` ใน selected run |
| `assigned` | sampled และมี current valid non-cancelled/non-soft-deleted assignment |
| `consent` | assigned และมี current consent `granted` |
| `submitted` | consent และ response status เป็น `submitted` หรือ `verified` |
| `verified` | consent และ response status เป็น `verified` |
| `export-eligible` | current consent `granted`, response `verified` และไม่ withdrawn |

ทุก stage ใช้ workspace/run/date filter เดียวกัน แต่ `population`, `sampled`, `assigned`, `consent`, `submitted` และ `verified` **ห้าม** reuse final `export-eligible` predicate มิฉะนั้น early-stage count จะหาย Export rows ใช้ `export-eligible` เท่านั้น Withdrawal ตัด member ออกจาก shared base/ทุก stage และ export ทันทีตาม protocol

Export ปริยายใช้ pseudonymous research ID, stratum, questionnaire version, typed answers ที่อนุมัติ และ derived non-identifying fields โดยตัดชื่อ, contact, auth ID, exact address/free-text ที่ระบุตัวได้, file path และ audit actor Full PII จำกัดตาม [Security and PDPA](SECURITY_PDPA.md) และทุก anonymized/full-PII export บันทึก mode, filter digest, selected sampling run, row count และ audit fields ตาม NFR-03 เพื่อทำซ้ำได้
