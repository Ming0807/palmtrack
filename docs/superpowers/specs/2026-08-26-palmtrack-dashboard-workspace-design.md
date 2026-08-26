# PalmTrack dashboard workspace design

Status: Implemented locally on 2026-08-26

## Product decision

PalmTrack is a farm-operations and data-analytics product that can support research. The shared product home therefore leads with farm cash/harvest operations and role-specific next work. Sampling and research provenance remain a quieter, authorized support section.

## Production contract

`/app` is server-rendered from the authorized session. It may read aggregate population/sampling evidence for `admin`, `research_manager`, and `evaluator_readonly`; farmer and collector sessions do not invoke those research reads. Synthetic fixtures are not imported by the production provider. Until a farm-ledger backend exists, operational values and analytics use explicit `not_enabled` states instead of invented totals. Actions without a working module are non-interactive and explain why they are pending.

## Prototype contract

`/prototype/dashboard` is a deterministic, database-free review surface. Query parameters select one of five roles and `typical`, `empty`, `loading`, `partial`, or `unavailable`. Every view carries a visible synthetic-data notice. Money crosses the read-model boundary as canonical two-decimal strings; the chart has a table equivalent.

## Responsive and visual contract

The visual direction is minimal premium: warm paper, deep indigo, restrained rust, ruled ledger rows and no decorative card wall. The same content order is kept at 360px and desktop. Controls are at least 44px high, status is never color-only, and motion is disabled for reduced-motion preferences.

## Acceptance evidence

Unit/component tests cover role navigation, role-filtered reads, decimal fixtures, loading and route wiring. Playwright covers both configured viewports, farm-first heading order, synthetic labeling, table visibility, loading without fabricated values, horizontal overflow and serious/critical axe findings. Captures are indexed in [dashboard visual evidence](../../assets/dashboard/README.md).
