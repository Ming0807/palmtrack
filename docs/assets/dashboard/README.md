# Dashboard visual evidence

ภาพในโฟลเดอร์นี้สร้างจาก `/prototype/dashboard?role=research_manager&scenario=typical` ด้วย fixture สังเคราะห์แบบ deterministic เท่านั้น ไม่ใช่ข้อมูลเกษตรกรจริง

- `chromium-mobile.png` — viewport 360×800
- `chromium-desktop.png` — viewport 1365×900

Acceptance run ตรวจลำดับ farm operations → analytics → work queue → research support, table alternative, ไม่มี horizontal overflow, loading ไม่มีตัวเลขปลอม และ axe ไม่มี serious/critical finding
