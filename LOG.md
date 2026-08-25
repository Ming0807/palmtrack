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

### DEV-20260825-015 — Local Docker engine unavailable

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:14:33Z` |
| Environment | Safety Skeleton prerequisite verification |
| Severity | medium |
| Component | Supabase local database test runtime |
| Error code / sanitized message | `DOCKER_ENGINE_UNAVAILABLE` — the installed Docker client could not connect to the local Linux engine pipe |
| Impact | Supabase migration reset and PostgreSQL/RLS tests cannot be claimed until a compatible local container engine is running; TypeScript, build, and non-database tests remain available |
| Reproduction / evidence | A read-only Docker version check returned client version `29.1.2` and no server version because the expected local engine pipe was absent |
| Resolution / status | `resolved` — Docker engine became available; Supabase local reset, schema lint, and all 55 final pgTAP assertions passed, followed by the same 55 assertions against Supabase hosted |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-016 — Installed ESLint release is no longer supported

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:17:13Z` |
| Environment | Safety Skeleton dependency installation |
| Severity | low |
| Component | frontend lint toolchain |
| Error code / sanitized message | `ESLINT_RELEASE_UNSUPPORTED` — npm marks the repository's pinned ESLint `9.39.2` release as no longer supported |
| Impact | Installation and current lint execution remain available, but the lint runtime no longer receives upstream maintenance fixes |
| Reproduction / evidence | The package registry deprecation field and install warning both report that this exact release is unsupported |
| Resolution / status | `mitigated` — retain the version compatible with the verified Next.js prototype for this slice, keep audit results clean, and schedule a separately tested ESLint/Next lint-stack upgrade before production readiness |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-017 — Jest-only flag passed to Vitest

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:35:13Z` (entry time; exact earlier event time was not captured) |
| Environment | Safety Skeleton protected-shell unit verification |
| Severity | low |
| Component | unit test command |
| Error code / sanitized message | `VITEST_UNSUPPORTED_RUN_IN_BAND` — the first test command included a Jest-only option that Vitest does not accept |
| Impact | The first command stopped before test execution; no application assertion failed |
| Reproduction / evidence | The test runner rejected `--runInBand` as an unknown option |
| Resolution / status | `resolved` — rerun with the repository-native `npm test` command; the complete suite passed after the UI files were present |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-018 — UI inspection used a stale filename

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:35:13Z` |
| Environment | Safety Skeleton read-only source inspection |
| Severity | low |
| Component | protected-shell review command |
| Error code / sanitized message | `INSPECTION_PATH_NOT_FOUND` — the inspection requested singular `identity-state.tsx` while the implemented file is plural `identity-states.tsx` |
| Impact | One read command did not return the intended component; no file or runtime state changed |
| Reproduction / evidence | PowerShell reported the exact requested local path did not exist and the subsequent directory listing showed the plural filename |
| Resolution / status | `resolved` — inspect the discovered plural path and continue source review |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-019 — Parallel verification observed an incomplete shared slice

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:35:13Z` (entry time; exact earlier event time was not captured) |
| Environment | Safety Skeleton parallel subagent verification |
| Severity | low |
| Component | cross-slice TypeScript and test discovery |
| Error code / sanitized message | `PARALLEL_PARTIAL_TREE` — adapter verification ran while protected-shell test files existed before their implementation files were visible |
| Impact | One intermediate typecheck and three UI suites failed for missing modules; adapter-targeted tests and build passed |
| Reproduction / evidence | The shared worktree temporarily contained Task 5 tests without their matching production files during concurrent RED→GREEN execution |
| Resolution / status | `resolved` — wait for both disjoint agents to finish, then verify the integrated tree rather than treating an intermediate shared state as a product failure |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-020 — Empty-string redaction assertion was unsatisfiable

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T05:45:17Z` |
| Environment | Safety Skeleton sign-in contract TDD |
| Severity | low |
| Component | credential redaction unit test |
| Error code / sanitized message | `EMPTY_STRING_NEGATIVE_MATCH` — two invalid-input cases asserted that serialized output did not contain an empty submitted value, but every string contains the empty string |
| Impact | Two tests failed after the parser implementation even though the returned error object contained no submitted credential value |
| Reproduction / evidence | The failing cases were the intentionally blank identifier and blank password rows; the non-empty invalid value assertion behaved correctly |
| Resolution / status | `resolved` — retain the exact failure result assertion and run the redaction check only for non-empty submitted values; all five credential-boundary tests then passed |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-021 — Source search used an invalid regular expression and directory

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:00:15Z` (entry time; exact earlier event time was not captured) |
| Environment | Safety Skeleton E2E discovery |
| Severity | low |
| Component | repository source search |
| Error code / sanitized message | `RG_QUERY_AND_PATH_INVALID` — the first search pattern had an unclosed group and its corrected invocation named a non-existent `tests` directory instead of the repository's `e2e` directory |
| Impact | Two read-only searches stopped without changing files or application state |
| Reproduction / evidence | ripgrep first reported a regular-expression parse error and then a missing-directory error; `rg --files` located the actual E2E directory |
| Resolution / status | `resolved` — simplify the expression, discover test paths from tracked files, and search the correct `e2e` tree |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-022 — Next development indicator matched an application-control assertion

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:00:15Z` (entry time; exact earlier event time was not captured) |
| Environment | Chromium mobile and desktop Safety Skeleton E2E |
| Severity | low |
| Component | unconfigured sign-in browser test |
| Error code / sanitized message | `DEV_INDICATOR_CONTROL_FALSE_POSITIVE` — a page-wide control locator counted Next.js's development indicator button outside the application main region |
| Impact | The first full browser run reported two failures although the unconfigured application state rendered no form, input, or enabled application button; 25 other cases passed and one was intentionally skipped |
| Reproduction / evidence | Failure screenshots showed only the expected unconfigured state plus the framework development indicator in the viewport corner |
| Resolution / status | `resolved` — scope the no-control assertion to the semantic `main` region and rerun the Safety Skeleton suite; all eight mobile/desktop cases passed |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-023 — Secret-scan pattern was parsed as an option

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:06:57Z` |
| Environment | Safety Skeleton final secret verification |
| Severity | low |
| Component | repository secret-pattern scan |
| Error code / sanitized message | `RG_LEADING_HYPHEN_PATTERN` — the private-key pattern began with hyphens and was interpreted as a command option |
| Impact | Dependency audit passed, but the first secret scan stopped before inspecting repository content |
| Reproduction / evidence | ripgrep reported the leading pattern as an unrecognized flag |
| Resolution / status | `resolved` — add the explicit option terminator before the pattern and rerun; the repository scan passed with no match |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-024 — Production error card triggered the side-accent detector

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:06:57Z` |
| Environment | Impeccable production-shell verification |
| Severity | low |
| Component | sign-in error styling |
| Error code / sanitized message | `IMPECCABLE_SIDE_TAB` — a one-sided colored error border matched the detector's generic side-tab pattern |
| Impact | Functional and accessibility checks were unaffected, but the production sign-in surface did not meet the chosen visual craft floor |
| Reproduction / evidence | The detector returned one warning in the sign-in CSS and no finding in the identity components |
| Resolution / status | `resolved` — replace the side accent with a restrained full border and radius, simplify the app notice border, and rerun both app/UI detector scopes; both returned an empty result |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-025 — Static SQL review found a nonexistent JSON helper

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:06:57Z` (entry time; exact earlier review time was not captured) |
| Environment | Luna xhigh static Safety Skeleton migration review |
| Severity | high |
| Component | audit detail allowlist function |
| Error code / sanitized message | `POSTGRES_JSONB_OBJECT_LENGTH_UNAVAILABLE` — the migration draft called a JSON object-length helper that PostgreSQL does not provide |
| Impact | Every approved audit append would have failed during bootstrap or privileged transactions if the draft had been applied |
| Reproduction / evidence | Independent static review compared the function call with PostgreSQL's built-in JSON functions; the local database could not be run because the Docker prerequisite remains unavailable |
| Resolution / status | `resolved` — validate object type separately and count keys through `pg_catalog.jsonb_object_keys`; subsequent Docker-backed local and hosted PostgreSQL runs parsed the function and all 55 final pgTAP assertions passed |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-026 — Public environment defaults used an indirect browser access path

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:15:23Z` |
| Environment | final server/client boundary review |
| Severity | medium |
| Component | browser Supabase environment adapter |
| Error code / sanitized message | `NEXT_PUBLIC_INDIRECT_ENV_ACCESS` — the public parser defaulted to the whole process environment and then read variables indirectly, which does not provide Next.js's explicit browser inlining contract |
| Impact | A configured browser build could still resolve as unconfigured even when approved public values were supplied |
| Reproduction / evidence | Root integration review traced the browser adapter to `parsePublicEnv()` and compared the access shape with the framework's direct `NEXT_PUBLIC_*` compile-time boundary |
| Resolution / status | `resolved` — construct the default input from direct `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` expressions; targeted env/session tests, typecheck, lint, and final Luna review passed |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-027 — Session adapter expected the wrong profile ID field

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T06:15:23Z` |
| Environment | final RPC/application contract review |
| Severity | high |
| Component | verified identity session resolver |
| Error code / sanitized message | `PROFILE_RPC_FIELD_MISMATCH` — the SQL RPC returns `profile_id` while the resolver initially required `id` |
| Impact | Every otherwise valid authenticated profile returned by the implemented RPC would have collapsed to the forbidden state |
| Reproduction / evidence | Root compared the migration's fixed-return signature with the TypeScript projection before database runtime was available |
| Resolution / status | `resolved` — accept the exact `profile_id` contract (while retaining injected fixture compatibility), add an explicit resolver regression test, and pass 103 tests plus final Luna review with no P0/P1/P2 |
| Related commit | pending Safety Skeleton implementation commit |

### DEV-20260825-028 — Hosted migration requested superuser-only role attributes

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time; user reported the event earlier) |
| Environment | Supabase hosted PostgreSQL 17.6 migration |
| Severity | high |
| Component | internal database-role hardening |
| Error code / sanitized message | `42501` — a non-superuser migration session attempted `ALTER ROLE ... NOSUPERUSER` together with other provider-managed attributes |
| Impact | The initial Safety Skeleton migration rolled back before creating application tables |
| Reproduction / evidence | Supabase reported that only a role with `SUPERUSER` may alter the `SUPERUSER` attribute; PostgreSQL documentation confirms this restriction even when requesting the negative form |
| Resolution / status | `resolved` — create each role with safe defaults, inspect `pg_roles`, and fail closed on unsafe pre-existing attributes without requesting superuser-only changes; local and hosted migrations passed |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-029 — Diagnostic lookup used the wrong Vitest config suffix

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | local repository diagnosis |
| Severity | low |
| Component | test-runner configuration discovery |
| Error code / sanitized message | `PATH_NOT_FOUND` — attempted to read `vitest.config.ts` while the repository uses `vitest.config.mts` |
| Impact | One read-only inspection stopped; no files changed |
| Reproduction / evidence | PowerShell reported the requested path did not exist; `rg --files` returned the actual `.mts` path |
| Resolution / status | `resolved` — discover config filenames before reading and use the tracked `.mts` file |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-030 — Combined patch targeted the same file twice

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | environment-contract implementation |
| Severity | low |
| Component | repository patch application |
| Error code / sanitized message | `APPLY_PATCH_DUPLICATE_TARGET` — one patch attempted delete and add operations against the same two files |
| Impact | The patch was rejected atomically and made no change |
| Reproduction / evidence | Patch validation rejected multiple operations targeting the same path |
| Resolution / status | `resolved` — split deletion and addition into separate atomic patches, then rerun targeted tests |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-031 — PostgreSQL rejected a repeated self-admin grant

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local PostgreSQL 17 role migration |
| Severity | high |
| Component | internal role membership needed for function ownership |
| Error code / sanitized message | `0LP01` — `ADMIN` option cannot be granted back to the grantor itself |
| Impact | The first Docker-backed migration attempt rolled back in the role bootstrap block |
| Reproduction / evidence | PostgreSQL 17 automatically creates a provider-admin grant for roles created by a non-superuser; requesting another self-grant with `ADMIN TRUE` is invalid |
| Resolution / status | `resolved` — retain the provider administration grant and add a separate `ADMIN FALSE, INHERIT FALSE, SET TRUE` membership required for owner transfer; reject all other memberships |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-032 — Audit allowlist CASE expression did not parse

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local migration parser |
| Severity | high |
| Component | append-only audit function |
| Error code / sanitized message | `42601` — syntax error in an unparenthesized `IF CASE` expression |
| Impact | Migration parsing stopped before privileged functions were installed |
| Reproduction / evidence | PostgreSQL identified the `private.append_audit_event` function body and stopped at the CASE branch |
| Resolution / status | `resolved` — parenthesize the SQL CASE expression inside the PL/pgSQL IF condition; both local and hosted parsers accepted the migration |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-033 — Function owners lacked CREATE on their schemas

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local migration ownership transfer |
| Severity | high |
| Component | hardened SECURITY DEFINER ownership |
| Error code / sanitized message | `42501` — permission denied for schema `private` during function-owner transfer |
| Impact | Migration stopped before applying the dedicated function owners |
| Reproduction / evidence | PostgreSQL requires a new function owner to hold `CREATE` on the containing schema; the draft granted only `USAGE` |
| Resolution / status | `resolved` — grant schema `CREATE` only to the two NOLOGIN owner roles on the exact `public`/`private` schemas they own functions in |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-034 — Function comments were applied after owner transfer

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local migration ownership sequence |
| Severity | medium |
| Component | bootstrap and recovery function metadata |
| Error code / sanitized message | `42501` — migration session was no longer the function owner when applying `COMMENT ON FUNCTION` |
| Impact | Migration reached its final statements but rolled back before commit |
| Reproduction / evidence | Database error identified the recovery function comment immediately after its owner was changed |
| Resolution / status | `resolved` — apply comments while the migration session still owns each function, before transferring ownership |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-035 — pgTAP helper was unavailable after switching to recovery role

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local pgTAP suite |
| Severity | medium |
| Component | recovery-role positive-path tests |
| Error code / sanitized message | `42883` — `lives_ok(unknown, unknown)` was not visible after `SET LOCAL ROLE palmtrack_recovery_executor` |
| Impact | The database test file stopped after 19 of 54 assertions |
| Reproduction / evidence | The hardened recovery role intentionally lacks access to the schema containing pgTAP helpers |
| Resolution / status | `resolved` — execute the recovery operation directly under the role, reset role, then record one pgTAP `pass`; production privileges remain unchanged |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-036 — Supabase protected auth schema from the custom owner role

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local bootstrap runtime |
| Severity | high |
| Component | Auth UID verification boundary |
| Error code / sanitized message | `42501` — permission denied for schema `auth` inside the transaction-owner function |
| Impact | Workspace bootstrap could not verify its synthetic Auth user |
| Reproduction / evidence | Catalog inspection showed table `SELECT` but no effective schema `USAGE`; Supabase retained its protected auth-schema ACL |
| Resolution / status | `resolved` — keep auth access in a fixed-argument, boolean SECURITY DEFINER helper owned by the database operator; grant only its execution to the transaction owner and remove direct auth-table access |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-037 — Function ACL changes occurred after owner transfer

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | Supabase local pgTAP and ACL catalog inspection |
| Severity | critical |
| Component | privileged function execution grants |
| Error code / sanitized message | `ACL_ORDERING_PUBLIC_EXECUTE` — recovery role could execute the audit writer because `PUBLIC EXECUTE` remained after ineffective post-transfer revokes |
| Impact | Privileged functions were broader than the intended caller allowlist even though their dedicated owners were correct |
| Reproduction / evidence | pgTAP failed assertion 46; `pg_proc.proacl` showed `=X` and no intended explicit caller ACL after ownership transfer |
| Resolution / status | `resolved` — order every privileged function as create, revoke default access, grant exact callers, then transfer owner; local and hosted pgTAP passed all 55 final assertions and remote ACL inspection contains no `PUBLIC` entry |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-038 — Supabase generated code entered the lint scope

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T14:28:13Z` (entry time) |
| Environment | full repository verification after local Supabase start |
| Severity | low |
| Component | ESLint generated-file boundaries |
| Error code / sanitized message | `GENERATED_SUPABASE_LINT_SCOPE` — vendor edge-runtime code under `supabase/.temp` produced 205 lint findings |
| Impact | The first full `npm run verify` stopped at lint despite application source remaining clean |
| Reproduction / evidence | Every finding pointed to one Supabase-generated temporary bundle already excluded from Git |
| Resolution / status | `resolved` — add `supabase/.temp/**` and `supabase/.branches/**` to ESLint global ignores; full lint, typecheck, 108 tests, and production build passed |
| Related commit | pending hosted migration compatibility commit |

