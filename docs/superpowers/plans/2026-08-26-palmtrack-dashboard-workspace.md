# PalmTrack dashboard workspace implementation plan

Status: Executed on 2026-08-26

Goal: replace the generic protected-home skeleton with a truthful, role-aware farm/data dashboard and a deterministic review surface without adding a database migration or cloud mutation.

1. Add failing contracts for overview-first navigation, prototype states, decimal money, role filtering, component hierarchy and `/app` wiring.
2. Complete the dashboard domain/read provider, keeping production fixtures isolated and unsupported farm aggregates explicit.
3. Implement the reusable dashboard view, `/app` server wiring and `/prototype/dashboard` role/state controls.
4. Reframe authoritative product/UX/traceability documents so farm operations and analytics are primary and research remains supported.
5. Verify focused tests, 360px/desktop Playwright, axe, detector, full repository checks, secret/link scans and Git state before commit/push.

No schema, RLS policy, hosted Supabase object, dependency or CI resource is added by this slice.
