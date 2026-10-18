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

## Phase 2 — JEV browser skill + smoke testing (2026-10-17)
| ID | Desc | Status | Verify by |
|----|------|--------|-----------|
| R4 | Distill browser-use/jev-ultrafast (+ jev-ultrafast-mcp replay) | done 2026-10-17 | .agent/reports/R4.md |
| B1 | Global skill ~/.claude/skills/jev-browser: SKILL.md + Node scripts (DOM element table, JEV choice loop, code assertions, record → .browser-scenarios/*.json, zero-model replay, Playwright spec export) | done 2026-10-17 (15/15 unit; live goal 5 JEV calls; controller replay pass, 0 calls, also w/o key) | fixture page: record w/ JEV, replay 2x with 0 JEV calls, same result |
| B2 | SPEC: §7.5 browser smoke scenarios + task T21 + graph/table/file tree/DoD + CLAUDE.md row | done 2026-10-17 (SPEC v1.3 §7.5 S01–S06, T21 W9, graph/table/tree/DoD/matrix, CLAUDE.md; reconcile format w/ B1 in B3) | grep, graph matches 8.2 |
| B3 | Review B1+B2 (reviewer) + commit | done 2026-10-18 (PASS-WITH-FIXES 1C/5I skill + 4 spec; B4 fixed skill 19/19 tests, replay pass 0 calls; spec S1-S4 + S01 wait_for fixed by controller) | review report, git log |

## Phase 3 — Implement SPEC end-to-end (2026-10-18)
Rules: children write only owned files (SPEC §8.2) + `.agent/reports/<id>.md`; NO git, NO TASKS/PROGRESS edits. Controller verifies, commits per task, updates state. Common brief: `.agent/briefs/impl-common.md`.
| ID | Wave | Desc | Status | Verify by |
|----|------|------|--------|-----------|
| T01 | W1 | scaffold + core utils | done (34 tests: 20 pass, 14 skip pending modules, 0 fail; controller ran) | U-01–04, U-40, U-50, U-51 green |
| T02 | W2 | stimuli + encoding | done (stimuli+encoding tests green, controller ran) | U-08, U-19, U-20, U-62 |
| T06 | W2 | JEV schema/summary/emulator | done (45/53 pass 0 fail; controller fixed collateral shape) | U-24–29, U-26b, U-42, U-43 |
| T10 | W2 | UI shell | done (node --check 6 files OK) | node --check |
| T03 | W3 | network builder | done (network tests green) | U-17, U-18 |
| T07 | W3 | replay + placeholder recording | done (49/56 pass, 0 fail) | U-39, U-39b, U-39c |
| T12 | W3 | charts/dashboard/log | done (node --check; gaps in scratch) | node --check |
| T13 | W3 | input + params panels | done (node --check) | node --check |
| T04 | W4 | sim core | done (71/77 pass 0 fail; U-60/E14 SPEC amended τ_m=1) | U-05–16, 21, 22, 30–36, 60, 61 |
| T11 | W4 | circuit view | done (node --check) | node --check |
| T05 | W5 | readout + calibration | done (calibration table all pass; 27/27 core tests controller ran) | U-59, calibration table |
| T08 | W5 | keystore/client/scheduler | done (keystore+client+scheduler tests green) | U-23, 37, 38, 41, 44–49, 52–56, 58 |
| T09 | W6 | proxy | in-progress 2026-10-18 | P-01–P-22 |
| T14 | W6 | key modal + About | in-progress 2026-10-18 | U-57 |
| T15 | W7 | main wiring + __mc | todo | node --check + mock-upstream smoke |
| T16 | W8 | E2E + screenshots + EVIDENCE | todo | playwright E01–E34 |
| T18 | W8 | README | todo | commands run |
| T19 | W8 | CF worker (MAY) | todo | node --check + warning verbatim |
| T17 | W9 | real recording (optional) | todo | needs key → likely deferred |
| T21 | W9 | smoke scenarios S01–S06 | todo | skill replay 0 calls + smoke.spec |
| T20 | W9 | final review + DoD | todo | DoD checklist §8.5 |
| RV1 | — | mid review core+jev | done (0C/3I/7M, reports/RV1.md) | report |
| FX1 | — | fix RV1 Important (+clear minors) | done (110/112 pass 0 fail) | unit green |