### DEV-20260825-039 — Chained commit command did not stop after diff check warning

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T15:03:26Z` |
| Environment | local Git documentation commit |
| Severity | low |
| Component | design-document verification command |
| Error code / sanitized message | `DIFF_CHECK_CHAIN_CONTINUED` — `git diff --cached --check` reported a trailing blank line but the following commit still ran |
| Impact | The design commit initially contained one whitespace-only warning; content and repository security were unaffected |
| Reproduction / evidence | The PowerShell command used semicolon-separated checks without an explicit `$LASTEXITCODE` guard |
| Resolution / status | `resolved` — remove the trailing blank line, amend the commit, verify `git show --check`, and require explicit exit-code guards before later mutating commands |
| Related commit | population import design/plan documentation commit |

### DEV-20260825-040 — Applied hosted migration was pasted into SQL Editor again

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T15:03:26Z` |
| Environment | Supabase hosted SQL Editor |
| Severity | low |
| Component | ordered migration operation |
| Error code / sanitized message | `42P07` — relation `workspace` already exists |
| Impact | The repeated migration transaction stopped at the existing table; no table deletion or schema reset was required |
| Reproduction / evidence | Read-only migration history showed version `202608250001` already matched local and remote before the file was run again |
| Resolution / status | `resolved` — do not rerun `202608250001`; apply each new ordered migration once through migration tooling and verify history before any manual SQL execution |
| Related commit | population import design/plan documentation commit |

