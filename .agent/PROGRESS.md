# PROGRESS — LIVE 502 investigation (2026-11-02)
Branch feat/educative-ui. No code changed in this task. Phase 4 status is in git log (4f74ee0).

## Now
User report: `2026-11-02T14:17:11.873Z POST /api/jev 502 7ms q=3` in LIVE mode.
Checks run (no billed JEV calls):
- `node --test tests/unit/proxy.test.mjs` -> 17 pass, 0 fail.
- `git status tools docs/js/jev` -> clean (proxy and jev code match HEAD).
- Upstream GET https://api.typesafe.ai/v1/systemone -> 405 in ~220 ms (reachable).
- POST with env key and body `{}` -> 422 `detail[]:missing` in 183 ms (key accepted, validation only).
- TYPESAFE_API_KEY is set, clean ASCII, no whitespace. TYPESAFE_BASE_URL and HTTPS_PROXY unset in this shell.
- Nothing listens on 127.0.0.1:8787 right now.
Finding: a real upstream round trip takes >= 180 ms. 7 ms means the proxy failed locally. Only `handleJev` 502 paths fit: `network` (fetch threw, tools/jev-proxy.mjs:146) or `upstream_malformed` (non-JSON 200 or unmapped upstream status, lines 151-155).

## Next
1. Ask the user for the 502 response body `error.code` and message (browser devtools Network tab, or the JEV log entry `fallback:<code>`). `network` -> "Could not reach upstream"; `upstream_malformed` -> "Upstream status NNN".
2. Ask which shell and env started the proxy: check `TYPESAFE_BASE_URL` (must be https or loopback) and whether it points to a closed port.
3. If `network`: the proxy process env points elsewhere. Restart it with `node tools/jev-proxy.mjs` in a shell where `TYPESAFE_API_KEY` is set, then retry.
4. If `upstream_malformed`: capture the upstream status from the proxy message and check SPEC section 3.1 for an endpoint change.

## Blockers
- Cannot see the user's proxy env or the 502 body from here. Need steps 1-2 from the user.
- Not run: a valid 3-question request to the real upstream (billed; CLAUDE.md allows billed calls only at T17 or a human check).

## Decisions
- Did not edit code: the 17 proxy tests pass and the probes show the upstream is healthy.
- Probes used no billed model calls (GET 405, empty-body POST 422).
- Phase 4 decisions still hold: About keeps 6 SPEC sections in order; tooltips use static title= in index.html; btn-about label is "About the science".
