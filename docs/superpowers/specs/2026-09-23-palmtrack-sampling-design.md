# PalmTrack sampling design

- Date: 2026-09-23
- Status: Approved for implementation under the accepted roadmap and the user's autonomous-continuation instruction
- Scope: FR-03 + NFR-04 tracer bullet only; single workspace; synthetic data only; local Supabase first

## Job and audience

`research_manager` ต้องสร้างรอบการสุ่มที่ทำซ้ำได้จาก accepted population snapshot: เลือก `e`, seed, ตรวจ preview ของ allocation และผลการสุ่ม แล้ว lock → activate โดยทุกค่าตรวจสอบย้อนกลับถึง algorithm evidence ได้ `admin` และ `evaluator_readonly` อ่านรายละเอียดและหลักฐานได้อย่างเดียว ไม่สร้างหรือเปลี่ยน lifecycle

## Approaches considered

1. **Trustless server replay — selected.** Client คำนวณ preview เพื่อ UX แต่ `create_sampling_draft` recompute ทุก input จาก accepted snapshot ฝั่ง database (seed chain, candidate hash, largest-remainder allocation, mulberry32 Fisher–Yates shuffle, member selection) และปฏิเสธทุกค่าที่ไม่ตรงบิตต่อบิต ทำให้ NFR-04 พิสูจน์ได้โดยไม่ต้องเชื่อ client
2. **Client-trusted evidence (เดิม).** ตรวจแค่ความยาว/ผลรวม/format ทำให้ caller ปลอมสมาชิกหรือ allocation ที่รวมได้ target เดียวกันได้ — ถูก pgTAP พิสูจน์ว่า accept forged evidence จึงไม่เลือก
3. **Server-only shuffle ไม่มี preview.** ปลอดภัยแต่ผู้ใช้ไม่เห็นผลก่อน lock ทำให้ review ก่อน commit ไม่ได้และขัด evidence-route thesis

## Outcome and proof

รอบสุ่มมี lifecycle `draft → locked → active` พร้อม `superseded` (เมื่อ active รอบใหม่) และ `cancelled` (จาก draft หรือ locked) workspace มี active ได้รอบเดียว (`single-active` unique) สูตร Yamane `yamane-v1` (`ceil(N/(1+N·e²))`), allocation largest remainder พร้อม byte-wise tie-break, algorithm `sha256-mulberry32-fy-v1` (NFC → UTF-8 → SHA-256 → BE u32 → mulberry32 → Fisher–Yates → quota walk) ทุก transition เขียน audit `sampling.draft_created/locked/activated/superseded/cancelled` พร้อม actor/workspace/status before-after/target/digest/hash และ `cancel_reason_digest` แทน raw reason

หลักฐานตรวจรับของ slice คือ `FR-03`, `FR-15`, `FR-16` (partial: shared base), `NFR-01`, `NFR-03`, `NFR-04`, `NFR-05`, `NFR-06`, `NFR-08`, `NFR-09` ผ่าน `UNIT-01`, `UNIT-02`, `UNIT-08`, `INT-02`, `E2E-03`, `AUD-01` hosted migration `202608250002/003` ยัง pending จึงยังไม่ถือว่า FR-03 ทั้งวงจรเสร็จบน hosted

## Data and lifecycle

`sampling_run` เก็บ `population_import_id`, `version`, `population_size`, `margin_of_error`, `target_n`, `formula_version`, `seed_text`, `seed_normalized`, `seed_digest_hex`, `seed_u32`, `algorithm_version`, `ordered_candidate_set_hash`, `allocation`, `status`, `locked_at`, `locked_by`, `activated_by`, `cancel_reason`, attribution และ timestamps `sample_member` เก็บ `(sampling_run_id, population_member_id, stratum_code, selection_order)` แบบ immutable (update/delete/truncate ถูกปฏิเสธ)

`cancelled` จาก draft มี `locked_at` ว่าง ส่วนจาก locked เก็บ `locked_at` เดิมไว้เป็นหลักฐานว่าเคย lock (constraint อนุญาตทั้งสองแบบ; guard trigger อนุญาต transition ทั้งสองทาง) `lock` ต้องส่ง candidate hash และ seed digest ตรงกับ draft (replay-on-lock) `activate` จาก locked เท่านั้นและ supersede active เดิมใน transaction เดียว

## Trust boundary

- Write transitions จำกัด `research_manager` เท่านั้น (รวม `admin` ถูก deny — ตั้งใจให้แคบกว่า population slice และบันทึกไว้ตรงนี้) Read จำกัด `admin | research_manager | evaluator_readonly`
- Server recompute: Yamane target, seed digest/u32 chain, ordered candidate hash (length-prefixed stream), allocation ทั้งชุด (quota/floor/remainder/final + capacity), shuffle ทั้งชุด, member selection ทั้งชุด (id/stratum/order) หลักฐานปลอมได้ `22023`, ละเมิดสิทธิ์ได้ `42501`, idempotency/version conflict ได้ `23505/40001 → conflict`
- NFC normalization เป็น client attestation ที่เก็บ `seed_text` + `seed_normalized` ไว้ตรวจซ้ำได้ ส่วน digest/u32/hash/selection ตรวจฝั่ง server ทั้งหมด

## Surface and interaction

หน้า production อยู่ที่ `/app/research/sampling` สืบทอด minimal-premium evidence route: หัวเรื่อง + badge สังเคราะห์ → ฟอร์ม `e` + seed → preview allocation ต่อ stratum → preview selection พร้อม candidate hash → draft/lock/activate/cancel พร้อม reason ไทยล้วน ปุ่มหลักสูง ≥44 px, focus ชัด, status/error ประกาศผ่าน live region (`role=status/alert`), 360 px ไม่ overflow แนวนอน

## States and errors

`idle → preview → draft → locked → active` พร้อม `validation` (evidence ไม่ผ่าน), `forbidden` (role ไม่ใช่ manager / non-enumerating), `conflict` (replay ไม่ตรงที่ lock, version/idempotency ชน), `cancelled` (terminal พร้อมเหตุผล), `service_unavailable` (fail-closed ไม่รั่ว SQL/state) client ไม่แสดง SQL, stack, UID หรือ digest ดิบเกิน receipt

## Boundaries and anti-goals

- ไม่ apply migration ไป hosted ในรอบนี้; ไม่รับ real farmer data; ไม่เพิ่ม PII columns, Storage, tenant selector
- ไม่สร้าง draft edit/regenerate (draft เป็น append-only; สร้างใหม่แทน) ไม่ render questionnaire/consent/answer
- evaluator detail exposure (farmer_code/seed/cancel reason) เป็น P1 ที่รู้แล้ว ต้องจำกัดเหลือ aggregate หรืออนุมัติข้อยกเว้นก่อน hosted acceptance
- ไม่แก้ requirement authoritative; slice นี้ทำให้ implementation ตรง NFR-04 ที่มีอยู่ ไม่เพิ่ม requirement ใหม่

## Verification contract

- pgTAP `003` 34 assertions: replay-exact draft ผ่าน, forged member/allocation/hash/digest/u32 ถูกปฏิเสธทั้ง 5 แบบ, lock → cancel-from-locked ผ่านพร้อม status `cancelled`, cancel-from-draft ผ่าน
- Domain/unit 184 tests, typecheck, lint, production build (`/app/research/sampling` dynamic), local authenticated E2E 10/10 (draft→lock→activate, supersede invariant, role negatives, axe, overflow) พร้อม visual evidence `docs/assets/sampling/README.md`
