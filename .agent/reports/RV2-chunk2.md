# RV2 chunk2 report (f4d81ee..HEAD)
Scope: docs/js/jev/{client,emulator,keystore,replay,schema,summary}.js + tests/unit/{client,emulator,keystore,replay,schema,secrets,live-real}.test.mjs. Read-only review.

## Critical
none.

## Important
1. docs/js/jev/client.js:137,174-177 — budget switch-over late. Spec FR-JEV-13: when used == cap → switch SIMULATED, autoJev off, banner. Code only switches when the NEXT ask hits budget check (used >= cap). Scenario: cap 50, 50th LIVE call succeeds → mode stays LIVE, UI still offers LIVE; 51st tick → budget_exhausted. Test U-44 (client.test.mjs:46) encodes the late behaviour, so spec mismatch is locked in. Fix: switch when budget.used reaches cap after successful increment.
2. tests/unit/secrets.test.mjs:21 — reads process.env[<key var>]. Spec FR-TST-08 / CLAUDE.md: tests never read <key var> except live-real.test.mjs with JEV_LIVE_TEST=1. Scenario: unit run in dev shell with real key → value compared against all tracked files only (no leak) but still violates the rule; also a future edit could print it. Fix: drop env read, scan patterns only (or move to live-real).

## Minor
3. tests/unit/live-real.test.mjs:6 — `const key = process.env[<key var>];` read at module top, unconditionally. Only `live` gate checks JEV_LIVE_TEST. Spec FR-TST-08: read only under JEV_LIVE_TEST=1. Scenario: harmless now (not logged), but violates gate. Fix: `const live = process.env.JEV_LIVE_TEST === '1'; const key = live ? process.env[<key var>] : undefined;`.
4. docs/js/jev/client.js:163 — retry sleep timer `st(r, ...)` never cleared (`ct`) on abort. Scenario: abortAll during banner-backoff leaves 1-2 s pending timer; resolves later into no-op. Minor leak, no wrong result.
5. docs/js/jev/client.js:145,154 — `res.json()` TypeError (not SyntaxError) → classified `proxy_unreachable` (retry false) and banner "Lost connection to the local proxy" though proxy is up. Scenario: body stream aborted/decoding TypeError. Edge only.
6. docs/js/jev/client.js:107-108 — REPLAY: `latencyMs: m.entry.latencyMs` undefined when recording entry lacks it (validateRecording doesn't require latencyMs). Scenario: latency chart NaN on hand-made recording. ?
7. docs/js/jev/emulator.js:85 — neuron_score: `hi - lo === 0` when level 4 and theta=40 (range [th,40]) → `(S-40)/0` = NaN at S==40 → clamp(NaN) NaN → score NaN in SIMULATED output (unvalidated path, client.js:110). Scenario: theta slider at 40 mV, soma exactly 40. ? edge; guard `hi > lo`.
8. docs/js/jev/replay.js:68 — `recordedAtMs: Date.now()` impure in entry builder; non-deterministic recording bytes. Spec §10 determinism only covers sim; likely OK. ?
9. docs/js/jev/summary.js:75-79 — summarizeNeuron: id without '-' → ks undefined → i = NaN; out-of-range ks (e.g. 'L4E-20') silently reads another population's neuron. Callers (main/UI) pass ids from fixed list; low risk.
10. docs/js/jev/keystore.js:34-36 — set(): if `on.setItem` ok but `off.removeItem` throws → returns memoryOnly though key persisted in `on`. Harmless (key stays stored, UI says tab-only). Minor.
11. docs/js/jev/schema.js:~126-129 — choice answer's `choice` not checked against argmax of probabilities; accepted as-is. Spec-acceptable? ?
12. docs/data/jev-recording.json (52 B) placeholder and tests/fixtures/recording.json: latter shows as modified in git status (uncommitted) and replay.test.mjs:~44 validates it → test result depends on uncommitted file. Commit or verify.

## Checked OK
- Key never in jev:request/response/error payloads: request has no key; error messages redacted (client.js:151,155). serializeLogEntry whitelist (replay.js end) excludes headers/key. U-39 covers.
- X-JEV-Key only when keySource==='none' && same-origin /api/jev (client.js:140, canSendKey 22-28). Matches FR-KEY-01/02.
- Keystore storage routing matches FR-KEY-05 (remember→local, else session; other removed). forget clears both (FR-KEY-07). Masked `•••• ` + last 4 (FR-KEY-06). normalizeKey matches FR-KEY-04 (8..512, printable ASCII). Module-private closure (FR-KEY-10). Not attached to bus.
- REPLAY re-validates matched entry (client.js:106, FR-REC-05). findMatch order + thresholds 0.25/0.30 + ties→lowest i match spec.
- validateResponse: clamps noul/score/confidence, renormalises, rejects non-finite, rejects unknown choice keys, model≤64. Schema strictness acceptable.
- summary.js fields exist in sim.js: t, n getters (sim.js:213-214), params (215), state.{S,Db,Da,ref,lastSpikeStep} (sim.js:46,99), spikesSince (220). network.trunk / collaterals[].targets[].{target,inhibitory} match network.js:91 shape. POP ranges cover 0..57. Group divisions fine.
- Health: 1500ms timer, token guard, strict JSON shape (client.js:81-98) per FR-JEV-05.

## Not verified
- DEFAULTS.delta existence in docs/js/core/params.js (emulator.js:88) — not grepped.
- Full text of client.test.mjs 105-257, schema.test.mjs 102-109, emulator/schema golden fixture contents.

XREF:
createJevClient — docs/js/jev/client.js:30 — def
classifyError — docs/js/jev/client.js:~36 — def (used by client tests)
canSendKey — docs/js/jev/client.js:~46 — def
client.ask(kind,request,simTimeMs) — docs/js/jev/client.js:100 — def (main/UI calls)
client.health() — docs/js/jev/client.js:81 — def
client.setMode/abortAll/resetRun/setReplay/setBudgetCap/liveMinIntervalMs/skipped/budget/inFlight/callIndex/mode — docs/js/jev/client.js:60-79 — def
client events emitted: jev:request, jev:response, jev:error, banner{level,text}, mode:changed{mode} — client.js:102,115-124,162,185 — def
createKeystore(storage) → enable,enabled,get,set,forget,masked,has,markInvalid,isInvalid — docs/js/jev/keystore.js:12 — def
normalizeKey — docs/js/jev/keystore.js:3 — def
circuitRequest, neuronRequest, validateRequest, validateResponse, ORIENTATIONS — docs/js/jev/schema.js:1,~30,~37,~58,~103 — def
summarizeCircuit(sim,network,windowMs,prevWindow,stimulusId,localLabel), summarizeNeuron(sim,network,id) — docs/js/jev/summary.js:~27,74 — def
validateRecording, requestHash, matchKey, findMatch, buildRecordingEntry, buildRecording, serializeLogEntry — docs/js/jev/replay.js:5,22,25,33,48,58,73 — def
emulate(request,ctx), localScoreLevel — docs/js/jev/emulator.js:~37,~24 — def
used: DT, DEFAULTS (params.js) — summary.js:2, emulator.js:4, client.js — used
used: sim.t/n/params/state/spikesSince — summary.js — used (sim.js:213-220)
used: streamSeed, STREAM, mulberry32 (core/rng.js); fnv1a32, canonicalJSON, hex8 (core/hash.js) — emulator.js:2-3, replay.js:2 — used
used: createBus (ui/bus.js) — client.test only