### DEV-20260825-041 — Rollback script was discovered as a pgTAP test

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T15:42:00Z` |
| Environment | Supabase local database suite |
| Severity | low |
| Component | migration rollback rehearsal |
| Error code / sanitized message | `NO_TEST_PLAN` — the Supabase CLI treated a compensating rollback SQL file below `supabase/tests/` as pgTAP |
| Impact | The migration and 98 database assertions passed, but the aggregate test command exited non-zero after executing the rollback file |
| Reproduction / evidence | `supabase test db` recursively discovered every SQL file below its tests directory |
| Resolution / status | `resolved` — move operational rollback SQL to `supabase/rollback/`; a clean reset, both database files, and database lint now pass |
| Related commit | population import persistence commit |

### DEV-20260825-042 — Node could not spawn the Windows npx shim directly

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T15:55:00Z` |
| Environment | Windows local E2E launcher |
| Severity | low |
| Component | fail-closed Playwright harness |
| Error code / sanitized message | `EINVAL` — Node 26 rejected `spawnSync("npx.cmd", ...)` although the same shim worked interactively in PowerShell |
| Impact | The first local browser run stopped before reading local Supabase status or creating test identities |
| Reproduction / evidence | A minimal child-process probe returned a null exit status and `EINVAL`; Docker services remained healthy |
| Resolution / status | `resolved` — invoke npm's `npx-cli.js` through the current Node executable, retaining argument-array isolation without a command shell |
| Related commit | local population-import E2E commit |

