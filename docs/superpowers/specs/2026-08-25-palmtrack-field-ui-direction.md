# PalmTrack field UI direction

Status: **Accepted by delegated design decision for prototype**

Date: 2026-08-25
Scope: synthetic-data UX/UI only; this document does not approve a questionnaire, real data, or production deployment.

## Outcome

The prototype will combine two complementary structures instead of forcing one screen pattern across the workflow:

- **Queue-first home (Direction A)** for `field_collector`: scan priorities, resume work, and understand offline readiness in seconds.
- **Evidence route (Direction C)** inside one assignment: show auditable progression through assignment, notice/consent, baseline, farm ledger, and review.
- **Receipt discipline (Direction B)** contributes aligned codes, dates, quantities, and restrained separators, but its dense table is not the mobile home structure.

The user delegated continued execution without a pause. Three high-fidelity mobile north-star comps were rendered before implementation and compared against the accepted product context, Luna field-UX review, and the Impeccable craft floor. Reviewable PNGs and embedded prompt provenance are in the [decision-comp index](../../assets/ui-comps/README.md).

## Distinct prototype variants

The prototype route must expose `?variant=A|B|C` and a development-only switcher:

| Variant | Structural question | Must remain distinct |
|---|---|---|
| A — Queue | Can a collector choose the correct next job fastest? | Numbered priority list, compact queue summary, immediate row action |
| B — Receipt | Does evidence-ticket density improve audit scanning? | Aligned data columns, code-led rows, hairline separators |
| C — Route | Does a state-machine spine make protected order obvious? | One focused assignment, checkpoint states, next-step action, queue peek |

The canonical comparison route is `/prototype/field?variant=A|B|C`. The recommended handoff starts at `/prototype/field?variant=A`; opening assignment `SSK-024` navigates to `/prototype/field/SSK-024?variant=C`. B remains an explicit comparison, not the chosen production home.

## Visual world

- Warm chalk/ivory base, charcoal copy, deep indigo controls, rust for overdue/correction, amber for caution.
- Thai-first typography with a locally bundled readable body face; assignment codes and measurements use tabular numerals.
- Mostly flat surfaces, hairline rules, and one grounded action surface. No gradient, glass, decorative leaf, generic KPI-card grid, or farm-green cliché.
- Status always has text plus icon/shape; color never carries meaning alone.
- Core UI remains semantic HTML/CSS. Generated images are decision references only and are not shipped as UI.

## Product and research safeguards

- Every record is visibly marked `ข้อมูลตัวอย่าง` and uses fictional codes/places only.
- Consent precedes baseline. Returned work is read-only until the user explicitly resumes editing.
- Offline means IndexedDB draft plus online submission; the prototype must not imply bidirectional sync.
- Minimum target size is 44×44 CSS pixels, with visible keyboard focus, reduced-motion support, and a working 360px layout.
- The prototype must not invent questionnaire questions, collect real PII, call a live backend, or imply a production deployment.
- Baseline/questionnaire content is a non-interactive `รออนุมัติเครื่องมือวิจัย` boundary: no invented question, answer field, or response persistence is permitted.

## Acceptance for the prototype

1. A/B/C are reachable from one route and remain structurally different rather than palette variants.
2. The recommended A→C flow can be exercised with keyboard and pointer.
3. Offline, syncing, returned, loading, empty, and error demonstrations are reachable without network calls.
4. Mobile screenshots at 360px and desktop screenshots show no clipping or horizontal scroll.
5. Automated component checks, production build, accessibility-oriented browser assertions, Impeccable detector, and fresh Luna review all pass or are logged in `LOG.md` with mitigation.
6. The A→C journey uses the canonical routes above and tests the exact transition from queue item to assignment evidence route.
