---
target: global application fallback states
total_score: 35
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
timestamp: 2026-08-26T18-11-20Z
slug: src-app-error-tsx
---
# Global fallback states — design critique

Method: dual-agent (A: fallback_ui_assessment · B: fallback_ui_detector)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Loading and error announcements are explicit |
| 2 | Match system / real world | 4 | Thai copy is plain and task-oriented after review fix |
| 3 | User control and freedom | 4 | Error offers retry and home; 404 offers home |
| 4 | Consistency and standards | 3 | Minor raw color/token drift remains |
| 5 | Error prevention | 3 | Safe presentation is enforced; client logging leak was removed |
| 6 | Recognition rather than recall | 4 | Every recovery action has a visible text label |
| 7 | Flexibility and efficiency | 3 | Keyboard path works; fallback actions are intentionally narrow |
| 8 | Aesthetic and minimalist design | 4 | Calm, focused minimal-premium composition |
| 9 | Error recovery | 4 | Actionable recovery without technical detail |
| 10 | Help and documentation | 2 | Recovery guidance is concise but no contextual support route exists |
| **Total** |  | **35/40** | **Good** |

## Design Specificity Verdict

The ivory/indigo/rust palette, Bai Jamjuree/Noto Sans Thai hierarchy, Lucide icons and restrained receipt-like surface feel consistent with PalmTrack's field-instrument identity rather than a generic error template. The deterministic detector returned `[]`. Browser evidence at 360×800 and 1280×900 found no overflow, a 44.9px mobile action, visible keyboard focus and measured text contrast from 5.25:1 to 14.09:1.

## Overall Impression

The fallback surfaces are calm, legible and operationally clear. The review's major issue was not visual: the original error boundary sent the raw Error object to the browser console despite a sanitized DOM. That leak, the incomplete traceability, disabled Axe contrast rule and weakened programmatic-focus test were corrected in the review-fix increment.

## What's Working

- One clear heading, short explanation and at most two recovery actions keep cognitive load low.
- Status/alert semantics, reduced motion, keyboard focus and 44px controls support assistive and mobile use.
- The 404 composition wraps cleanly at 360px and keeps the recovery action prominent.

## Priority Issues

1. **[Resolved P1] Raw Error console leak:** Removed raw client logging and added a sentinel regression covering DOM and console.
2. **[P2] Error-boundary focus landing:** The alert is announced, but the boundary does not explicitly move keyboard focus after replacing a crashed subtree. Revisit only if assistive-technology acceptance finds an actual lost-focus case. Suggested command: `$impeccable harden`.
3. **[P3] Token drift:** The decorative radial gradient uses a literal indigo RGBA and the primary action uses literal white. Consolidate only when theming introduces an approved on-accent/translucent token. Suggested command: `$impeccable polish`.

## Persona Red Flags

- **Sam (accessibility-dependent):** No blocking red flag in automated/browser evidence; explicit focus placement after an error swap remains the one manual screen-reader check.
- **Jordan (first-timer):** Recovery choices are plain and immediately visible; no jargon remains in loading copy.
- **Casey (distracted mobile):** Full-width mobile action and 44.9px target are usable one-handed; no overflow observed.

## Minor Observations

The centered mobile fallback card retains a light framed surface instead of the flatter product-shell treatment. Browser evidence showed it remains readable and spacious, so this is not release-blocking.

## Questions to Consider

If manual NVDA/VoiceOver acceptance later reports lost focus, should the error heading receive focus automatically, or should the retry action become the focus target?
