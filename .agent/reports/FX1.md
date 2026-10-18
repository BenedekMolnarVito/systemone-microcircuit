# FX1
DONE. suite 112 tests: 110 pass, 0 fail, 2 skip.
Fixed: 
- I1 sim.js setParams: `seed` dropped (ignored). Ruling: §5.2 setParams sig has no seed; FR-SIM-04 "requires reset" cannot rebuild topology → FR-DET-01 safe only if caller rebuilds buildNetwork+createSim. reset(seed) kept (streams only). T15: seed apply = rebuild network + sim.
- I2 emulator.test U-25: idx (i>>1)%4, per-pop collaterals, interneuron [].
- I3 sim.js init p = {...DEFAULTS, ...clampParams(params,{allowFixed:test})}.
- M5 summary prevWindow whitelist + r1. M6 unknown id throws. M4 documented (comment: counts all connected-cell spikes, not routing). M7 replay tie-break e.i.
Skipped: M8 kernels index (no spec violation, L4E=0-15); M11 retention (T15/T16 note: don't use spikesSince(0) for totals, use rasterHash/counters); M9 U-61 PV/SST cases, M10 U-39c L1 exact (test narrowness, not done this pass).
