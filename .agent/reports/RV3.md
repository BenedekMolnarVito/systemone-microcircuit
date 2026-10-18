# RV3 — scoped re-review of FX3 + controller fixes, range e9b55d9..a4cb956 (docs/js, tools, tests/unit, SPEC)

Verdict: **PASS** (0 Critical, 0 Important, 4 Minor — optional).
Verified myself: `node --test "tests/unit/*.test.mjs"` → 136 / 135 pass / 0 fail / 1 skip. `PW_DISABLE_TS_ESM=1 npx playwright test` → 43 pass / 1 skip / 0 fail (1.7 m). E2E run rewrote 6 tracked screenshots → restored with `git checkout -- tests/screenshots` (tree clean again).

## RV2 items
- C1 FIXED. client.js:101-105 skip check before `nextId++`/`jev:request` → skipped tick emits nothing; sync return OK for scheduler (scheduler.js:37-40 handles non-thenable; `apply` no-ops w/o response) and main.js:161 (ignores return). Tests client.test.mjs skip + in-flight-skip cases w/ `oneEach`.
- I1 FIXED. client.js:120-124 exactly one event per request. Traced every exit: SIM/REPLAY → finish; LIVE ok / fallback / error / pre-attempt budget_exhausted → `jev:response`; aborted (setMode away, resetRun, abortAll, abort during retry wait) → `jev:error` only. Consumers: dashboard.js:65-71 deletes inflight on both; jev-log.js:55 logs `aborted` (closed set §3.7); fallback now reaches dashboard → FALLBACK tag via modeTag regex; scheduler applies fallback response (FR-JEV-14).
- I2 FIXED. client.js:135 `checkCap` after ok (177) and non-switching failure (194); switch before `finish` → mode:changed → main selectMode→commitMode, then jev:response (mode LIVE) → main.js:141 autoJev off. No runId check in dashboard/jev-log → cap-reaching result still logged/applied/exported. E15 still green.
- I3 FIXED. banner.js:12 identity guard; store.set is shallow merge → `store.set({})` keeps banner ref → timer not re-armed. bus 'banner' always new object → real changes re-arm.
- I4 FIXED. header.js:50-56 hidden span `<testid>-tip` + `aria-describedby` only while disabled.
- I5 FIXED. header.js:7,61 verbatim FR-JEV-05 / FR-JEV-06.
- §3.7 reactions moved jev:error → jev:response (main.js:152-156): none lost. Old handler had only unauthorized→modal + syncBudget; unauthorized now carried in `result.error.code` (E07 green); syncBudget still on jev:response (138) and jev:error (157). Added no_key→modal (key-modal open() idempotent + guarded by availability.live) and proxy_unreachable→health.
- U-44 (client.test.mjs:52-71) matches FR-JEV-13 ("When used == cap: switch…, autoJev off, banner") and keeps spec row assertions (forced 3rd LIVE ask → budget_exhausted, fetch count 2, SIMULATED) → stronger, not weakened.
- M1 β matches §2.5 `a_k = b_k + γ_k·Da/θ + β_k`, β only on L23E `output` (§3.4.3 row), τ_c floor 0.05 — identical to sim.js:132-135. `sim.control` getter returns copy.
- M2/M3/M4/M5/M6/M7/M9/M10/M11 checked, OK. SPEC FR-TST-08 second exception resolves M6; live-real.test.mjs reads <key var> only behind `JEV_LIVE_TEST=1`.

## Minor
m1. client.js:194 + 127 — cap-reaching attempt that fails with unauthorized/forbidden/proxy_unreachable: switchToSim(error) then `checkCap()` → switchToSim emits banner before its mode guard → warn budget banner replaces error banner (error persistent → warn auto-hides 8 s; "JEV rejected the key (401)" lost). Fix: `else if (mode === 'LIVE') checkCap();` (or move `emit('banner')` after mode guard only for checkCap).
m2. main.js:155 — `client.health()` returns null both for failure and "selection changed" (client.js:95). User clicks LIVE during the 1.5 s re-check → selectMode's own health commits LIVE, stale call then resolves null → `applyHealth(null)` → availability.live false while in LIVE (LIVE/Key buttons disabled). Narrow race. Fix: capture `const tok = modeSel` and skip applyHealth if changed.
m3. main.js:154 — no_key keeps LIVE (§3.7 "stay") → each later LIVE tick (≤3, ~2 s apart) re-opens key modal after user cancels. Spec-conformant; UX nag only. Optional: open once per LIVE selection.
m4. SPEC §7.2 U-44 row wording ("third LIVE ask … mode becomes SIMULATED") implies late switch; test now asserts switch after 2nd. Optional row tweak: "SIMULATED after 2nd ask; forced 3rd → budget_exhausted w/o fetch".

## Not regressions (pre-existing, noted)
- Exception thrown inside `live()` (e.g. emulator in fallback, keystore.get) → promise rejects, no finish → inflight leak. Not introduced by FX3.
- E2E suite writes into tracked tests/screenshots on every run (expected by protocol; beware dirty tree).

Not checked: README, browser-scenarios content, cf-worker beyond changed line.
