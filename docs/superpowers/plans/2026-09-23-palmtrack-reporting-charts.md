# PalmTrack Reporting Charts Implementation Plan (lot 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** กราฟแท่งการจัดสรร sampling ด้วยข้อมูลจริง (preview + locked/active runs) ผ่าน Thai evidence-route UI โดยมี table fallback, a11y และ test ครบ — ไม่สร้าง backend ใหม่ ไม่แตะ hosted

**Architecture:** เพิ่ม bounded module `reporting` ใน modular monolith เดิม Pure domain format/palette + client chart component (Recharts ผ่าน `next/dynamic ssr:false`) รับ rows จาก data ที่มีอยู่แล้ว (`preview.allocation`, `detail.allocations` + `members`) ตารางข้อมูลอยู่นอก dynamic boundary จึงเห็นเสมอแม้กราฟยังไม่โหลด

**Tech Stack:** + Recharts (pin exact, React 19 compatible) นอกนั้น stack เดิมทั้งหมด

## Global Constraints

- ใช้เฉพาะข้อมูลจริงที่มีอยู่แล้ว + สังเคราะห์ ห้าม PII ใหม่ ห้าม migration ใหม่ ห้าม apply hosted
- ไม่พึ่งสีอย่างเดียว: icon/text/pattern กำกับ, palette color-blind safe ต่อจาก `DESIGN.md`
- Table fallback มองเห็นได้เสมอ (ไม่ใช่ visually-hidden), `role=img` + aria-label สรุปภาษาไทย, keyboard เข้าถึงตารางได้, `prefers-reduced-motion` ปิด animation
- 360 px ไม่ overflow (`scrollWidth<=innerWidth`), action/controls ≥44 px, axe serious/critical ว่าง
- ทุก production behavior ใช้ TDD: test fail ด้วยเหตุผลที่คาดก่อน implementation
- Traceability ล็อตนี้: `FR-03` (evidence), `FR-15` (เลขไทย), `NFR-05/06` เท่านั้น — ห้ามอ้าง `FR-11/13/16` จนกว่า backend ของ increment ถัดไปจะมา

---

### Task 1: Reporting domain format — [x] done 2026-09-23

**Files:**
- Create: `src/modules/reporting/domain/chart-format.ts`
- Create: `src/modules/reporting/domain/chart-format.test.ts`

- [x] **Step 1: RED/GREEN Thai formatters + palette** — `formatThaiInt` (`Intl th-TH-u-nu-thai`; bare `th-TH` keeps Latin digits — ICU default), `formatThaiDecimal4`, `CHART_PALETTE` (indigo-first + Okabe–Ito, ≥6 ชุด), `describeChartSummary` — RED เห็น fail (missing module + Latin digits) แล้ว green 5/5

### Task 2: AllocationChart UI — [x] done 2026-09-23

**Files:**
- Create: `src/modules/reporting/ui/allocation-chart.tsx`
- Create: `src/modules/reporting/ui/allocation-chart.test.tsx`
- Create: `src/modules/reporting/ui/allocation-chart.module.css`

- [x] **Step 1: RED/GREEN component** — `figure > figcaption + Recharts horizontal bars + details > table`, `role=img` + aria-label สรุปไทย, N_h column ซ่อนเมื่อไม่มีข้อมูล — green 4/4
- [x] **Step 2: RED/GREEN table-outside-dynamic proof (adapted)** — ตาราง SSR เดิม (`allocationTable` ใน preview + RunCard) อยู่นอก `next/dynamic ssr:false` boundary อยู่แล้ว จึง assert ใน flow test ว่า loading fallback + ตาราง SSR เห็นพร้อมกันแทนการแยก table component ใหม่ (ลด duplication โดยไม่ลด contract)

### Task 3: Wire into sampling flow — [x] done 2026-09-23

**Files:**
- Edit: `src/modules/research/population/ui/sampling-run-flow.tsx` (+ test)
- Edit: `e2e/sampling.spec.ts` (chart + table assertions)

- [x] **Step 1: preview chart** — ใต้ตาราง preview (data: `preview.allocation` ครบ quota/N_h)
- [x] **Step 2: run chart** — ใน RunCard ทุกรอบที่มี allocations (evaluator เห็นได้ ไม่มี mutation control)
- [x] **Step 3: E2E assertion** — `allocation-chart` + `ตารางกราฟการจัดสรร` visible แล้ว rerun sampling 10/10

### Task 4: Docs + verify + ship — [x] done 2026-09-23

- [x] **Step 1: DESIGN.md** — chart token section (palette/loading/table-fallback contract)
- [x] **Step 2: full verify** — unit/typecheck/lint/build + pgTAP 132/132 (กัน regression) + E2E sampling
- [x] **Step 3: commit + push** — `feat: add sampling allocation charts` พร้อม evidence ใน message

### Deferred (not this lot)

- Funnel 7 ขั้น / profit report / evaluator dashboard — รอ assignment/consent/ledger backend (increments 3–6)
- 121-member acceptance vector, evaluator aggregate-only, sampling idempotency (ตาม sampling plan Task 7)
