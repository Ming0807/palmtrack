# PalmTrack design system

Status: **Implemented for the field prototype and role-aware product dashboard**

This document records the visual and interaction system that exists in code. Product requirements, research rules, security controls, and data semantics remain authoritative in [the documentation index](docs/INDEX.md).

## Design thesis

PalmTrack should feel like a calm, auditable field instrument rather than a generic analytics dashboard. The system combines:

- a **queue-first field worksheet** for choosing the next assignment quickly;
- an **evidence route** inside one assignment so protected workflow order remains visible;
- **receipt-like numeric discipline** for codes, counts, dates, and future ledger values.

The product is farm operations and data analytics first. Research provenance remains visible where authorized, but must never dominate the information hierarchy of the product home.

Direction A is the recommended collector home. Opening `SSK-024` moves to Direction C at `/prototype/field/SSK-024?variant=C`. Direction B remains available for comparison through the local prototype switcher.

## Foundations

| Token family | Implementation |
|---|---|
| Canvas | Warm chalk/ivory surfaces (`--paper`, `--surface`) suited to daylight field use |
| Text | Charcoal `--ink`; secondary copy uses contrast-safe `--muted` |
| Action/evidence | Deep indigo `--indigo` and `--indigo-deep` |
| Correction/overdue | Restrained rust `--rust`, never color-only |
| Waiting/caution | Amber with explicit text and lock/state icons |
| Type | Self-hosted Noto Sans Thai Variable for body; Bai Jamjuree for headings and record codes |
| Shape | 12–16px grounded radii; full pills only for true status labels |
| Depth | One wide soft frame shadow on desktop; mobile uses flat edge-to-edge surfaces |

Core controls use Lucide SVG icons with consistent stroke weight. Browser selection, scrollbars, focus rings, numeric alignment, reduced motion, and underline offset are themed rather than left as unrelated defaults.

## Composition contracts

### A — queue worksheet

- Heading and compact operational totals precede the queue.
- Assignment rows share one ruled surface with a numbered margin; they are not a grid of cards.
- Each row exposes status text, icon, synthetic area code, stratum, counts, deadline, and one next action.
- Only `SSK-024` has an enabled journey in this prototype; other action controls are explicitly disabled and labeled as unavailable.

### B — evidence receipt

- Codes, areas, counts, and status occupy aligned columns on wider screens.
- At 360px the row becomes a two-column receipt without horizontal scrolling.
- B informs numeric hierarchy but is not the recommended collector home.

### C — evidence route

- One focused assignment precedes a single vertical state-machine spine.
- Completed, waiting, locked, returned, and terminal meanings combine icon, shape, and text.
- Notice/consent always appears before baseline.
- Baseline shows `รออนุมัติเครื่องมือวิจัย`; no question, answer field, response form, or response persistence exists.

### Product dashboard — operational ledger

- `/app` starts every role at `ภาพรวม`; operational metrics, cash/harvest trend and next work precede research evidence.
- Four metrics share one ruled ledger strip instead of becoming a card wall. Money is received as canonical decimal strings and formatted only at the presentation boundary.
- Missing production backends render explicit `not_enabled`/`unavailable` copy and no fabricated value or active-looking dead action.
- The synthetic `/prototype/dashboard` exposes five roles and five deterministic states with a persistent synthetic-data notice.
- The bar chart is a quick visual comparison; an accessible table is the numeric source for users who cannot or do not want to interpret the chart.

## Interaction and state

The local state lab exposes `default`, `loading`, `empty`, `validation`, `forbidden`, `not-found`, `stale`, `offline`, `syncing`, `service-unavailable`, `success`, and `returned`. It makes no network request and is labeled as prototype-only.

- Returned work remains read-only until `กลับมาแก้ไข` is pressed.
- Offline mode stores only a synthetic `instrument-pending` checkpoint in IndexedDB and states that submission happens when online. It does not imply bidirectional synchronization.
- Enabled actions are at least 44 CSS pixels high; focus is visible and keyboard switching between A/B/C uses arrow keys.
- Motion is limited to the initial frame reveal, syncing icon, and loading surface; reduced-motion preferences collapse these animations.

## Responsive behavior

- Mobile (`≤720px`): edge-to-edge app frame, stacked operational totals, full-width row actions, single-column assignment boundary, sticky bottom navigation, and safe trailing content padding.
- Desktop: centered 940px application frame with more horizontal evidence density and a separate local prototype control surface.
- Automated 360px checks assert no horizontal overflow. Mobile and desktop evidence is stored in the [prototype screenshot index](docs/assets/ui-prototype/README.md).

## Prototype boundary

All fixtures are synthetic and visibly labeled `ข้อมูลตัวอย่าง`. The prototype has no authentication, Supabase connection, live API, real farmer data, questionnaire renderer, external storage, deployment configuration, or cloud resource. Those capabilities require the next approved vertical-slice plan and the existing research/privacy/restore gates.
