# Carry-forward interfaces (for T14/T15)
- T10: header owns reset (runId+1, emits reset{runId}); seed apply → store.seed + replaceState ?seed= + reset.
- T10 extra bus events: `step`, `key:open`, `about:open` → T14/T15 listen.
- T10 mode click sets store.mode + emits mode:changed; T15 must revert if LIVE needs key.
- T10 store init needs: availability, budget, unrecorded, theme="system", speed, seed, run, runId.
- T10 open: aria-describedby on disabled mode buttons missing; "Key ✓" label → T14.
