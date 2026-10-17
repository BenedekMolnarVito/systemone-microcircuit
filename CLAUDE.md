# CLAUDE.md — SystemOne Microcircuit

Browser demo: JEV primitives (Score → Noul → Choice) as neurons in a toy cortical microcircuit.
`docs/SPEC.md` is the single source of truth (≈1900 lines). Don't read it whole: use this index.

## How to work

- Status lives in `.agent/TASKS.md` and `.agent/PROGRESS.md`. Read them first, then continue the first unfinished task.
- Implementer rules: SPEC §8.1. File ownership: SPEC §8.2. Only touch files your task owns.
- Dependencies: the **Task dependency graph** at the top of `docs/SPEC.md`. Start a task only when every task it depends on is `done`.
- Spec contradicts itself or your brief → stop, report `BLOCKED` (§8.1). Don't improvise.
- Locate sections by heading, not line number: `grep -n "^### 2.4" docs/SPEC.md`, then Read with offset.
- Always relevant: §0.3 Glossary, §7.4 traceability matrix (rows for your FR IDs), §10 "Determinism requirements".

## Commands

```bash
node --test "tests/unit/*.test.mjs"                  # unit tests (Node ≥ 22, quoted glob)
node tools/jev-proxy.mjs --mock-upstream             # app + mocked JEV, no key, http://127.0.0.1:8787
node tools/jev-proxy.mjs --no-api --port 8080        # static only, like GitHub Pages
npm ci && npx playwright install chromium && npx playwright test   # E2E (T16+)
```

## Safety (non-negotiable)

- Never commit or print a real API key. Fixture/example keys contain `FAKE` (U-40 scans the repo).
- Tests never read `TYPESAFE_API_KEY` except `tests/unit/live-real.test.mjs` with `JEV_LIVE_TEST=1` (FR-TST-08).
- Billed JEV calls only in T17 / optional human checks (SPEC §8.5).

## Phase index (waves from SPEC §8.3)

Each wave's tasks have disjoint files and can run in parallel.

| Wave | Task | What | Read in SPEC |
|---|---|---|---|
| W1 | T01 | Scaffolding, `index.html` with all test IDs, core utils (rng, hash, params, ringbuffer, loop) | §2.3, §4.1, §4.2, §4.7, §5.1, §5.2, §7.1, §7.2 (U-01–04, U-40, U-50, U-51), §10 Determinism |
| W2 | T02 | Stimuli + input encoding | §2.7, §5.2, §7.2 |
| W2 | T06 | JEV schema, state summary, emulator | §3.4, §3.5, §3.8, §5.2, §7.2 |
| W2 | T10 | UI shell: boot, store, bus, header, banner, theme | §4.1, §4.3, §4.7, §5.3, §5.4 |
| W3 | T03 | Network builder (incl. single-neuron harness) | §2.1, §2.6, §5.2 |
| W3 | T07 | Replay + placeholder recording | §3.2, §3.6 |
| W3 | T12 | Charts, dashboard, JEV log | §4.2, §4.8 |
| W3 | T13 | Input panel + params panel | §2.3, §2.7, §4.2, §4.4 |
| W4 | T04 | Sim core: update equations, Choice, inhibition, STDP, guards | §2.2–§2.10, §5.2, §10 Determinism |
| W4 | T11 | Circuit view (SVG) | §4.2, §4.4, §4.6, §4.8 |
| W5 | T05 | Readout + calibration | §2.9, §2.11, Appendix A |
| W5 | T08 | Keystore, client, scheduler | §3.3, §3.7, §3.9, §5.2 |
| W6 | T09 | Local proxy `tools/jev-proxy.mjs` | §3.1, §3.7, §5.6, §7.1 (FR-TST-08) |
| W6 | T14 | Key modal + About drawer/content | §1.1–§1.5, §3.9, §4.2 |
| W7 | T15 | Main wiring, rAF loop, keyboard, URL params, `window.__mc` | §4.4, §4.5, §5.5, §6, §7.3 (test hook) |
| W8 | T16 | E2E suite, screenshots, `tests/EVIDENCE.md` | §6, §7.1, §7.3 |
| W8 | T18 | README guide (verify every command) | §9 |
| W8 | T19 | Cloudflare Worker template (MAY) | §5.7 |
| W9 | T17 | Real JEV recording (optional, needs key) | §3.6 (FR-REC-07) |
| W9 | T20 | Final review + Definition of Done | §8.5 |

Milestones: M1 after W6 (headless core + JEV + proxy tested), M2 after W7 (app runs), M3 after W8 (E2E + README), M4 after W9 (REPLAY on Pages).
