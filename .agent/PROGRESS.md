# PROGRESS — HANDOFF (2026-10-17)
Goal (/goal): docs/SPEC.md (impl-ready for multi-agent long-horizon session, browser-tested w/ screenshots) for JEV-primitives neuronal-microcircuit demo + README guide. SPEC ONLY, no app code. Spec made via multi-agent workflow, sources verified.

## State
- Done: R1/R2/R3 research (.agent/reports/), S1 draft SPEC (commit 85441ce), V1 3 reviews (commit 2d9c9f8).
- IN FLIGHT at cut-off: S2 fix-wave subagent editing docs/SPEC.md per .agent/briefs/S2.md (writes .agent/reports/S2.md when done).
- 2026-10-17 resume: S2 child died partial (changelog v1.1 + R3 line done; ?api= L1150 + unit cmd L1501 remain, no S2.md). Re-dispatched S2 (opus implementer) to finish on top of partial diff.

## RESUME STEPS
1. `git status` / `git diff --stat docs/SPEC.md`. If .agent/reports/S2.md exists → S2 finished. If not and SPEC diff empty/partial → child likely died: re-dispatch S2 (implementer, model opus) with prompt "Task S2. Read .agent/briefs/S2.md first — authoritative…" (edits are idempotent: brief describes target state). Don't run two writers.
2. Verify S2 yourself:
   - `grep -nE "τ_N|tauN|\?api=|node --test tests/unit/ " docs/SPEC.md` → empty
   - `grep -c TODO docs/SPEC.md` → 0
   - key scan: python snippet scanning repo for env TYPESAFE_API_KEY exact + `(sk|ts|key)[-_]\w{20,}` not containing FAKE/SENTINEL/REDACTED → clean (NOTE: Git Bash grep w/ --exclude-dir got mangled by rtk; use python).
   - S2.md maps every Critical/Important ID from V1-sec/V1-impl/V1-sci.
   Commit SPEC v1.1.
3. Scoped re-review: ONE `reviewer` — check only that V1 Critical/Important are fixed + no new contradictions (point at §2 Noul math, §3 proxy/error codes, §7 tests, §8 task plan file-disjointness). Fix any remaining Critical/Important inline or one more implementer.
4. D1: write README.md guide (root README currently 1 line "# systemone-microcircuit"). Use SPEC §9 content: pitch, link https://benedekmolnarvito.github.io/systemone-microcircuit/ (NOTE: page doesn't exist until implemented — say "after implementation per docs/SPEC.md"), path A open Pages (simulated/replay), path B presenter live (`TYPESAFE_API_KEY` env + `node tools/jev-proxy.mjs` → http://127.0.0.1:8787), enable Pages from /docs, safety note, link to docs/SPEC.md. Commit.
5. Mark TASKS done, final report to user: rulings list (below), do NOT push (user's call). Untracked Perplexity source md left uncommitted — ask user whether to commit it.

## Controller rulings (user may overturn)
- "GEP" = JEV (speech-to-text).
- JEV API blocks browser CORS (preflight 400 incl. localhost, verified by controller curl) → LIVE mode via bundled zero-dep Node proxy tools/jev-proxy.mjs (same-origin, key from env preferred, X-JEV-Key fallback only to same origin). GitHub Pages = SIMULATED (seeded emulator) default + REPLAY of sanitized real recordings. Optional CF Worker template (presenter-only).
- Key never committed; key UI only when /api/health OK.
- SCI-01: Noul := P(≥1 spike in W=10 ms); p_step = 1−(1−Noul)^(dt/W).
- Unit tests `node --test "tests/unit/*.test.mjs"` (Node≥22; dir arg fails on Node 25, verified).
- Fixture keys contain FAKE. package-lock committed (dev-only Playwright).

Blockers: none.