### DEV-20260825-043 — Project label matched a non-database Docker container

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T16:02:00Z` |
| Environment | Supabase local E2E setup |
| Severity | low |
| Component | local database target guard |
| Error code / sanitized message | `AMBIGUOUS_LOCAL_CONTAINER` — two running containers carried the same Supabase project label |
| Impact | Fail-closed setup stopped before profile seeding |
| Reproduction / evidence | Label-only discovery returned the expected database plus one unrelated generated container |
| Resolution / status | `resolved` — resolve the exact `supabase_db_palmtrack` name, then independently verify its project label before piping SQL |
| Related commit | local population-import E2E commit |

### DEV-20260825-044 — PostgreSQL UNION inferred role literals as text

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T16:04:00Z` |
| Environment | synthetic local profile seed |
| Severity | low |
| Component | local E2E role fixture |
| Error code / sanitized message | `42804` — `app_role` column received a text expression from a UNION query |
| Impact | Auth users were created after reset but profile setup rolled back atomically |
| Reproduction / evidence | PostgreSQL resolved the UNION literal column as text before assignment to the enum column |
| Resolution / status | `resolved` — cast every role and status literal to the exact public enum types; teardown/reset removes partial Auth fixtures |
| Related commit | local population-import E2E commit |

### DEV-20260825-045 — Browser alert query also matched Next route announcer

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T16:07:00Z` |
| Environment | authenticated Playwright local suite |
| Severity | low |
| Component | sanitized validation-summary assertion |
| Error code / sanitized message | `STRICT_MODE_VIOLATION` — `role=alert` matched both the form summary and Next's empty route announcer |
| Impact | One browser assertion failed although the sanitized validation summary rendered correctly and no database row was written |
| Reproduction / evidence | Browser output identified two semantic alerts; all role negatives and positive flows continued to pass |
| Resolution / status | `resolved` — scope the assertion by the stable Thai summary copy; targeted mobile/desktop rerun passed |
| Related commit | population import evidence documentation commit |

### DEV-20260825-046 — Protected application routes were prerendered without runtime environment

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T16:18:00Z` |
| Environment | Next.js 16 production build without local environment values |
| Severity | high |
| Component | protected `/app` request-time boundary |
| Error code / sanitized message | `STATIC_AUTH_BOUNDARY` — build output marked `/app`, `/app/research` and `/app/research/population` as static |
| Impact | A deployment built without runtime Supabase values could cache the unconfigured state instead of resolving cookies and environment per request |
| Reproduction / evidence | `next build` showed static route symbols because environment parsing returned before the conditional `cookies()` call was reached during prerendering |
| Resolution / status | `resolved` — the protected parent layout now awaits Next.js `connection()` before session resolution; repeat build must mark every `/app` route dynamic |
| Related commit | population import evidence documentation commit |

