# RV1 mid-point review — f4d81ee..3ac050e (+ HEAD network.js weights per controller note)

Verdict: PASS w/ fixes (0 Critical, 3 Important, 7 Minor). Unit suite: 79 tests, 75 pass, 0 fail, 4 skip (other-task modules + U-50 tree, T20).
Reviewed alone (≈1070 src + ≈1100 test lines, tightly coupled → no chunking).

## Verified clean (no finding)
- §2.4 step order in sim.js:84-174: input→topdown→read slot→neuron update (noise drawn always, before ref check)→spike draw per neuron always→spike handling asc→STDP→clear. Draw counts per stream fixed (rIn 256/step, rTd 26/step, rNoise N, rSpike N, rRoute 1/E-spike incl K=0, rStim 256 every n%100). Stream separation OK (U-22 real).
- Refractory: 4 silent steps, noul 0, dendrites keep integrating. Clamp→NaN guard order per spec. Hazard 1−(1−noul)^0.05.
- §2.5 Choice: max-subtracted softmax, τ_c≥0.05, inverse CDF `cum>=u` w/ last-k fallback, soft = p_k·w, β only L23E `output`. dampGain on all collaterals, not trunk.
- PV→E pvMode routing (inS w·g/4 / inShunt 0.3·g/4); inhibitory eff weight computed at delivery (FR-NET-03).
- §2.6 build order + draw count: 96 + 320 + 16 + 32 + 16 + 16 = 496 matches spec arithmetic; no self; rows in table order.
- §2.7 presets, kernel formula (72 = 2·6², 2.88 = 2·1.2², 18 = 2·3²), ±1 normalisation; effectiveIntensity/rates.
- §2.8 STDP: decay → LTP (post asc, pre asc) → LTD (pre asc, post asc) → increment; w∈[0,2·w0]; reset restores w0.
- §2.10 runaway: 50 ms windows, 3× >150 Hz → ×0.8 (min 0.4); 500 ms <50 Hz → +0.05.
- FR-DET-03 rasterHash incremental LE == fnv1a32Bytes(spikesSince(0)) (tested U-21).
- §3.5 emulator: jitter seed, sorted-key draw order, draws/key (5/1/0/0/1/K), logits, score interpolation, probMap residual → matches FR-JEV-19…22.
- §3.6 replay: requestHash = fnv1a32(canonicalJSON({state,questions})); features per FR-REC-04; limits 0.25/0.30; entry fields FR-REC-01a only.
- §3.8 validateResponse matches; real API (§3.1) always returns `confidence`, so requiring it is OK.
- summary↔sim interface: t, n, state.{S,Db,Da,ref,lastSpikeStep}, spikesSince pairs, params.theta all exist; window counting `[n−steps, n)` correct.

## Important
1. **docs/js/core/sim.js:205** — `setParams({seed})` → `reset(seed)` reseeds streams only; topology stays from old seed. Result: run ≠ fresh `buildNetwork(p,seed)+createSim` for same seed → FR-DET-01 / U-21-style reproducibility broken whenever seed changed via setParams (URL `?seed=`, seed-input apply) unless T15 rebuilds. Spec FR-SIM-04 says seed "requires reset" but sim cannot rebuild. Fix: drop `seed` from setParams path (ignore or throw `'seed change requires buildNetwork + createSim'`), and make T15 seed-apply always rebuild network + sim. At minimum add T15 brief item + E2E check "setSeed(43) raster == fresh load ?seed=43".
2. **tests/unit/emulator.test.mjs:47** — U-25 weakened. Neuron branch runs only for even `i` → `[...][i % 4 >> 0]` picks only `L4E-1`/`L5E-3`; `i % 4 === 3` never true there → interneuron (2-question, no `neuron_choice`) and L23E paths never exercised; L4E/L5E get L23E collaterals (`output,recurrent,lateral`) → not "valid summaries". Fix: index `(i >> 1) % 4`, collaterals per pop (or build via `summarizeNeuron` on stub sim), interneuron `collaterals: []`.
3. **docs/js/core/sim.js:53** — initial `p = {...DEFAULTS, ...params, ...clampParams(params,{allowFixed:true})}`: raw `params` spread first, so values clampParams drops (non-finite, wrong type, bad option) survive unclamped (e.g. `tauC:'x'` → `Math.max(0.05,'x')`=NaN → all p_k NaN → hard routing always last k; `tauM:NaN` → lamM NaN → nanResets every step). Also fixed keys accepted at creation without `opts.test` (FR-SIM-04). Fix: `p = {...DEFAULTS, ...clampParams(params, {allowFixed: test})}` (U-12 already passes `{test:true}`; check other tests creating with fixed overrides).

## Minor
4. **docs/js/jev/summary.js:67-68** — `input_spikes_last_10ms` counts every collateral synapse of a spiking source regardless of routing → overcounts in hard mode (only chosen k delivered); pixel/top-down input ignored. Fix: count only `routesSince` chosen k (hard) / skip collaterals with p-weighted count, or document as "presynaptic spikes of connected cells".
5. **docs/js/jev/summary.js:45** — `prevWindow` copied verbatim (no r1, no key whitelist) → FR-JEV-15 (1-decimal numbers only, fixed keys) depends on caller. Fix: `Object.fromEntries(ORI.map(o => [o, r1(+prevWindow?.[o] || 0)]))`.
6. **docs/js/jev/summary.js:76** — unknown id → `POP[pre]` undefined → TypeError. Fix: throw explicit error or return null.
7. **docs/js/jev/replay.js:53** — tie-break "lowest i" (FR-REC-05) implemented as array order; wrong if entries not sorted by `i` (hand-merged recordings). Fix: `d < bestD || (d === bestD && e.i < best.i)`.
8. **docs/js/core/sim.js:92** — `network.kernels[i]` indexed by neuron index; Network contract (§5.2, network.js:95) builds kernels per L4E in pop order. Works only because L4E = indices 0-15. Fix: map L4E position (`kernels[j]` with j = loop index over `L4E`).
9. **tests/unit/sim.test.mjs:259-274** — U-61 "every inhibitory effective weight" covered by one VIP→SST synapse only; PV→E (subtractive + divisive shunt 0.3·g/4) and SST→apical not checked. Fix: add PV→E and SST→E cases.
10. **tests/unit/replay.test.mjs:45** — U-39c "perturbed L1 0.1" actually L1 ≈ 0.073; neuron nearest path (limit 0.30) untested. Fix: construct features with L1 exactly 0.1 / 0.5, add one neuron case.
11. **docs/js/core/sim.js:176-182** — logs retained 20000 steps (10 s); `spikesSince(0)` silently truncated after 10 s sim (not in §5.2 contract). Fine for summary/readout windows; warn T15/T16 not to use `spikesSince(0)` for totals (use rasterHash / own counters).

## Notes
- Controller note honoured: network.js weights at HEAD (ascending 36, output 48) not flagged.
- Not checked: emulator golden numbers recomputed independently (code path matches spec line-by-line); calibration rates (T05 scope); readout/scheduler/client/keystore (excluded).
