# PROGRESS — Phase 4 educative UI (2026-10-18)
Branch feat/educative-ui. Plan in TASKS.md Phase 4 (E1–E6).
## Decisions
- No new references: SPEC FR-SCI-03 allows only §11 refs; U-57 asserts refs.length 39. Cite the existing 39 (already Crossref-verified).
- About: keep 6 SPEC sections in order; ADD about-summary (top), about-primitives (after mapping), about-modes (after proposal).
- Tooltips: static title= in index.html; JS-set where JS owns the element (mode buttons, btn-key, readout-panel, presets).
- Disabled mode/key titles stay SPEC-exact; enabled state gets explanatory title.
- btn-about label -> "About the science"; a11y test E32 name updated.
## Now
Phase 4 done: PR #1 open, reviewed, findings resolved. Deferred-human: visual check of tooltips/About, re-shoot screenshot baselines.