### DEV-20260825-047 — Generic browser config discovered local-auth-only tests

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T16:21:00Z` |
| Environment | generic unconfigured Playwright suite |
| Severity | medium |
| Component | browser environment isolation |
| Error code / sanitized message | `LOCAL_SPEC_IN_GENERIC_PROJECT` — the default test directory discovered the new authenticated population spec while public environment values were intentionally blank |
| Impact | Existing isolated browser tests passed, but local-auth journeys failed before sign-in because their setup was not active |
| Reproduction / evidence | Default config collected 44 tests including the local-only file; its web server correctly exposed only the truthful unconfigured state |
| Resolution / status | `resolved` — default config explicitly ignores the local-only spec; `playwright.local.config.ts` remains its sole runner and fail-closed environment owner |
| Related commit | population import evidence documentation commit |

### DEV-20260825-048 — Live locator rebound to another pending receipt

| Field | Value |
|---|---|
| UTC timestamp | `2026-08-25T16:27:00Z` |
| Environment | two-project authenticated Playwright suite |
| Severity | low |
| Component | accepted-snapshot wait condition |
| Error code / sanitized message | `LOCATOR_REBOUND_TIMEOUT` — a live `.first()` locator rebound to an older validated receipt after the clicked button detached |
| Impact | Mobile project passed; two desktop positive tests timed out even though the requested snapshots were accepted |
| Reproduction / evidence | Earlier idempotency coverage intentionally left another validated receipt in the shared per-run database |
| Resolution / status | `resolved` — retain the clicked element handle and wait for that exact element to become hidden instead of re-evaluating a collection locator |
| Related commit | population import evidence documentation commit |
