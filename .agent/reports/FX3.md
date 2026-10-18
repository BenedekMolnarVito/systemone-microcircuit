# FX3 — fix RV2 findings

Status: DONE (see Verify).

## Per finding
- C1 FIXED. client.js `ask()`: LIVE skip check (in flight / liveMinIntervalMs) moved before `jev:request` emit → skipped ticks emit no events, `client.skipped++`, sync `{status:'skipped'}` (scheduler ignores: no response). Dashboard inflight / jev-log pending no longer leak. Files: docs/js/jev/client.js.
- I1 FIXED. client.js `finish()` emits exactly one event: `jev:error {code:'aborted'}` only for aborted, `jev:response` otherwise (status encodes `fallback:<code>`/`error:<code>`). jev-log.js jev:error → status `aborted` (closed set §3.7). Dashboard now gets fallback results → FALLBACK readout applied (FR-JEV-14). main.js §3.7 UI reactions (unauthorized/no_key modal, proxy_unreachable) moved from jev:error to jev:response `result.error.code`. Files: client.js, jev-log.js, main.js.
- I2 FIXED. client.js `checkCap()` after each completed LIVE attempt (ok or non-switching failure): `used >= cap` → `switchToSim('warn', 'JEV budget reached (cap/cap). Continuing in SIMULATED mode.')`. main.js autoJev-off now on any LIVE result with `used >= cap` (was only `error:budget_exhausted`). Pre-attempt check kept (retries / forced LIVE). U-44 rewritten per FR-JEV-13 ("When used == cap: switch to SIMULATED…"): after 2nd ok call mode SIMULATED + exact banner + mode:changed; forced setMode('LIVE') 3rd ask → `budget_exhausted`, fetch count 2, used 2 (kept original assertions).
- I3 FIXED. banner.js: subscriber returns early when `banner` identity unchanged → 8 s timer re-armed only on banner change.
- I4 FIXED. header.js `setDis`: lazily adds hidden `<span id="<testid>-tip">` after button, text = tooltip; `aria-describedby` set while disabled, removed when enabled (mode-select-live/replay, btn-key).
- I5 FIXED. header.js NO_PROXY = FR-JEV-05 verbatim; replay tooltip = FR-JEV-06 verbatim. E08 regex still matches.
- M1 FIXED. charts.js `collateralProbs(network,i,state,params,betaOutput=0)`: adds β on L23E `output`, τ_c floor `Math.max(0.05,tauC)` (= sim.js). sim.js new getter `control` (copy). Callers charts.js/dashboard.js pass `sim.control.betaOutput`. Spec FR-JEV-16 "current p_k (Section 2.5)".
- M2 FIXED. main.js `rebuild()` (runs on every reset/seed) clears `jevReadout`/`compare` (FR-UI-18).
- M3 FIXED. main.js: `no_key` + `availability.live` → `key:open` (§3.7).
- M4 FIXED. main.js: `proxy_unreachable` → `client.health().then(applyHealth)` (LIVE disabled until health passes).
- M5 FIXED. client.js: 3rd consecutive `bad_request` → banner "JEV rejected the request format" (§3.7).
- M6 PARTIAL. live-real.test.mjs: key read only when `JEV_LIVE_TEST=1` (`optIn && process.env[<key var>]`; ternary form tripped U-40 regex `: undefined`). secrets.test.mjs env read untouched: U-40 mandates it ("Unconditionally: if env <key var> is set…") — SPEC conflict with FR-TST-08; SPEC edit outside my ownership → controller ruling/SPEC note needed.
- M7 FIXED. sim.js `reset()` resets control to `{betaOutput:0, stdpM:1}`.
- M8 FIXED. dashboard.css `.novel-input` rule (spike-colored outlined tag, no animation).
- M9 SKIPPED. tools/jev-proxy.mjs not in ownership exception (docs/js, docs/css, tests only).
- M10 SKIPPED. tools/cf-worker.js out of ownership; doc-grade template (MAY).
- M11 FIXED. key-modal.js / about.js: container `tabIndex=-1` (click on dialog text keeps focus inside → Esc/Tab handlers fire) + Tab when focus not on a listed focusable wraps to first/last. Removed unused `NO_PROXY` in key-modal.js. Spec §4.2 "focus trap, Esc closes".
- M12 SKIPPED. U-57 spec row requires only phrase checks + FR-SCI-09 verbatim, which about.test.mjs already does; §1.4/§1.5 block checks not required by SPEC.
- M13 SKIPPED (already done). dom-free.test.mjs U-50 tree test has no skip in current HEAD; spec tree check scope = docs/ + tools/ only.

## Tests added/changed (tests/unit/client.test.mjs)
- helper `oneEach(events)`: every jev:request id has exactly one jev:response|jev:error.
- U-44 rewritten (above). U-48 + oneEach. U-54 bad_request: banner text, 0 jev:error, 3 jev:response, oneEach.
- new: neuron LIVE error → events exactly [jev:request, jev:response], status `error:no_key`.
- skip test: skipped tick → only 2 jev:request for 2 ok calls, oneEach (C1).
- new: skip while in flight emits nothing; in-flight resolves once.

## Verify
- `node --test "tests/unit/*.test.mjs"`: 136 tests, 135 pass, 0 fail, 1 skip (live-real).
- `PW_DISABLE_TS_ESM=1 npx playwright test`: 43 passed, 1 skipped, 0 failed (1.8 m). Count 44 ≠ brief's 37+1: suite now includes T21 smoke tests. 11 screenshots re-rendered (diffs only, not committed by me).
- LIVE autoplay check (scratchpad live-check.mjs, mock proxy port 8799, autoplay default on, speed 1000, ~4 s LIVE): sim t≈6.7 s, 3 LIVE ok calls (t=500/3000/5500 → grid ticks in between skipped), btn-ask-jev enabled in 12/12 samples, no duplicate log entries, no pageerror. PASS.

## Notes
- E2E for C1 (LIVE + autoplay + wall wait) not added: SPEC screenshot/test protocol avoids wall waits; unit tests cover event contract.
