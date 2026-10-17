# TASKS — Spec for JEV neuronal-microcircuit demo
Goal: SPEC.md (impl-ready, multi-agent long-horizon, browser-tested w/ screenshots) + README guide. Spec only, no app code.
Source: "I had an idea in my dreams. What if JEV (Typesafe)(1).md" (Perplexity convo).

| ID | Desc | Status | Verify by |
|----|------|--------|-----------|
| R1 | Verify Perplexity-cited papers (DOI resolve, claim match) | done (9/9 named DOIs verified; safe-cite list in report) | .agent/reports/R1.md exists, table DOI→verdict |
| R2 | Own web research: cortical microcircuit, LIF, dendrites, STDP, V1 RFs, browser SNN demos | done (24 crossref-verified refs) | .agent/reports/R2.md, ≥12 refs w/ DOI/URL |
| R3 | JEV API facts: endpoint, auth, request/response schema, CORS from browser, limits, pricing | done (CORS blocked, verified by controller curl; proxy ruling in S1 addendum) | .agent/reports/R3.md w/ live probe evidence |
| S1 | Draft docs/SPEC.md from R1-R3 + rulings | done (1545 lines, commit 85441ce, key scan clean) | file exists, all sections in brief |
| V1 | Adversarial reviews x3 (security/key, implementability+test, science) | done (sec 2C/6I, impl 2C/25I, sci 1C/6I; all PASS-WITH-FIXES) | reports/V1-*.md |
| S2 | Fix wave on spec | done 2026-10-17 (grep checks empty, key scan clean, all V1 IDs mapped in reports/S2.md; re-review pending) | re-review clean of Critical/Important |
| V2 | Scoped re-review v1.1 | done (PASS-WITH-FIXES: 1C/10I, reports/V2.md) | report |
| S3 | Apply V2 C-1 + I-1..I-10 | done 2026-10-17 (grep empty, key scan CLEAN, all V2 IDs in reports/S3.md) | grep + V2 IDs mapped in reports/S3.md |
| D1 | README guide + commit | done 2026-10-17 (README from SPEC §9, reviewed by controller) | git log |
