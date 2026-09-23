# PalmTrack reporting charts proposal (design review gate)

- Date: 2026-09-23
- Status: **Proposed — awaiting design review, DO NOT install yet** (`AGENTS.md` ห้ามเพิ่ม dependency จนกว่า gate ผ่านและมี implementation plan ที่อนุมัติ)
- Scope: FR-11 (profit report), FR-13 (anonymized dashboard), FR-16 (7-stage funnel); synthetic data only

## Problem

`grep chart|dashboard|funnel` ใน `src/` ได้ 0 hit — วงประเมินผลยังไม่มีกราฟเลย ทั้งที่ traceability ต้องการ: reconciliation รายรับ–รายจ่าย (FR-11), anonymized dashboard สำหรับ evaluator (FR-13), staged funnel 7 ขั้นบน shared base (FR-16) และ `NFR-05/NFR-06` ต้องการ charts ที่ใช้บนมือถือ 360 px ผ่าน keyboard และไม่พึ่งสีอย่างเดียว

## Options evaluated

1. **Recharts — recommended.** React-composable เข้ากับ App Router + CSS Modules, `ResponsiveContainer` จบ 360 px โดยไม่ scroll แนวนอน, ปรับ token minimal-premium (Noto Sans Thai body, Bai Jamjuree ตัวเลข, indigo/rust/amber) ได้ตรง `DESIGN.md`, bundle เพิ่มเล็ก, ใช้กับข้อมูล aggregate จาก reporting views ได้โดยไม่แตะ PII
2. **Victory.** a11y พื้นฐานดีกว่าเล็กน้อย แต่ API หนักกว่าและ theme ยากกว่า — ประโยชน์ไม่คุ้ม learning cost ของทีม 2–3 คน
3. **ECharts.** กราฟซับซ้อนสุดแต่ bundle ใหญ่ ไม่ใช่ React-native และเกินความต้องการ V1 (แท่ง/เส้น/funnel พื้นฐาน)
4. **Tremor.** สวยเร็วแต่ล็อกดีไซน์ของตัวเอง ขัด minimal-premium thesis และดึง dependency หนักโดยไม่จำเป็น

## Proposed contract (หลัง gate ผ่าน)

- Pin `recharts` ใน `package.json` + lockfile; render ผ่าน `next/dynamic` (`ssr: false`) พร้อม SSR fallback เป็นตารางตัวเลข (table-first, chart-second) เพื่อให้ evaluator อ่านได้โดยไม่พึ่ง JS กราฟ
- กราฟชุดแรก 3 ชุด: (a) funnel 7 ขั้นแบบ stepped bar ไทยพร้อม withdrawal-removed reconciliation (FR-16), (b) stacked allocation bar ต่อ stratum พร้อม quota/floor/remainder (FR-03 evidence), (c) profit report เส้น/แท่งรายเดือนพร้อม drill-down (FR-11) ทุกชุดใช้วันที่ พ.ศ. Asia/Bangkok (FR-15) และแสดงเฉพาะ aggregate ที่ anonymize แล้วสำหรับ evaluator (FR-13)
- Craft rules: ไม่พึ่งสีอย่างเดียว (icon + ข้อความกำกับแบบ evidence route), palette color-blind safe, `aria-table` fallback + keyboard, `prefers-reduced-motion`, empty/loading/error states ครบ, action target ≥44 px, axe serious/critical ต้องว่าง, 360 px assert `scrollWidth<=innerWidth`
- Data: อ่านจาก reporting views/RPC ที่บังคับ role ฝั่ง server/database เท่านั้น (deny-by-default, evaluator ไม่มี PII); ไม่เพิ่ม Storage/Service-role browser access

## Verification contract (ของ implementation plan ฉบับเต็ม)

- Unit: formatter ไทย (พ.ศ., ทศนิยม), funnel aggregation, anonymization projection (unit + negative)
- E2E: 360 px screenshots, keyboard path, axe, table-fallback โดยปิด JS กราฟ
- Traceability: ผูก `FR-11/13/16`, `NFR-05/06`, `REP-01/02`, `E2E-10/11/12/14`, `A11Y-01/02` โดยไม่กล่าวอ้างเกินจริง

## Approval needed

1. อนุมัติตัวเลือก Recharts + pin version 2. ออก implementation plan แยก (TDD task list) 3. จึง `npm install` + lockfile + implement ตาม plan
