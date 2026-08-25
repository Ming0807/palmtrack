# PalmTrack development error and incident ledger

Ledger นี้บันทึกข้อผิดพลาด/เหตุการณ์ระหว่างการพัฒนา การจัดทำเอกสาร และ tooling แบบ sanitized เพื่อส่งต่อบริบทให้ทีม ไม่ใช่ application runtime log และห้ามนำ event จากผู้ใช้จริงมาใส่

## Required fields and handling

ทุก entry ต้องมี UTC timestamp, environment, severity, component, error code/sanitized message, impact, reproduction/evidence, resolution/status และ related commit หากไม่ทราบเวลาเกิดที่แน่นอนให้ใช้เวลา UTC ที่บันทึก entry และระบุข้อจำกัดนั้น ห้ามบันทึก secret, token, credential, private key, signed URL หรือ PII ของเกษตรกร/ผู้เข้าร่วม เช่น ชื่อ contact, identifier, exact location, consent linkage หรือ answer content ก่อน commit ต้องตรวจ pattern และอ่านทบทวนการระบุตัวบุคคล

Severity ใช้ `low | medium | high | critical`; status ใช้ `open | mitigated | resolved` และต้องอัปเดต entry เดิมด้วย resolution evidence แทนการลบประวัติ

## Entries

### DEV-20260825-001 — SSH host-key verification

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T03:54:01Z` (entry time; exact earlier event time was not captured) |
| Environment | documentation/setup session |
| Severity | low |
| Component | Git remote verification |
| Error code / sanitized message | `SSH_HOST_KEY_VERIFICATION_FAILED` — read-only GitHub SSH check could not verify the remote host key |
| Impact | SSH remote verification did not complete; no push was attempted |
| Reproduction / evidence | A read-only SSH remote check failed at host-key verification; an HTTPS read-only check confirmed that the remote exists and is empty |
| Resolution / status | `open` — establish and verify GitHub SSH trust/configuration through the approved setup process before any future push |
| Related commit | initial documentation root commit (`docs: establish PalmTrack project foundation`) |

### DEV-20260825-002 — WSL bash unavailable

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T03:54:01Z` (entry time; exact earlier event time was not captured) |
| Environment | documentation/review packaging session |
| Severity | low |
| Component | review-package tooling |
| Error code / sanitized message | `WSL_BASH_UNAVAILABLE` — WSL bash could not run the skill review-package script |
| Impact | The preferred script path was unavailable; documentation review work continued without data loss |
| Reproduction / evidence | Invoking the WSL bash path failed; a PowerShell fallback generated the diff review package successfully |
| Resolution / status | `resolved` — use the generated PowerShell diff package for this review; verify WSL installation/configuration before requiring that script path again |
| Related commit | initial documentation root commit (`docs: establish PalmTrack project foundation`) |

### DEV-20260825-003 — Optional skill adapter rejected global install

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:06:24Z` |
| Environment | skill installation session |
| Severity | low |
| Component | Skills CLI adapter installation |
| Error code / sanitized message | `OPTIONAL_ADAPTER_GLOBAL_INSTALL_UNSUPPORTED` — one optional adapter rejected global skill installation after the Codex copy succeeded |
| Impact | ไม่มีผลต่อ Codex; สกิล `impeccable` พร้อมใช้งาน แต่ adapter ที่ไม่รองรับ global mode ไม่ถูกติดตั้ง |
| Reproduction / evidence | Skills CLI reported the Codex skill copy as installed and separately reported the unsupported adapter |
| Resolution / status | `resolved` — verify and use the Codex copy at the installed user-level skill path; do not retry the unsupported adapter |
| Related commit | product/design context commit |

### DEV-20260825-004 — Pre-approval verifier rejected accepted status

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:06:24Z` |
| Environment | post-approval documentation verification |
| Severity | low |
| Component | documentation gate verifier |
| Error code / sanitized message | `LEGACY_GATE_ASSERTION` — verifier rejected the new `Accepted` document status because it encoded the former pre-approval gate |
| Impact | Legacy verification stopped before the remaining post-approval checks; no tracked data was lost |
| Reproduction / evidence | Running the original task verifier after explicit user approval reached its intentional contradictory-approval assertion |
| Resolution / status | `mitigated` — retain the original verifier as evidence for the initial commit and use a post-approval verification set for subsequent product/design commits |
| Related commit | product/design context commit |
