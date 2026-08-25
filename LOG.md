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

### DEV-20260825-005 — Markdown link verifier lost file context

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:22:25Z` |
| Environment | UX/UI prototype documentation verification |
| Severity | low |
| Component | local Markdown link verifier |
| Error code / sanitized message | `POWERSHELL_NESTED_PIPELINE_CONTEXT_COLLISION` — nested use of the pipeline item variable produced a null base path |
| Impact | The first ad-hoc link-check command stopped before reporting results; no file or application data was modified by the failed command |
| Reproduction / evidence | A nested match loop replaced the outer file object before its directory was resolved |
| Resolution / status | `resolved` — capture the file directory in a named variable before iterating link matches, then rerun all documentation checks |
| Related commit | UX/UI direction and prototype-plan commit |

### DEV-20260825-006 — Scaffold cleanup blocked by safety policy

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:34:16Z` |
| Environment | isolated UX/UI prototype worktree |
| Severity | low |
| Component | local Next.js scaffold cleanup |
| Error code / sanitized message | `RECURSIVE_DELETE_POLICY_REJECTED` — the command runner rejected cleanup of the verified scaffold staging directory |
| Impact | Required scaffold files were copied successfully; an ignored local staging copy remains under the agent-work directory and no tracked source was deleted |
| Reproduction / evidence | Both a combined copy-and-clean command and a later exact recursive cleanup command were rejected before execution |
| Resolution / status | `mitigated` — leave the ignored staging copy untouched; it is excluded from Git and application builds, and cleanup is not required for prototype correctness |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-007 — Testing Library peer dependency absent

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:37:18Z` |
| Environment | UX/UI prototype unit-test harness |
| Severity | low |
| Component | Vitest / Testing Library setup |
| Error code / sanitized message | `MISSING_TESTING_LIBRARY_DOM_PEER` — DOM matchers could not load because their explicit peer package was absent |
| Impact | The first RED test run stopped in setup before reaching the intentionally missing production modules |
| Reproduction / evidence | All three suites failed while importing the matcher setup and reported the same missing package |
| Resolution / status | `resolved` — pin and install `@testing-library/dom` `10.4.1`, then rerun RED to confirm failures reach the intended missing implementation boundary |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-008 — TypeScript lacked Vitest globals

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:46:47Z` |
| Environment | UX/UI prototype static verification |
| Severity | low |
| Component | TypeScript test configuration |
| Error code / sanitized message | `VITEST_GLOBAL_TYPES_UNDECLARED` — test execution recognized the Vitest globals but `tsc` did not |
| Impact | Unit tests passed, while the first standalone typecheck failed on test-only names before evaluating the remaining project |
| Reproduction / evidence | `tsc --noEmit` reported undeclared `describe`, `it`, and `expect` in all three test files |
| Resolution / status | `resolved` — add `vitest/globals` to TypeScript compiler types and rerun unit, typecheck, and lint verification |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-009 — Internal route used a raw anchor

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:47:16Z` |
| Environment | UX/UI prototype lint verification |
| Severity | low |
| Component | local state recovery navigation |
| Error code / sanitized message | `NEXT_INTERNAL_ANCHOR_RULE` — an internal recovery link used an HTML anchor instead of the framework navigation component |
| Impact | Lint failed on one navigation element; runtime data and route behavior were unaffected |
| Reproduction / evidence | ESLint reported `@next/next/no-html-link-for-pages` in the state boundary component |
| Resolution / status | `resolved` — replace the anchor with `next/link` and rerun lint plus build verification |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-010 — State-lab E2E locator was over-specific

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:51:24Z` |
| Environment | Chromium mobile and desktop E2E verification |
| Severity | low |
| Component | accessibility/state-lab browser test |
| Error code / sanitized message | `SUMMARY_EXACT_TEXT_LOCATOR_TIMEOUT` — the test required an exact text node while the accessible summary also contained its current-state label |
| Impact | Two axe/state-lab test instances timed out; the other 17 browser journeys passed and one desktop duplicate was intentionally skipped |
| Reproduction / evidence | Both viewports waited for the same exact-text locator until the 30-second test timeout |
| Resolution / status | `resolved` — target the semantic `summary` element by contained label, retain the 12-state assertion, and rerun the full E2E suite before accepting accessibility results |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-011 — Development page requested a missing favicon

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:54:27Z` |
| Environment | Playwright CLI visual/console inspection |
| Severity | low |
| Component | Next.js document metadata asset |
| Error code / sanitized message | `FAVICON_RESOURCE_404` — the browser requested the default favicon path and received a local not-found response |
| Impact | One console error appeared during an otherwise successful semantic snapshot; application content and data flow were unaffected |
| Reproduction / evidence | CLI console inspection showed one failed local `favicon.ico` request and no other browser error |
| Resolution / status | `resolved` — add an authored project-local SVG app icon and re-open the route to verify a clean console |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-012 — Vitest collected Playwright specifications

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:57:50Z` |
| Environment | fresh Luna finish review verification |
| Severity | medium |
| Component | test-suite discovery boundary |
| Error code / sanitized message | `CROSS_RUNNER_TEST_COLLECTION` — Vitest discovered browser E2E specifications after they were added and rejected Playwright's test registration |
| Impact | Unit cases remained valid but the repository-level `npm test` command was no longer green, which would also break the combined verification script |
| Reproduction / evidence | Fresh review reran `npm test` after E2E files existed and reproduced the cross-runner import failure |
| Resolution / status | `resolved` — scope Vitest explicitly to `src/**/*.test.{ts,tsx}` and rerun unit, lint, typecheck, build, and Playwright commands from the completed tree |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-013 — Stale local Next.js server blocked E2E startup

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T04:58:57Z` |
| Environment | post-review Playwright verification |
| Severity | low |
| Component | local development web server lifecycle |
| Error code / sanitized message | `NEXT_DEV_SERVER_ALREADY_RUNNING` — Playwright could not start its isolated server because a prior review server for the same worktree was still active |
| Impact | The verification command exited before launching any browser test; no application assertion failed |
| Reproduction / evidence | Next.js reported the existing local process and worktree; a read-only process check confirmed its executable and server path belonged to this prototype |
| Resolution / status | `resolved` — stop only the verified stale process, preserve all files, and rerun the full E2E suite on the configured isolated port |
| Related commit | pending UX/UI prototype scaffold commit |

### DEV-20260825-014 — Synthetic-fixture grep matched a negative test assertion

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:02:52Z` |
| Environment | final repository content verification |
| Severity | low |
| Component | synthetic-only text scanner |
| Error code / sanitized message | `NEGATIVE_ASSERTION_FALSE_POSITIVE` — a broad geography-term scan matched the prohibited terms inside a unit assertion that verifies they are absent |
| Impact | The first synthetic-fixture check stopped without evaluating its remaining steps; production fixture content was not implicated |
| Reproduction / evidence | The sole hit was the test expression `not.toMatch(...)` rather than an assignment value or rendered label |
| Resolution / status | `resolved` — scan the production fixture module separately and keep the negative assertion as independent automated protection |
| Related commit | pending UX/UI prototype scaffold commit |
