# SystemOne Microcircuit

**Score → Noul → spike → Choice: a cortical microcircuit built from JEV's typed primitives.**

An interactive browser demo of an original idea by Benedek Molnár: the three typed primitives of the
[TypeSafe JEV](https://docs.typesafe.ai) System-One model are used as neuron primitives.

| JEV primitive | Neuron function in this demo |
|---|---|
| **Score** | graded, leaky membrane / dendritic potential |
| **Noul** | probability of a spike within the next 10 ms (the spike itself is a random sample of it) |
| **Choice** | which axon collateral carries the spike |

58 such neurons form a toy circuit inspired by a visual-cortex column (L4 → L2/3 → L5, with PV, SST and VIP
interneurons) that looks at 16×16 pixel images. JEV sits on top as a semantic control layer. Routing each spike to
exactly one collateral is a deliberate, non-biological simplification (see About / Science).
It is a teaching toy, not a biophysical model — see **About / Science** in the app for what is established
neuroscience, what is the original proposal, and what is simplified.

## Path A. Just open it (no key needed)

**▶ https://benedekmolnarvito.github.io/systemone-microcircuit/**

Runs entirely in your browser in **SIMULATED JEV** mode: a deterministic local stand-in with the same response
format as JEV, computed by a simple formula from layer-4 firing rates, not by the JEV model. If the build ships a
recording, **REPLAY JEV** plays back genuine JEV answers. No key can be entered on this page (there is no proxy).

### Controls
- **Left:** pick a stimulus (bars, diagonals, checkerboard, digit glyphs, noise, blank) or draw your own;
  adjust contrast, pixel noise and input rate. Below: model parameters (leak τ, threshold θ, noise,
  E/I balance, routing temperature τ_c, hard/soft routing, PV mode, top-down attention, STDP).
- **Center:** the circuit. Neurons glow with their Score; dots travel along the collateral Choice picked.
  Click a neuron to inspect it (Shift+click to compare up to 3).
- **Right:** readout ("what the circuit thinks it sees"), spike raster, Score and Noul traces,
  Choice probabilities, population rates, **Ask JEV**, and the JEV call log.
- **Keys:** Space play/pause · S step · R reset · K key · A about · J ask JEV · 1–0 presets.
- **Seed:** same seed + same inputs + same settings = identical simulated run.

## Path B. Presenter: live JEV

Browsers cannot call the JEV API directly (it does not allow cross-origin requests), so LIVE mode uses a
tiny local proxy that ships with this repo. Requirements: Node.js 18 or newer. No `npm install`.
Set the key without typing it into your shell history (get it from https://console.typesafe.ai/keys):

```bash
# macOS / Linux
read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY
node tools/jev-proxy.mjs
```

```powershell
# Windows PowerShell 7
$env:TYPESAFE_API_KEY = (Read-Host -MaskInput 'JEV key')
node tools/jev-proxy.mjs
```

```bat
:: Windows cmd (note: the key may end up in the console history; prefer PowerShell)
set /p TYPESAFE_API_KEY=JEV key:
node tools/jev-proxy.mjs
```

Then open **http://127.0.0.1:8787** and select **LIVE**. The proxy listens on 127.0.0.1 only, keeps the
key server-side, caps usage (200 calls per run, 2 requests/s) and never logs the key. Without the
environment variable you can paste a key in the page (🔑); it is sent only to the local proxy.
Cost is tiny (about $0.00002 per call at $42 per billion input tokens), and the page also stops at a
per-session budget (default 50 calls). Try it without a key or any network traffic:
`node tools/jev-proxy.mjs --mock-upstream` (canned answers, model `jev-mock`).

Record a session for REPLAY: `node tools/jev-proxy.mjs --record docs/data/jev-recording.json`.

## Enable GitHub Pages (repo owner)

Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: `main`, folder
**`/docs`** → Save. The site appears at `https://benedekmolnarvito.github.io/systemone-microcircuit/`.

## Run locally like GitHub Pages (static only)

```bash
node tools/jev-proxy.mjs --no-api --port 8080
```

Open http://127.0.0.1:8080. (Opening `index.html` directly from disk is not supported because browsers
block ES modules on `file://`.)

## Safety
- Never commit an API key. This repo contains none; a test scans for key-like strings (examples in the repo
  always contain `FAKE`).
- Keys are never put in URLs, logs or recordings. "Forget key" removes it from the browser.
- When presenting, prefer the proxy's environment key: a pasted key is visible in the browser's developer
  tools (Network tab).
- The optional Cloudflare Worker template (`tools/cf-worker.js`) spends **your** JEV credits for ANYONE on the
  internet: its Origin allowlist only stops browsers on other sites, not scripts. Keep the allowlist minimal,
  add a Cloudflare rate-limiting rule and a daily spend cap, and delete the Worker after the demo.

## Tests
Requires Node.js 22 or newer for development.
```bash
node --test "tests/unit/*.test.mjs"     # unit tests, no dependencies
npm ci && npx playwright install chromium && npx playwright test   # end-to-end + screenshots
```
If `npx playwright test` hangs with no output (seen on Node 25 with the pinned Playwright 1.49.1), set `PW_DISABLE_TS_ESM=1` first (bash: `PW_DISABLE_TS_ESM=1 npx playwright test`; PowerShell: `$env:PW_DISABLE_TS_ESM=1; npx playwright test`).
Screenshots and what each proves: [`tests/EVIDENCE.md`](tests/EVIDENCE.md). Full spec: [`docs/SPEC.md`](docs/SPEC.md).
