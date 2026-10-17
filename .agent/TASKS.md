# TASKS — Spec for JEV neuronal-microcircuit demo
Goal: SPEC.md (impl-ready, multi-agent long-horizon, browser-tested w/ screenshots) + README guide. Spec only, no app code.
Source: "I had an idea in my dreams. What if JEV (Typesafe)(1).md" (Perplexity convo).

| ID | Desc | Status | Verify by |
|----|------|--------|-----------|
| R1 | Verify Perplexity-cited papers (DOI resolve, claim match) | done (9/9 named DOIs verified; safe-cite list in report) | .agent/reports/R1.md exists, table DOI→verdict |
| R2 | Own web research: cortical microcircuit, LIF, dendrites, STDP, V1 RFs, browser SNN demos | done (24 crossref-verified refs) | .agent/reports/R2.md, ≥12 refs w/ DOI/URL |
| R3 | JEV API facts: endpoint, auth, request/response schema, CORS from browser, limits, pricing | done (CORS blocked, verified by controller curl; proxy ruling in S1 addendum) | .agent/reports/R3.md w/ live probe evidence |
| S1 | Draft docs/SPEC.md from R1-R3 + rulings | in-progress 2026-10-17 | file exists, all sections in brief |
| V1 | Adversarial reviews x3 (security/key, implementability+test, science) | todo | reports/V1-*.md |
| S2 | Fix wave on spec | todo | re-review clean of Critical/Important |
| D1 | README guide + commit | todo | git log |
