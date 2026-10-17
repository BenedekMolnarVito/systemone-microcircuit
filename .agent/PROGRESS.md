# PROGRESS
Now: R2 running. R1, R3 done.
Next: S1 spec draft (opus) → V1 3 reviewers parallel → S2 fix → D1 README + commit.
Blockers: none.
Decisions (controller rulings, user may overturn):
- "GEP" in request = JEV (speech-to-text).
- Public repo → key never committed/embedded.
- JEV blocks browser CORS (preflight 400 for all origins incl localhost) → LIVE via bundled zero-dep local Node proxy tools/jev-proxy.mjs (key from env, same-origin). Pages = SIMULATED default + REPLAY of real recorded JEV responses. Optional CF Worker template.
- Deliverable = docs/SPEC.md + README guide. No app code.
