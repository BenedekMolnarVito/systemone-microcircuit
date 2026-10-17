# Carry-forward interfaces (for T14/T15)
- T10: header owns reset (runId+1, emits reset{runId}); seed apply → store.seed + replaceState ?seed= + reset.
- T10 extra bus events: `step`, `key:open`, `about:open` → T14/T15 listen.
- T10 mode click sets store.mode + emits mode:changed; T15 must revert if LIVE needs key.
- T10 store init needs: availability, budget, unrecorded, theme="system", speed, seed, run, runId.
- T10 open: aria-describedby on disabled mode buttons missing; "Key ✓" label → T14.
- T13: initInputPanel(store,bus), initParamsPanel(store,bus). store.cycle (bool) → T15 rotates presets every 2000 ms sim. Store init needs params, stimulus{id,img}, seed, budget.
- T06: summary.js reads sim.t, sim.n, sim.state.{S,Db,Da,ref,lastSpikeStep}, sim.spikesSince, sim.params.theta → check vs T04 sim.js. Network collaterals[src]=[{id,k,b,gamma,targets:[{target(idx),comp,w0,dSteps,inhibitory}]}] (controller aligned summary 268e11f).
