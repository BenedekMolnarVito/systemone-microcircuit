# PROGRESS
Now: S2 fix wave running (brief .agent/briefs/S2.md).
Next: verify S2 greps → scoped re-review (1 reviewer) → D1 README + commit.
Blockers: none.
Decisions (controller rulings, user may overturn):
- "GEP" in request = JEV (speech-to-text).
- Public repo → key never committed/embedded.
- JEV blocks browser CORS (preflight 400 for all origins incl localhost) → LIVE via bundled zero-dep local Node proxy tools/jev-proxy.mjs (key from env, same-origin). Pages = SIMULATED default + REPLAY of real recorded JEV responses. Optional CF Worker template.
- Deliverable = docs/SPEC.md + README guide. No app code.
- S2 ruling SCI-01: Noul := P(>=1 spike in window W=10 ms); p_step = 1-(1-Noul)^(dt/W); drop tauN; fix U-07, glossary, §1 table, emulator local-Noul consistent.
- V1-sci: PASS-WITH-FIXES (1C/6I/15M). All 36 DOIs crossref OK.
- V1-sec: PASS-WITH-FIXES (2C/6I/13M). Rulings: S-01 fixture keys must contain SENTINEL|FAKE|REDACTED, U-40 allowlist only those; also neutralize R3.md:117 placeholder. S-02 drop ?api= param, key only to same-origin. S-03 key modal/storage only enabled after /api/health OK (never on github.io). S-04 tests unset TYPESAFE_API_KEY in proxy/webServer env. S-05 Playwright trace/video off for live tests + .gitignore (test-results, playwright-report, traces). S-06 retry only on upstream 429/529/network, never on proxy-generated codes (use error.code field). S-08 recording stores sanitized validated answers only.
