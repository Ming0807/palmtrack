# PalmTrack UX/UI prototype implementation plan

Status: **Approved by the user's instruction to continue without waiting**
Design input: [field UI direction](../specs/2026-08-25-palmtrack-field-ui-direction.md)

## Goal

Create a local, synthetic-data, mobile-first Next.js prototype that makes three structural directions directly comparable, then verify and document the recommended queue-to-evidence-route flow before implementing live services.

## Task 1 — isolated scaffold and quality harness

Commit the accepted direction/plan/provenance first, then create an isolated Git worktree from that commit. Scaffold Next.js `16.3.2` App Router with React `19.2.8`, TypeScript, ESLint, Tailwind CSS `4.3.3`, Lucide React `1.34.0`, locally bundled Fontsource Thai packages `5.3.0`, Vitest `4.1.11`/Testing Library, Playwright `1.62.1`, and `@axe-core/playwright` `4.13.0`. Pin the local Node runtime as `26.1.0`, commit the npm lockfile, and keep secrets and cloud resources absent.

Verification: clean install, unit-test command executes, lint/typecheck/build commands execute, no environment file is required.

## Task 2 — red tests for prototype contracts

Add failing tests for variant parsing, synthetic fixture labeling, queue priority order, protected workflow order, the canonical A→`SSK-024`→C navigation, returned-record edit lock, offline status wording, variant-switch keyboard behavior, and the non-interactive `รออนุมัติเครื่องมือวิจัย` guard with no question/answer fields or persistence.

Verification: capture the intended red failures before implementation.

## Task 3 — implement three structures

Implement `/prototype/field?variant=A|B|C` with shared tokens and synthetic fixtures but separate composition components. Add a development-only floating variant switcher with arrow-key support. Implement the recommended A queue home and `/prototype/field/SSK-024?variant=C` assignment route. The assignment route may show the consent checkpoint and baseline boundary, but baseline must remain non-interactive pending instrument approval. Expose a local-only state lab for `default`, `loading`, `empty`, `validation`, `forbidden`, `not-found`, `stale`, `offline`, `syncing`, `service-unavailable`, `success`, and `returned`; it must not make network calls or imply bidirectional synchronization.

Verification: tests turn green; at 360px all primary actions are at least 44px and no content clips.

## Task 4 — interaction and accessibility proof

Add Playwright journeys for switching A/B/C, the canonical A→`SSK-024`→C link, preserving consent-before-baseline order, proving the instrument boundary contains no interactive response fields, resuming a returned item explicitly, keyboard focus, and offline-state copy. Run mandatory `@axe-core/playwright` scans on the queue and assignment route; if the scanner itself is incompatible with the pinned browser/runtime, log the tooling failure and execute documented manual assertions for landmarks, names, tab order, focus visibility, contrast, reduced motion, target size, and horizontal overflow before considering the task verified.

Verification: browser tests pass in Chromium; reduced-motion and focus-visible behavior are covered.

## Task 5 — batched visual QA and refinement

Run the app locally and inspect desktop plus mobile screenshots in one pass. Fix overflow, hierarchy, Thai copy, state distinction, and browser surfaces. Run the Impeccable detector once across the final changed UI targets, then request a fresh Luna finish review.

Verification: lint, typecheck, unit, E2E, production build, detector, and Luna review evidence are recorded; any failure is sanitized in `LOG.md`.

## Task 6 — record the shipped design and plan the first real slice

Create `DESIGN.md` from the built result, link it from the document index, and write the next test-first implementation plan for the Safety Skeleton slice (auth/profile/roles/workspace seam/RLS/audit/Thai shell). Do not provision Supabase/Vercel, push, or implement a questionnaire in this prototype increment.

Verification: source-of-truth links remain valid, no unfinished marker, secret, or PII exists, and Git diff/status are reviewed before commit.
