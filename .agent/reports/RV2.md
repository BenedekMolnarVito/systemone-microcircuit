# RV2 — final cross-task review (T20), range f4d81ee..HEAD

Verdict: **FIX-REQUIRED** (1 Critical, 5 Important). Unit: 134 run / 132 pass / 0 fail / 2 skip (chunk1 run).

## Critical

C1. **LIVE skipped ticks leak `jev:request` → Ask JEV permanently disabled in LIVE.**
- docs/js/jev/client.js:101-103 emits `jev:request` before `live()`; client.js:128-131 skipped path returns `{status:'skipped'}` WITHOUT `finish()` → no `jev:response`/`jev:error`.
- docs/js/ui/dashboard.js:59,66 `inflight.set(id)` never deleted → `ask.disabled = inflight.size > 0` stays true forever. Also jev-log.js:44 `pending` grows unbounded.
- Scenario: default params (autoJev on, jevIntervalMs 500, liveMinIntervalMs 2000) → LIVE → 2nd grid tick skipped (~1 s) → btn-ask-jev disabled until reload. Breaks presenter path, FR-JEV-08(3), §4.2 btn-ask-jev ("disabled while in flight").
- Hidden from E2E: all LIVE specs use `?test=1&autoplay=0` → no auto ticks.
- Fix: in client.ask, emit `jev:request` only after skip check (move skip check from `live()` into `ask()` before emit), or emit `jev:response` with status `skipped` and let dashboard/jev-log ignore it. Add E2E: LIVE + run 3 s + Ask JEV enabled.

## Important

I1. **Every LIVE error/fallback emits both `jev:error` AND `jev:response` → duplicate log entries + fallback never reaches readout.**
- client.js:114-117 `finish()`: `result.error` → `jev:error`; status ≠ aborted → also `jev:response`. Fallback (client.js:189) and error results (186) carry `error`.
- jev-log.js:55 writes `error:<code>` entry and deletes `pending`; jev-log.js:45-48 then writes 2nd entry with `req={}` → `t=0.0 · … · ? · fallback:<code>`.
- dashboard.js:67 `jev:error` → `done(id)`; dashboard.js:69-71 `req` undefined → return → FALLBACK readout never shown (modeTag FALLBACK branch dead). Violates FR-JEV-14 ("logged with status fallback:<code>, and applied"), §3.7 closed status set.
- Same path: aborted → jev:error only → log status `error:aborted`; spec §3.7 says `aborted`. robustness.spec `hasText:'aborted'` substring hides it.
- Fix: `finish()` emits exactly one event: `jev:response` for every non-aborted result (status already encodes error); `jev:error` only for aborted (or log `aborted` for code aborted in jev-log.js:55).

I2. **FR-JEV-13 budget switch one tick late.** client.js:137,174-177 switches only when the NEXT attempt finds `used >= cap`; spec: "When used == cap: switch to SIMULATED, turn autoJev off, banner". Scenario: cap 50, 50th call ok → still LIVE; next tick returns `error:budget_exhausted` with no response. U-44 (client.test.mjs:46) locks late behaviour. Fix: after a successful/failed attempt, if `budget.used >= budget.cap` → `switchToSim(...)` + emit status so main.js:139 turns autoJev off; update U-44.

I3. **Banner never auto-hides while sim runs with autoJev.** banner.js:11-18 clears/re-arms 8 s timer on EVERY store change; dashboard.js:65-66 `store.set({})` per jev:request/response + main.js:126 syncBudget → every ~500 ms wall at default params. Spec §4.2 Banner: warn/info auto-hide after 8 s. Hidden in E2E (`?test=1` persists). Fix: re-arm only when `banner` object identity changes (`if (banner === last) return`).

I4. **Disabled mode/Key buttons lack `aria-describedby`.** header.js:51-54 sets `title` only; no `aria-describedby` in index.html/js. Spec §4.2 mode-select row ("tooltip text in the title attribute and referenced by aria-describedby"), NFR-A11Y. Open since T10 (scratch). Fix: hidden `<span id>` per button with tooltip text, set `aria-describedby` when disabled.

I5. **Tooltip texts deviate from spec.** header.js:7 `NO_PROXY` = "Unavailable: run the local proxy …" vs FR-JEV-05 `LIVE needs the local proxy: run "node tools/jev-proxy.mjs" and open http://127.0.0.1:8787`; header.js:58 "No recording available" vs FR-JEV-06 `No JEV recording is bundled with this build`. E08 only substring-checks. Fix: use spec strings verbatim (check E08 substring still matches).

## Minor

