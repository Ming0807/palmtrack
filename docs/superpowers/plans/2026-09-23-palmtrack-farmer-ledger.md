# PalmTrack Farmer Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ส่งมอบ FR-08–FR-11 เป็น vertical slice ให้ `farmer` จัดการสวน/แปลง/bันทึก/ขาย ดูกำไรขาดทุนและวิเคราะห์ 3 แบบ ด้วยข้อมูลจริงผ่าน Thai mobile UI โดยมี RLS/audit/test ครบ — งานตามหัวข้อหลัก

**Architecture:** เพิ่ม bounded module `farm` ใน modular monolith เดิม Pure domain (precision/formula) + server actions ตรวจ verified session + Supabase RPC แบบ owner-only (transaction owner + `owner_user_id` check) + Thai UI สืบทอด evidence-route/minimal-premium + Recharts ผ่าน reporting module เดิม ไม่แตะ research tables

**Tech Stack:** stack เดิมทั้งหมด + Recharts (มีแล้ว 3.10.1) ไม่เพิ่ม dependency ใหม่

## Global Constraints

- ใช้เฉพาะข้อมูลสังเคราะห์ ห้าม PII จริง; farmer เห็น/แก้เฉพาะของตน; admin/manager/collector/evaluator เขียน ledger ไม่ได้
- เงิน `decimal(14,2)`; ปริมาณ/น้ำหนัก/พื้นที่ `decimal(14,3)`; `gross = qty × price`; profit = active sales.net − active expenses.amount
- UI ไทย ขั้นตอนสั้น 360 px keyboard focus live-region WCAG 2.1 AA ปุ่ม ≥44 px
- ทุก production behavior ใช้ TDD red/green; migration ทดสอบ local Docker ห้าม apply hosted
- Traceability: `FR-08–FR-11`, `FR-15`, `NFR-01/03/05/06/08/09`; IDs `UNIT-04/05/06`, `RLS-05`, `INT-07/08/09`, `E2E-07/08/09/10`, `AUD-03`, `REP-01`

---

### Task 1: farmer/farm/plot foundation — [ ] pending

**Files:** `supabase/migrations/202608250004_farm_ledger.sql`, `supabase/rollback/`, `supabase/tests/database/004_farm_ledger.test.sql`, `src/modules/farm/...`

- [ ] **Step 1: RED/GREEN tables + RLS** — `farmer` (owner FK profile), `farm`, `plot` พร้อม workspace FK, attribution, soft-delete + FORCE RLS owner-only + pgTAP (owner allow, cross-owner/admin/manager deny)
- [ ] **Step 2: RED/GREEN domain + service** — validation ชื่อ/พื้นที่ `decimal(14,3)` + service/gateway/actions (UNIT-04 เริ่มที่นี่)

### Task 2: activity/expense ledger — [ ] pending

- [ ] **Step 1: RED/GREEN tables + RPC** — `activity`, `expense` (amount/category/business date) + idempotency + pgTAP (INT-08, AUD-03 soft-delete)
- [ ] **Step 2: RED/GREEN Thai UI** — ฟอร์มบันทึกพร้อม validation + E2E-08

### Task 3: harvest/sale + formulas — [ ] pending

- [ ] **Step 1: RED/GREEN formula domain** — gross/net recompute ฝั่ง server ตรง client preview (UNIT-05)
- [ ] **Step 2: RED/GREEN tables + RPC** — `harvest`, `sale` (farm บังคับ, plot/harvest ไม่บังคับ, FK integrity) + pgTAP (INT-09)
- [ ] **Step 3: RED/GREEN Thai UI** — ฟอร์มขายพร้อม gross/net preview + E2E-09

### Task 4: profit report + drill-down — [ ] pending

- [ ] **Step 1: RED/GREEN report RPC** — profit ตามช่วง + drill-down ตัด deleted rows, fixture 9,000.25 (UNIT-06, REP-01)
- [ ] **Step 2: RED/GREEN Thai UI** — หน้ากำไร/ขาดทุน + E2E-10

### Task 5: 3 analysis views (Recharts + table fallback) — [ ] pending

- [ ] **Step 1: กำไรรายเดือน + ต้นทุนตามหมวด** — monthly bars + category breakdown (stacked) จาก ledger จริง
- [ ] **Step 2: ราคาขาย + ผลผลิตแนวโน้ม** — unit price line + weight bars ตามเวลา
- [ ] **Step 3: เปรียบเทียบแปลง** — profit/expense/sale ต่อ plot แบบ grouped bars
- [ ] **Step 4: E2E + axe + 360px** — ทุกหน้าวิเคราะห์ (table fallback เปิดอ่านได้โดยไม่ต้องมีกราฟ)

### Task 6: verify + ship — [ ] pending

- [ ] full verify (unit/typecheck/lint/build + pgTAP + E2E farmer) + visual evidence `docs/assets/farm-ledger/`
- [ ] commit + push พร้อม evidence; hosted migration `004` คง pending ให้ผู้ใช้รันเอง

### Explicitly paused (not this plan)

- Field collection / Review-privacy research flow (ROADMAP 4–5 เดิม) — กลับมาทำเมื่อหัวข้อหลักเสร็จหรือผู้ใช้สั่ง
- Hosted `002/003` — คงสภาพ pending
- Funnel 7 ขั้น evaluator — รอ research flow กลับมา
