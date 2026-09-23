# PalmTrack Sampling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ส่งมอบ FR-03 + NFR-04 เป็น vertical slice แบบ trustless server replay ให้ `research_manager` สร้าง/lock/activate/cancel รอบสุ่มที่ทำซ้ำได้จาก accepted snapshot ผ่าน Thai UI โดยมี RLS/audit/test ครบ

**Architecture:** เพิ่ม bounded module `research/population` ส่วน sampling ใต้ modular monolith เดิม Pure domain (`yamane/allocation/deterministic`) สร้าง preview evidence; server action ตรวจ verified session แล้วเรียก Supabase RPC; PostgreSQL transaction owner recompute ทุก input จาก snapshot (seed chain, candidate hash, largest remainder, mulberry32 shuffle, selection) แล้ว mới persist UI สืบทอด evidence-route visual system

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2.8, TypeScript 5.9.3, Zod 4.4.3, Supabase SSR/PostgreSQL 17/RLS/pgTAP, Vitest/Testing Library, Playwright/axe, CSS Modules

## Global Constraints

- ใช้เฉพาะข้อมูลสังเคราะห์ (`SYN-*`, seed `palmtrack-acceptance-seed-v1` ใน test); ห้าม PII, questionnaire, consent, response
- V1 workspace เดียว ทุก table มี non-null `workspace_id`; ไม่มี tenant selector
- `e` อยู่ใน `(0,1)`; seed text/normalized ยาว 1–200; hash exact `^[0-9a-f]{64}$`; `stratum_code` exact `^[A-Z0-9_-]{1,24}$`
- Write จำกัด `research_manager` (รวม `admin` ถูก deny โดยตั้งใจ); read จำกัด `admin | research_manager | evaluator_readonly`
- Migration ทดสอบ local Docker เท่านั้น ห้าม apply hosted ในรอบนี้
- ทุก production behavior ใช้ TDD: pgTAP red (forged evidence ผ่าน, cancel-from-locked พัง) ก่อน green
- UI ภาษาไทย, 360 px ไม่ overflow, keyboard, visible focus, live status, WCAG 2.1 AA; action target ≥44 CSS px
- Traceability ของ slice: `FR-03`, `FR-15`, `NFR-01`, `NFR-03`, `NFR-04`, `NFR-05`, `NFR-06`, `NFR-08`, `NFR-09`; evidence IDs `UNIT-01`, `UNIT-02`, `UNIT-08`, `INT-02`, `E2E-03`, `AUD-01`

---

### Task 1: Pure sampling domain contract — [x] done 2026-09-14

- [x] **Step 1: RED/GREEN Yamane** — `sampling-yamane.ts` + 6 tests (`N=121, e=0.05 → 93` fixture)
- [x] **Step 2: RED/GREEN largest remainder** — `sampling-allocation.ts` + 4 tests (quota/floor/remainder/final, tie-break, capacity)
- [x] **Step 3: RED/GREEN deterministic shuffle** — `sampling-deterministic.ts` + 3 tests (byte contract, replay identity)

### Task 2: Sampling lifecycle migration — [x] done, hardened 2026-09-23

- [x] **Step 1: Tables/RLS/audit** — `sampling_run` lifecycle 5 สถานะ + single-active unique, `sample_member` immutable, FORCE RLS, owner-only policies, `202608250003` + rollback `supabase/rollback/`
- [x] **Step 2: RED trustless replay tests** — pgTAP `003` ขยาย 22 → 34: replay-exact draft, forged member/allocation/hash/digest/u32 (5 แบบต้อง `22023`), lock → cancel-from-locked (ต้องผ่าน), cancel-from-draft — RED เห็น fail 7/34 ตรงจุด
- [x] **Step 3: GREEN replay** — `create_sampling_draft` recompute seed chain/candidate hash/allocation/shuffle/selection จาก snapshot; แก้ `lock_state_check` ให้ cancelled-from-locked เก็บ `locked_at` — GREEN 132/132 (`001+002+003`)

### Task 3: Server gateway/service/actions — [x] done 2026-09-14

- [x] **Step 1: gateway RPC contract** — 9-column receipt projection, fail-closed `CONFLICT/UNAVAILABLE` (7 tests)
- [x] **Step 2: service auth + evidence pre-check** — manager-only writes, zod + allocation/order/dup pre-check (9 tests)
- [x] **Step 3: FormData actions** — fail-closed states + `revalidatePath` (3 tests)

### Task 4: Thai sampling UI + navigation — [x] done 2026-09-14

- [x] **Step 1: `/app/research/sampling` evidence route** — preview → draft/lock/activate/cancel, role=status/alert, 5 tests
- [x] **Step 2: role navigation** — sampling entry สำหรับ manager/admin/evaluator ตามสิทธิ์

### Task 5: Local authenticated evidence — [ ] rerun after hardening

- [ ] **Step 1: rerun `test:e2e:local` sampling 10/10** — replay-hardened draft ต้องผ่าน flow เดิม (draft→lock→activate, supersede, role negatives, axe, overflow)
- [ ] **Step 2: rerun population E2E 16/16** — กัน regression ข้าม slice
- [ ] **Step 3: refresh `docs/assets/sampling/`** — ถ้า UI เปลี่ยน; ไม่เช่นนั้นคง evidence เดิมพร้อมบันทึกว่า replay hardening ไม่แตะ UI

### Task 6: Hosted migration (deferred, needs user-run SQL)

- [ ] **Step 1: apply `202608250002` + `202608250003` บน hosted** — ตรวจ history ก่อนรันทีละไฟล์ ห้าม rerun `001`
- [ ] **Step 2: pgTAP 132/132 บน hosted + ACL inspection ไม่มี `PUBLIC EXECUTE`**
- [ ] **Step 3: บันทึก hosted evidence ใน ROADMAP/TRACEABILITY** — จึงถือ increment 2 เสร็จบน hosted

### Task 7: Known P1 follow-ups (not in this slice)

- [ ] evaluator detail exposure → aggregate-only หรืออนุมัติข้อยกเว้น
- [ ] sampling idempotency key (แบบ population slice)
- [ ] `admin` write หรือ ADR ยืนยัน manager-only
- [ ] 121-member acceptance vector + allocation quota evidence เต็มใน allocation JSONB