M1. FR-JEV-16 local Choice ignores JEV β (T12 open item confirmed): charts.js:12-18 `collateralProbs` omits `control.betaOutput` for L23E `output` (sim.js:135 includes it) and no τ_c floor 0.05 (sim.js:132). Used by dashboard.js:83 compare + choice bars. Fix: expose `sim.control` getter, add β + `Math.max(0.05, tauC)`.
M2. FR-UI-18 "clears … readout": `store.jevReadout`/`compare` not cleared on reset → stale JEV readout + agree/disagree after Reset. Fix: main.js rebuild (or dashboard `bus.on('reset')`) → `store.set({jevReadout:null, compare:null})`.
M3. §3.7 `no_key` → "Open key modal (if LIVE available)": client.js:184 only banners; main.js:150-153 opens modal only for `unauthorized`. Fix: main.js:152 also `code==='no_key'`.
M4. §3.7 `proxy_unreachable` → "Re-run health check … LIVE disabled until health passes": not done; availability.live stays true. Fix: main.js jev:error handler → `client.health().then(applyHealth)`.
M5. §3.7 bad_request ×3 banner text "JEV rejected the request format" not used (client.js:185 generic text).
M6. FR-TST-08 vs U-40 spec conflict: secrets.test.mjs:21 reads `process.env[<key var>]` as U-40 mandates ("Unconditionally: if env <key var> is set…") but FR-TST-08 forbids. Code follows U-40; record ruling in SPEC. live-real.test.mjs:8 reads key at module top before JEV_LIVE_TEST gate → gate the read.
M7. sim.js:184 `reset()` doesn't neutralise `control` (chunk1 Important downgraded): app never calls `sim.reset` (main.js:79 rebuilds via createSim) → no runtime effect; trap for API users/tests. Fix: reset control in `reset()`.
M8. FR-JEV-17 flash `.novel-input` (main.js:131) has no CSS rule in docs/css → unstyled text. Add style in dashboard.css (T12-owned).
M9. Proxy: ctx.secrets (jev-proxy.mjs:184) holds raw `X-JEV-Key`, not normalised key → upstream message echoing trimmed key not redacted if header had surrounding whitespace. Add `n.key` to `ctx.secrets` at :115. writeRecord :71 `usage.output_tokens` undefined → NaN if upstream omits field.
M10. cf-worker.js:56 body size via `text.length` (UTF-16 units) after full read, not bytes. Doc-grade template, low risk.
M11. key-modal.js:66 / about.js focus trap + Esc only when focus inside container (click on modal text → body focus → Tab escapes). key-modal.js:3 `NO_PROXY` unused.
M12. U-57 (about.test.mjs) checks only phrases, not §1.4/§1.5 verbatim blocks.
M13. U-50 tree test (dom-free.test.mjs:90) still `skip: 'enabled by T20'`; required list omits `browser-scenarios/*.json`, `tests/e2e/smoke.spec.mjs`, `docs/js/core/scheduler.js` is covered via EXPORTS (verify). T20: remove skip.

## Cross-chunk findings (main.js wiring)
- Verified OK: reset order (main.js:93 rebuild registered before circuit-view/charts `reset` listeners; renderFrame after); seed apply → store.seed → input-panel regenerates noise img → reset → rebuild with new seed (FX1 ruling); scheduler.reset → client.resetRun (callIndex 0) on reset/seed; mode switch increments runId w/o reset (FR-UI-19); LIVE selection: setMode('LIVE') before health, token guard, no-key → modal + stay previous (§4.3); keystore.enable only after health (FR-KEY-11); forget in LIVE w/ keySource none → SIMULATED (FR-KEY-07); budget_exhausted → autoJev off (main.js:139-142); REPLAY with empty placeholder → availability.replay false, `?mode=replay` → info banner (FR-JEV-02/06); FR-JEV-17 flash present (main.js:143-148); keyboard digit map matches §4.5; getState has no key (FR-KEY-09); URL key params stripped + warn (FR-KEY-08).
- Broken cross-module contracts: C1 (client skip ↔ dashboard/jev-log), I1 (client finish ↔ dashboard/jev-log), I3 (dashboard `store.set({})` ↔ banner timer), M1 (sim control ↔ charts/dashboard).

## Static DoD
- .gitignore: all FR-TST-07 entries present. package.json matches FR-ARCH-02a (exact pin 1.49.1, engines >=22). playwright.config: 2 proxy webServers, env key emptied (FR-TST-03).
- File tree §5.1: tracked files match; no extras beyond tests/fixtures (incl. emulator-golden.json), tests/e2e helpers, screenshots, .agent.
- CSP: no inline style/script, no innerHTML sinks (chunk3 + U-50). Proxy: FR-PRX-03..16 checked (host, origin, SFS, size, no CORS, OPTIONS 405, key header only, redact, atomic record) OK.
- §7.4: all 90 U-/E-/S- IDs in matrix appear in tests/ or browser-scenarios/ (S06 = smoke-keyboard.json, T21 in flux).

## Chunk map
| Chunk | Files | Reviewer |
|---|---|---|
| 1 | docs/js/core/* + core unit tests | chunk-reviewer (haiku) → RV2-chunk1.md |
| 2 | docs/js/jev/* + jev unit tests | chunk-reviewer (haiku) → RV2-chunk2.md |
| 3 | docs/js/ui/*, css, index.html, about.test | chunk-reviewer (haiku) → RV2-chunk3.md |
| 4 | main.js, tools/jev-proxy.mjs, tools/cf-worker.js, package.json, .gitignore, playwright.config, DoD | reviewer (opus, direct) |

Dropped/downgraded haiku findings: dropped 3 (chunk3 #14 params-panel closed on mobile — handled params-panel.js:31; chunk3 #4 bus listener isolation — speculative, validated responses; chunk3 #15 empty). Downgraded 2 (chunk1 control-on-reset → M7; chunk2 secrets env read → M6). Unverified chunk2 ?-items (emulator NaN at θ=40, replay latencyMs undefined, choice vs argmax) left in RV2-chunk2.md, not confirmed.
Not checked: README commands (T18), smoke/browser-scenarios/EVIDENCE (in flux), E2E not run.
