# RV2 chunk1 review (f4d81ee..HEAD) — docs/js/core/*.js + tests/unit/{encoding,rng,loop,network,params,readout,sim,stimuli,scheduler,determinism,calibration,bench}.test.mjs

Test run: `node --test "tests/unit/*.test.mjs"` → 134 tests, 132 pass, 0 fail, 2 skipped (live-client budget/timing tests, intentional).

## Counts
- Critical: 0
- Important: 2
- Minor: 3
- ? (unsure): 1

## Important

- docs/js/core/sim.js:184 (`reset`) + docs/js/core/scheduler.js:66 (`reset()`): Choice control `control = {betaOutput, stdpM}` is never cleared on reset. sim.reset() does not touch `control`; scheduler.reset() sets `controlled=false` but does not call `sim.setControl` neutral, so afterStep's neutralize branch never fires. Spec: FR-DET-01 (same seed + stimulus + params → identical raster), FR-JEV-18 (control neutral when off). Failure: LIVE/SIM run with jevControl sets β=0.5 → user hits Reset (or seed change via reset) → replay with same seed gives different raster until next JEV answer. Repro (scratchpad ctl.mjs): fresh sim rasterHash 07f13b39 vs after setControl({betaOutput:0.5}) + reset + 2000 steps → 463f3c54. Fix: in sim.reset reset `control` to {betaOutput:0, stdpM:1}, or have scheduler.reset call sim.setControl neutral. Note the same stale state also affects the first ticks after reset.
- tests/unit/scheduler.test.mjs:77 (`U-56 reset clears pending...`): asserts callIndex/lastTickMs/tick times only; does not check control neutral or raster equality after reset. Gap that hides the bug above. Add: setControl applied → reset → rasterHash equals fresh run.

## Minor

- docs/js/core/sim.js:~52 (`network.kernels[i]`, step 1 input loop): kernels array indexed by neuron index, but built as L4E-ordinal list in network.js (`neurons.filter(L4E).map`). Correct only because L4E are neurons 0..15 (POPS order). Fragile, no assert. Failure: reorder POPS → wrong kernel per L4E cell silently.
- docs/js/core/loop.js:7 (`computeSteps`): `Math.min(wallDeltaMs,100)` not floored at 0. Negative wall delta (clock skew) → negative acc/steps. Failure: steps<0 → loop runs backwards / NaN-free but wrong. Low likelihood (performance.now monotonic).
- docs/js/core/sim.js:~186 (`reset`) `forced` (debug.forceNoul) not reset: test-only, harmless, but a test using forceNoul then reset keeps overrides.

## ? (unsure)

- docs/js/core/scheduler.js:14-18 (`applyControl`): score domain assumed 0–4 (`s/4 − 0.5`) and clamp(0,4) — JEV circuit_evidence schema (SPEC §3.4) not read in this chunk; verify against schema range.

## Checked, OK (no finding)

- sim.js step order (SPEC 2.4 steps 1–8): input/TD draws per pixel/neuron always; ring slot (n+2)%4 for inputs; slot clear after advance; ref decrement, noul=0 when refractory; ξ always drawn; clamps [−20,40]/[0,20]; NaN guard; spike hazard 1−(1−noul)^(dt/W) with noulExp=0.05.
- Choice (2.5): a_k = b + γ·Da/θ + β (β only on L23E `output`, FR-JEV-17); max-subtract softmax; τ_c floor 0.05; `u` drawn per spiking E cell in both modes; inverse-CDF with last-k fallback; soft weights ×p_k. Uses JEV β as spec says (not a separate beta source).
- PV→E split (2.4 step 6): subtractive → inS w, divisive → inSh 0.3·g/4. Trunk inhibitory weights scaled g/4 (FR-NET-03 live).
- STDP (2.8): order (a) decay, (b) LTP in post-asc then LTD in pre-asc, (c) increment; inc/out sorted per spec; w_max=2·w0 clamp; M from scheduler applyControl (0.5+ν) clamped 0.5–1.5. Plastic excludes `lateral`.
- Runaway (2.10/FR-SIM-12): 100-step window, 3 consecutive hot windows, ×0.8 floor 0.4, +0.05 per 1000 steps recovery to 1. dampGain applied only to E collaterals.
- spikesSince/trimLogs pair alignment correct. hash FNV fnvU32 little-endian correct (FR-DET-03).
- params.js ROWS vs SPEC 2.3 table: all keys/defaults/ranges match; derived delay steps (3/2/2) match; fixed keys dropped unless test. No Math.random/Date in core (grep-verified by determinism tests + inspection).
- network.js vs 2.5/2.6 tables: all collateral and trunk rows, comps, weights, p_conn, delays match; draws only when p<1; no self-connections.
- readout.js (2.9): window 200 ms = 400 steps; Σ<4 → nothing; 1.5× & ≥4 rule; ties → lower o; soft fractional counts; agree() nothing/uncertain ≡ none.
- encoding.js kernels/presets match FR-ENC-02/05 (digit7 x0 formula, diag orientation vectors, normalisation).
- Scheduler (3.3): grid multiple of jevIntervalMs; change tick +50 with 300 ms debounce; skipGrid rule. Budget/LIVE gating NOT in this chunk (lives in client) — not reviewed here.

