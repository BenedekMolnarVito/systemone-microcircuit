# RV2 chunk3 review (f4d81ee..HEAD)

Scope: docs/js/ui/*.js, docs/css/*, docs/index.html, tests/unit/about.test.mjs. Read-only. Not fixed.

## Checks summary
- CSP: PASS. index.html has no `style=` attrs, no inline `<script>` bodies (only src). No `innerHTML`/`insertAdjacentHTML`/`outerHTML`/`setAttribute('style')` in ui/. JS uses `.style.x` CSSOM props only (allowed under style-src 'self').
- Static data-testid §4.2: PASS. All header, banner, input, params, circuit, dashboard, key-modal, about, file-protocol testids present in index.html. Generated (JS): stimulus-preset-*, neuron-*, collateral-*, choice-bar-*, readout-bar-*, jev-log-entry.
- Key echo: PASS. key-modal uses fixed strings for errors; `key-masked` = keystore.masked() = `•••• ` + last 4 (FR-KEY-06). Input type=password, autocomplete=off, cleared on close. jev-log/dashboard never log the key. Keystore error strings are static (keystore.js:6-8).
- FR-JEV-17 novelty flash: PRESENT in docs/js/main.js:131-147 (`nu > 0.7` → `.novel-input` in readout-panel, 1 s). Earlier scratch "missing" note is stale.
- Keyboard map §4.5 digits: PASS (keyboard.js:2 index order matches spec).

## Findings

Important:
1. docs/js/ui/header.js:51-61 — disabled mode buttons + `btn-key` get `title` only; spec §4.2 requires `aria-describedby` → tooltip id too. No aria-describedby anywhere (index.html, header.js). Failure: SR user on disabled LIVE/REPLAY hears no reason. Spec §4.2 header table, NFR-A11Y-02. (Matches scratch T10 open item.)
2. docs/js/ui/key-modal.js:66-74 and docs/js/ui/about.js:57-65 — Esc + Tab trap only fire when focus is inside container (keydown on container). Click on non-focusable modal text → focus to body → Tab walks into page behind aria-modal dialog; Esc does nothing. Spec §4.2 "focus trap, Esc closes". Fix direction (not applied): document-level keydown while open, or inert on background.
3. docs/js/ui/banner.js:11-18 — subscriber clears & re-arms 8 s timer on EVERY store.set. Unrelated writes (dashboard.js:65-66 `store.set({})` on each jev:request/response; budget sync main.js:126) keep info/warn banner alive while auto-JEV runs (LIVE interval 2 s). Failure: info banner never auto-hides during JEV traffic. Spec §4.2 banner: auto-hide 8 s wall. ? severity if store writes stop quickly.
4. docs/js/ui/bus.js:10 — no per-listener try/catch; throw in one listener aborts later listeners and propagates to emitter. Triggers: dashboard.js:82-84 (`net.collaterals[i]` undefined → TypeError inside jev:response; also aborts jev-log.js listener order), jev-log.js:6 (`a.type` on null answer value → throws). Frame emit main.js:217 → rAF loop. ? needs malformed-but-schema-valid response to hit; client validateResponse should prevent.
5. tests/unit/about.test.mjs:19-28 — U-57 checks only: Bernoulli sentence, "leaky graded potentials" phrase, FR-SCI-09 sentence, one scaling phrase, [DEMO] prefix. Not asserted: §0.1 pitch verbatim, §1.4 table verbatim (rows only checked for non-empty), §1.5 statement verbatim, §0.2 correction paragraph, refs DOI/URL form. Spec §4.2 about-drawer requires verbatim. ? severity depends on how strict U-57 is.

Minor:
6. docs/js/ui/keyboard.js:13-16 — Space on any focused `<button>` (not role=button) → calls btn-play + preventDefault. Focused Step/Reset/Mode/Key button + Space plays/pauses instead of activating. Spec §4.5 literal (only input/textarea/select/contenteditable excluded), so spec-compliant; a11y surprise.
7. docs/js/ui/header.js:62-64 — btn-play has `aria-pressed` AND changing label Play/Pause. Mixed toggle semantics. Pick one.
8. docs/js/ui/key-modal.js:3 — `NO_PROXY` constant unused. Dead code.
9. docs/js/ui/dashboard.js:4 and tests/unit/about.test.mjs:13 — SCI09 / FR-SCI-09 string duplicated; drift risk (test would not catch dashboard copy drift).
10. docs/js/ui/about.js:27-30 — proposal section built by index `C.proposal.length - 2` / `nb+1`. Silent misrender if content list changes.
11. docs/js/ui/jev-log.js:38, 50 — `req.request` undefined when jev:request missed (pending map empty) → `pre(null)` ok, but okCalls.push with undefined request → export `buildRecordingEntry` may throw. ?
12. docs/js/ui/jev-log.js:44 — `pending` entries never evicted if no response/error ever arrives (only jev:error / jev:response delete). Small leak. ?
13. docs/js/ui/dashboard.js:44 — `typeof x === 'number' ? x.toFixed(2)` → score level renders "2.00" (integer level). Cosmetic.
14. docs/index.html:87 — params-panel `open` always; spec §4.2 says closed on < 768 px. Missing media/JS handling.
15. docs/js/ui/about.js:27 / key-modal FOCUSABLE — none significant.

Open gaps from scratch (not verifiable in chunk): dashboard.js:84 uses collateralProbs (JEV beta not applied, per scratch "Choice p_k ignores JEV beta") — ? outside chunk; dashboard.js:115 "sim slowed" only when f.capped — per scratch, intended.

Passes: theme.js (localStorage try/catch, data-theme), store.js, keyboard guards (modal/drawer hidden), about-content rendered via textContent (about.js:9), key-modal no echo, Esc on key-modal (when focus inside).

## XREF
Bus events (emit/listen):
- run:changed{run} — header.js:16 — def (emit)
- reset{runId} — header.js:20 — def (emit); listened: jev-log.js:56, charts.js:150, circuit-view.js:216 — used
- step{} — header.js:38 — def (emit) (T15 listens)
- mode:changed{mode} — header.js:34, key-modal.js:61 — def (emit) (T15 listens)
- key:open{} — header.js:41, keyboard.js:18 — def (emit); listened key-modal.js:76
- about:open{} — header.js:42, keyboard.js:19 — def (emit); listened about.js:66
- banner{level,text} — header.js:46, key-modal.js:51 — def (emit); listened banner.js:21
- jev:ask{ids} — dashboard.js:63 — def (emit) (T15 listens)
- jev:request/jev:response/jev:error — listened dashboard.js:66-92, jev-log.js:44-55; main.js also
- frame — listened dashboard.js:97; charts/circuit-view listen
- stimulus:changed{id} — input-panel.js:27 — def (emit)
- params:changed{patch} — params-panel.js:17,41,55 — def (emit)
- neuron:selected{ids} — circuit-view.js:112 — def (emit)

Store keys:
- header.js: read mode, run, runId, seed, speed, budget, availability, unrecorded, theme; write run, runId, seed, mode, speed.
- key-modal.js: read keySource, availability, mode; write mode='SIMULATED' (forget path).
- banner.js: read banner; write banner.
- dashboard.js: read selection, mode, budget, params, jevReadout, compare; write jevReadout, compare, `{}` (re-render trigger).
- jev-log.js: read mode, seed, params (export only); no writes.
- charts.js: read params, selection; (circuit-view and charts also read store.params.theta/routing).
- circuit-view.js: read selection, reducedMotion, params; write selection (default L23E-1).
- input-panel.js: read seed, stimulus, params; write stimulus, cycle.
- params-panel.js: read params, budget; write params, budget.cap.
- theme.js: read theme; write theme, reducedMotion.
- about.js, keyboard.js: none.