## Test coverage notes

- sim/scheduler/readout/network/encoding/params tests assert U-IDs matching SPEC/TASKS; calibration tests cover §2.11 (rates, blank/white, readout, runaway).
- Missing: reset-with-control determinism (above); setParams never resets state (FR-SIM-04) not seen asserted in chunk tests (grep-check if needed).

XREF:
- createSim — docs/js/core/sim.js:~20 — def
- sim.setControl / control.betaOutput,stdpM — docs/js/core/sim.js (setControl) — def/changed; used by scheduler.js apply/reset
- sim.reset(newSeed) — docs/js/core/sim.js:184 — def; used by T15 seed/reset, scheduler tests
- sim.routesSince(n0) — docs/js/core/sim.js — def; used by readout.js localReadout callers (T15/T05)
- sim.spikesSince(n0) — docs/js/core/sim.js — def; used by calibration tests, T06 summary.js
- sim.state.{S,Db,Da,ref,lastSpikeStep,weights,noul} — docs/js/core/sim.js — def; used by jev/summary.js (T06), circuit view (T11)
- sim.stats.{dampGain,runawayActive,nanResets} — docs/js/core/sim.js — def; used by UI banners (T12/T15)
- sim.rasterHash()/inputHash() — docs/js/core/sim.js — def; used by determinism tests, E29
- sim.setStimulus(img,id)/setParams/stepN/step/t/n/params/seed/stimulusId — docs/js/core/sim.js — def; used by T15, scheduler.js
- createSim test opt {test:true} + sim.debug — docs/js/core/sim.js — def; used by sim.test.mjs
- spikeHazard — docs/js/core/sim.js:~18 — def; used by sim.test.mjs
- buildNetwork(params,seed) — docs/js/core/network.js — def; used by T15, scheduler.js, calibration.test.mjs
- buildSingleNeuronNetwork(pop) — docs/js/core/network.js — def; used by sim.test.mjs
- COMP — docs/js/core/network.js — def; used by sim/ T03 consumers
- network.collaterals / trunk / plastic / kernels / neurons[].o — docs/js/core/network.js — def; used by sim.js (changed-shape contract), readout.js (`nr.o`, `collaterals[src].findIndex(id==='output')`), jev/summary.js
- DEFAULTS / PARAM_SPECS / clampParams / derive / parseSeed / DT — docs/js/core/params.js — def; used by sim.js, network.js, UI params panel (T13), T06 summary
- applyControl(answers,params) — docs/js/core/scheduler.js:14 — def; used by scheduler.test.mjs, T15 (contract per SPEC §5.2)
- createScheduler({sim,network,client,getParams,getStimulusId,getLocalLabel}) — docs/js/core/scheduler.js:24 — def; used by T15
- scheduler.afterStep/onStimulusChange/reset — docs/js/core/scheduler.js — def; used by T15 main loop
- summarizeCircuit (imported) — docs/js/jev/summary.js — used by scheduler.js
- circuitRequest (imported) — docs/js/jev/schema.js — used by scheduler.js
- client.ask / client.resetRun / client.callIndex — docs/js/jev/client.js — used by scheduler.js (changed contract: resetRun)
- localReadout(routes,n,network,windowMs,routing) — docs/js/core/readout.js:8 — def; used by T15, calibration.test.mjs
- agree(localLabel,jevChoice) — docs/js/core/readout.js:27 — def; used by T12 dashboard
- computeSteps(acc,wallDeltaMs,speed) — docs/js/core/loop.js:7 — def; used by T15 rAF loop
- RingBuffer — docs/js/core/ringbuffer.js — def; used by T12 charts
- mulberry32 / streamSeed / gauss / STREAM — docs/js/core/rng.js — def; used by sim.js, network.js, stimuli.js, jev emulator (STREAM.EMULATOR)
- fnv1a32 / fnv1a32Bytes / canonicalJSON / hex8 — docs/js/core/hash.js — def; used by sim.js (hex8), jev/schema, client (requestHash)
- makePreset / rasterize / effectiveIntensity / PRESET_IDS — docs/js/core/stimuli.js — def; used by T02/T13/T15
- rates / makeKernel — docs/js/core/encoding.js — def; used by sim.js (rates), network.js (makeKernel)
- sim.js imports effectiveIntensity, rates, derive, clampParams, DEFAULTS, hex8, mulberry32/streamSeed/gauss/STREAM — used
