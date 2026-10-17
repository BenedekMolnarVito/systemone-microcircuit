# SystemOne Microcircuit — Specification

**Version:** 1.1 (fix wave S2, 2026-10-17)
**Changelog:** v1.1 — applied review findings V1-sec, V1-impl, V1-sci: Noul redefined as the probability of ≥ 1 spike within a 10 ms window (the old fixed-rate constant removed; per-step hazard `p_step = 1 − (1 − Noul)^(dt/W)`); scaling numbers corrected and disanalogies disclosed; API-base URL parameter removed, key flow and storage restricted to the same-origin proxy, Cloudflare Worker documented as open credit spender; error-code table and retry rules; fixture keys must contain `FAKE`/`SENTINEL`/`REDACTED`; quoted unit-test glob, Node ≥ 22 for dev, committed lockfile; proxy `--mock-upstream`/`--no-api` replace python, env-isolated tests, Playwright trace/video off, `.gitignore`; determinism (named PRNG streams, build/STDP/tick order, sim-time debounce, scheduler module); `window.__mc` test hook and screenshot protocol; isolated-neuron test harness; module homes for helpers; file ownership (T01 owns `index.html` + `base.css`, per-component CSS) and rechecked waves; About content specified with tests (U-57); recording stores only validated answers; T17 automated and optional; owner URL fixed; references [2] and [10] corrected; FR → test traceability matrix (Section 7.4). v1.0 — draft S1.
**Owner / idea:** Benedek Molnár
**Status:** Implementation-ready specification. This document is the single source of truth for the demo. Requirement keywords MUST, MUST NOT, SHOULD, SHOULD NOT and MAY follow RFC 2119.

Every requirement carries an ID. Prefixes: `FR-` functional, `NFR-` non-functional. Areas: `SCI` science content, `SIM` simulation core, `NET` network, `ENC` input encoding, `RO` readout, `DET` determinism, `JEV` JEV integration, `PRX` local proxy, `REC` recording/replay, `KEY` API key handling, `UI` user interface, `A11Y` accessibility, `PERF` performance, `SEC` security, `ARCH` architecture, `TST` testing, `DOC` documentation.

---

## 0. Summary

### 0.1 Pitch

> **What if a neuron were three typed decisions?** SystemOne Microcircuit is an interactive browser demo of an original idea: the three typed primitives of the TypeSafe JEV System-One model — **Score**, **Noul** and **Choice** — are used as the building blocks of a spiking neuron. Score is the graded, leaky membrane potential; Noul is the probability that the neuron spikes within the next 10 ms; Choice decides which axon collateral carries the spike (a deliberate, non-biological simplification; see Section 1.4). Fifty-eight such neurons are wired into a toy circuit inspired by a visual-cortex column that "looks at" pixel images, and the real JEV API (or a local stand-in with identical response format) sits on top as a semantic control layer.

One-line pitch shown in the page header (FR-UI-02):
`Score → Noul → spike → Choice: a cortical microcircuit built from JEV's typed primitives.`

### 0.2 The core mapping (owner's proposal, corrected)

The pipeline per neuron and timestep is:

```
Score_t  →  Noul_t  →  spike_t  →  Choice_t  →  downstream Score_{t+1}
```

- **Score** = graded membrane / dendritic potential (electrotonic, analog, leaky, has a time dimension).
- **Noul** = probability of at least one spike within the window `W = 10 ms` (somatic threshold readout). Sampling the per-step hazard derived from Noul produces the all-or-none spike.
- **Choice** = axonal collateral routing (which downstream target receives the spike). Dendritic input gating is not modelled in this demo.

**Correction carried over from the source conversation (FR-SCI-01, MUST be stated in the About drawer verbatim):** *Noul is not a spike.* A biological spike is an all-or-none event; Noul is a probability in [0, 1]. Noul is a probability; spike is a Bernoulli sample of the per-step hazard derived from it. Precisely: Noul is the probability of at least one spike within a 10 ms window; each 0.5 ms step the neuron spikes with probability `p_step = 1 − (1 − Noul)^(dt/10 ms)`, so the chance of ≥ 1 spike over 10 ms of constant Noul equals Noul (ignoring refractoriness).

### 0.3 Glossary

| Term | Definition in this demo |
|---|---|
| **Score (local)** | Continuous membrane potential of a compartment, in mV relative to rest (`S` for soma, `D_b` basal dendrite, `D_a` apical dendrite). Leaky, integrates synaptic input. |
| **Score (JEV)** | JEV primitive: graded answer on an ordered rubric of 2–10 levels; returns a probability-weighted `score`, a `legend`, per-level `probabilities` and a `confidence`. |
| **Noul (local)** | `σ((S − θ)/Δ)` ∈ [0, 1]: probability of ≥ 1 spike within the window `W = noulWindowMs = 10 ms` at the current Score. Per-step hazard `p_step = 1 − (1 − Noul)^(dt/W)`. |
| **Noul (JEV)** | JEV primitive: probability in [0, 1] that a statement is true. |
| **Spike** | All-or-none event emitted when a Bernoulli sample with probability `p_step` (derived from Noul) succeeds and the neuron is not refractory. |
| **Choice (local)** | Softmax over a neuron's axon collaterals with temperature `τ_c`; hard mode samples one collateral, soft mode delivers to all collaterals scaled by probability. |
| **Choice (JEV)** | JEV primitive: selects one option from a map of up to 255 options; returns `choice`, `probabilities` (sum 1) and `confidence`. |
| **Collateral** | A named group of outgoing synapses of an excitatory neuron (for example `ascending`, `recurrent`, `output`, `lateral`). The unit of Choice routing. |
| **Choice target** | The collateral selected (hard routing) or weighted (soft routing) for one spike. |
| **Trunk synapses** | Outgoing synapses that are always delivered regardless of Choice (onto local PV/SST interneurons; required for stability). |
| **Population** | A group of neurons of one type in one layer, for example `L23E` (layer 2/3 excitatory pyramidal), `L23SST`. |
| **Orientation group** | The 4 (L4, L2/3) or 2 (L5) excitatory neurons that share a preferred orientation. |
| **JEV tick** | One batched JEV request built from a summary of circuit state (Section 3). |
| **Mode** | Which JEV backend answers JEV ticks: `SIMULATED`, `REPLAY` or `LIVE`. |
| **Emulator** | Local deterministic function that answers JEV requests with the exact response shape of the real API (a local stand-in with identical response format, not the JEV model). |
| **Proxy** | `tools/jev-proxy.mjs`, a zero-dependency Node script that serves the page and forwards `/api/jev` to the real JEV API. It is also the only local server (flags `--mock-upstream`, `--no-api`). |
| **Recording** | `docs/data/jev-recording.json`, a file of real JEV request/response pairs used by REPLAY mode. |
| **Sim time** | Simulated biological time in ms, advanced in fixed steps `dt = 0.5 ms`. |
| **Wall time** | Real elapsed time in the browser. |

### 0.4 Assumptions

- A0-1: The demo is a didactic toy. It is not a biophysical model and makes no quantitative predictions.
- A0-2: The JEV API facts in Section 3 are those observed on 2026-10-17 (`jev-latest` → `jev-1.13.0`).
- A0-3: Browsers cannot call `https://api.typesafe.ai` directly: CORS preflight returns HTTP 400 `Disallowed CORS origin` for every origin tested, including `https://*.github.io` and `http://localhost:8080`. LIVE mode therefore goes through a same-origin proxy (Section 3.2).
- A0-4: Target browsers: current Chrome, Edge, Firefox and Safari (last 2 major versions). No IE, no legacy Edge.
- A0-5: The repository is public. The API key is a secret and never enters the repository.
- A0-6: The GitHub owner is `BenedekMolnarVito` (from `git remote -v` at the time of writing); Pages URL `https://benedekmolnarvito.github.io/systemone-microcircuit/`. The implementer MUST re-verify with `git remote -v` and correct the README if the owner changed.

### 0.5 Out of scope (explicit)

- OOS-1 Webcam or camera input.
- OOS-2 Image upload or drag-and-drop of files (dropped files are ignored).
- OOS-3 Training to convergence, backpropagation or surrogate-gradient learning.
- OOS-4 CLM-8B and LeWorldModel integration (discussed in the source conversation; not part of this demo).
- OOS-5 Biophysically detailed models (Hodgkin–Huxley, conductance-based synapses, cable equations).
- OOS-6 Layer 6 and thalamic feedback loops.
- OOS-7 Web Workers, WebGL and WASM (the network is small enough for the main thread).
- OOS-8 User accounts, server-side storage, analytics or telemetry of any kind.
- OOS-9 Internationalisation (UI is English only).
- OOS-10 A hosted public LIVE endpoint operated by the project (the Cloudflare Worker template is documentation only).

---

## 1. Scientific background

### 1.1 Separation of claims (FR-SCI-02)

The About / Science drawer and this spec MUST label every claim with exactly one of three tags (mapping-table rows MAY carry one tag per column part, written `TAG (aspect) / TAG (aspect)`):

- **[ESTABLISHED]** established neuroscience, with a citation from Section 11.
- **[PROPOSAL]** the owner's original proposal (JEV primitives as neuron primitives).
- **[DEMO]** a simplification or engineering choice made for this demo.

FR-SCI-03: Only references listed in Section 11 MAY be cited. Every one of them was verified (DOI resolved and title/authors matched; vendor docs [37–39], which have no DOI, accessed 2026-10-17) in research reports R1, R2 or in this spec's own Crossref check.
FR-SCI-04: The page MUST NOT cite: Douglas et al. 1995 (DOI unresolved), the "200–300 ms" memory-fading figure, the SE-SNN paper as a liquid-state-machine reference, firing rates of inhibitory populations, or any performance figure as a citation.
FR-SCI-05: The page MUST NOT call Kudithipudi et al. 2025 a "roadmap"; cite it plainly.
FR-SCI-09: The About drawer (`about-simplification`) and the `readout-panel` tooltip (`title` attribute) MUST state verbatim: "In SIMULATED mode the JEV answers are computed by a simple local formula from L4 firing rates, not by the JEV model. Agreement in this mode shows the plumbing, not JEV's judgement. REPLAY and LIVE show genuine JEV answers."

### 1.2 Established background [ESTABLISHED]

- The canonical cortical microcircuit routes thalamic input mainly to layer 4, then to layer 2/3, then to layer 5, with recurrent excitation and inhibition at each stage [12, 13, 15].
- Potjans & Diesmann built a full-scale spiking model with 8 populations (L2/3, L4, L5, L6 × excitatory/inhibitory) plus thalamus, with τ_m = 10 ms, refractory period 2 ms, threshold −50 mV, reset −65 mV, excitatory delay 1.5 ms and inhibitory delay 0.8 ms, and simulated mean excitatory rates of 0.86 Hz (L2/3), 4.45 Hz (L4), 7.59 Hz (L5) and 1.09 Hz (L6) [14].
- Leaky integrate-and-fire (LIF) neurons and sparse excitatory/inhibitory networks are standard abstractions [16, 17]. Escape-noise (stochastic threshold) models let the firing intensity depend on the distance of the membrane potential to threshold [16, 18].
- Cortical interneurons fall into classes with distinct targets: PV cells inhibit perisomatically (fast, soma-targeting), SST cells target dendrites, and VIP cells inhibit SST cells, which disinhibits pyramidal neurons [19, 20, 21].
- Divisive normalisation is a canonical neural computation that yields gain control and soft winner-take-all behaviour [28].
- Retinal ganglion cells have centre–surround receptive fields [22, 23]; simple cells in primary visual cortex are orientation selective with elongated receptive fields [24].
- Spike-timing-dependent plasticity (STDP): pre-before-post pairing potentiates, post-before-pre depresses, within a window of roughly ±20 ms [25]; pair-based exponential-window models are standard [27]; STDP produces competition between inputs [26]. Three-factor (neuromodulated) rules add a third gating signal [10].
- Dendrites are active computational units: a back-propagating action potential coinciding with distal apical input triggers a dendritic Ca²⁺ spike and burst firing in L5 pyramidal neurons [29]; pyramidal neurons can be approximated as two-layer networks of sigmoidal dendritic subunits [30]; dendritic spikes enable local nonlinear computation [31, 32]; active dendritic currents gate descending cortical outputs during perception [4].
- Dendritic structure benefits artificial and spiking networks: dendritic ANNs [1], heterogeneous dendritic time constants in SNNs [2], dendritic compartments in SNN frameworks [3], compartment-specific plasticity rules in vivo [7], local dendritic balance [8], dendritic prediction of somatic spiking [9]. A 2026 survey reviews dendritic learning for AI [6]. Neuromorphic computing at scale emphasises event-driven, sparse computation [5]. A general SNN review covers spikes and STDP [11].
- Synaptic transmission is probabilistic: release probability varies between terminals and is under feedback control [34] and shapes the neural code [35]; spikes can fail to propagate at axonal branch points, although an action potential normally reaches all collaterals [36].
- Educational interactive neural-circuit simulators exist (Neuronify) [33].

### 1.3 The owner's proposal [PROPOSAL]

- Treat JEV's Noul, Choice and Score as a minimal, composable typed instruction set for a neuron-like unit.
- Make Choice an explicit, probabilistic axon-collateral router.
- Use JEV as a semantic decision layer above a fast spiking loop: spikes handle timing; JEV answers higher-level typed questions ("which orientation is present?", "is this input novel?", "how strong is the evidence?") and returns control signals.
- Probabilistic release and branch-point failures [34–36] are the closest biological analogues of Choice-like routing; this demo differs from existing simulators [33] by mapping neuron functions onto JEV's typed primitives.

### 1.4 Mapping table (FR-SCI-06: rendered in the About drawer verbatim)

| Primitive | Biology | Demo implementation | Tag |
|---|---|---|---|
| Score | Graded, leaky membrane and dendritic potential; branch-specific time constants [31] | `S`, `D_b`, `D_a` per neuron with leak factors `λ = exp(−dt/τ)`; basal τ_b = 10 ms, apical τ_a = 30 ms, soma τ_m = 10 ms; heterogeneous τ motivated by dendritic SNN models [2, 3] | ESTABLISHED (biology) / DEMO (values) |
| Noul | Somatic firing probability under escape noise [16, 18] | `Noul = σ((S − θ)/Δ)` = probability of ≥ 1 spike within `W = 10 ms`; per-step hazard `p_step = 1 − (1 − Noul)^(dt/W)` | PROPOSAL (mapping) / DEMO (sigmoid form) |
| Spike | All-or-none action potential, reset, refractoriness [14, 16] | Bernoulli sample of `p_step`; reset to 0 mV; 2 ms refractory | ESTABLISHED |
| Choice | Probabilistic release [34, 35], branch-point conduction failure [36], dendritic gating of output [4] | Softmax over collaterals with temperature `τ_c`; logits depend on apical potential | PROPOSAL (mapping) / DEMO (formula) |
| PV inhibition | Perisomatic, fast [19, 21]; divisive gain control [28] | Subtractive somatic jump and/or divisive shunt trace | DEMO (formula) |
| SST inhibition | Dendrite-targeting [21] | Negative input to apical compartment | DEMO (formula) |
| VIP disinhibition | VIP → SST → pyramidal [19, 20] | VIP inhibits SST; driven by "top-down attention" | DEMO (formula) |
| Plasticity | STDP [25, 26, 27]; three-factor rules [10] | Optional pair-based STDP; JEV novelty Noul as a simplified gain modulation inspired by three-factor rules [10], without eligibility traces | DEMO (third factor is PROPOSAL) |
| JEV control | — | `circuit_evidence` score biases the L23E `output` logit, β ∈ [−0.5, 0.5]; novelty Noul as STDP gain | PROPOSAL |

[DEMO] In real axons an action potential normally reaches all collaterals; transmission failures occur per synapse and independently [34, 35], and branch-point conduction failures are the exception [36]. Mutually exclusive collateral selection (hard routing) is the owner's proposal, not a biological claim; soft routing is closer to independent probabilistic release.

### 1.5 Original-vs-established statement (FR-SCI-07, MUST appear verbatim in the About drawer)

> Spiking neurons, leaky graded potentials, dendritic computation, interneuron motifs and STDP are established neuroscience. What is original here is the owner's proposal to express a neuron's functions with JEV's three typed decision primitives — Score for the graded potential, Noul for the probability of a spike within a short window and Choice for collateral routing — and to use the JEV model as a semantic control layer over a fast spiking loop. This page is a didactic toy: the numbers are chosen for clarity, not fitted to data.

---

## 2. Model specification

All quantities are in ms, mV (relative to resting potential), Hz, or dimensionless. `dt = 0.5 ms` (FR-SIM-01, fixed, not user-adjustable). Step index `n`; sim time `t = n · dt`.

### 2.1 Populations and counts (FR-NET-01)

Total LIF neurons **N = 58**, plus 256 input sources (not neurons).

| Index range | ID prefix | Population | Count | Compartments | Notes |
|---|---|---|---|---|---|
| — | `PX` | Input pixels (thalamic/LGN relay, rate-coded) | 256 | none | 16×16 Poisson sources |
| 0–15 | `L4E` | L4 excitatory (spiny-stellate-like) | 16 | soma, basal, apical | 4 orientation groups × 4 spatial offsets; apical receives no input; apical compartment kept for code uniformity, spiny stellate cells lack an apical tuft [DEMO] (tooltip hides Da for L4E) |
| 16–19 | `L4PV` | L4 PV interneurons | 4 | soma | feedforward + feedback inhibition |
| 20–35 | `L23E` | L2/3 excitatory pyramidal | 16 | soma, basal, apical | 4 orientation groups × 4 |
| 36–39 | `L23PV` | L2/3 PV | 4 | soma | |
| 40–43 | `L23SST` | L2/3 SST | 4 | soma | |
| 44–45 | `L23VIP` | L2/3 VIP | 2 | soma | |
| 46–53 | `L5E` | L5 excitatory pyramidal (output) | 8 | soma, basal, apical | 4 orientation groups × 2 |
| 54–55 | `L5PV` | L5 PV | 2 | soma | |
| 56–57 | `L5SST` | L5 SST | 2 | soma | |

Neuron DOM/test ID: `<prefix>-<k>` where `k` is the index within the population (for example `L23E-5`, `L5SST-1`).

Orientation groups, index `o ∈ {0, 1, 2, 3}` = `vertical`, `horizontal`, `diag45`, `diag135`. For `L4E` and `L23E`, neuron `k` has `o = floor(k / 4)` and offset index `j = k mod 4`. For `L5E`, `o = floor(k / 2)`.

**Scaling statement (FR-SCI-08):** Population sizes are scaled down from Potjans & Diesmann [14] by roughly 1:270 to 1:1370 per population (overall ≈ 1:1030 for the three modelled layers). Arithmetic (source count / demo count): L4E 21 915 / 16 ≈ 1370; L4I 5 479 / 4 ≈ 1370; L2/3E 20 683 / 16 ≈ 1290; L2/3I 5 834 / 10 ≈ 580; L5E 4 850 / 8 ≈ 610; L5I 1 065 / 4 ≈ 270; layers 2/3 + 4 + 5 total 59 826 / 58 ≈ 1030. The L4 E:I ratio (16:4 = 4:1) matches the source (21 915 : 5 479 ≈ 4:1). The L2/3 (16:10 vs ≈ 3.5:1 in the source) and L5 (8:4 = 2:1 vs 4 850 : 1 065 ≈ 4.6:1) inhibitory populations are deliberately inflated so every interneuron class is visible [DEMO]; Potjans & Diesmann do not subdivide interneurons. Connection probabilities in Section 2.6 preserve the *ordering of dominant pathways* of the canonical circuit (L4 → L2/3 → L5, local E ↔ PV loops), not the absolute values, because with tens of neurons the source probabilities would leave most neurons without inputs. Synaptic weights are larger than biological PSPs (0.15 mV mean in [14]) for the same reason [DEMO].

### 2.2 State variables (FR-SIM-02)

Per neuron `i` (all `Float32Array` or `Int32Array` of length N unless noted):

| Var | Meaning | Unit | Init |
|---|---|---|---|
| `S[i]` | Somatic Score (membrane potential rel. rest) | mV | 0 |
| `Db[i]` | Basal dendrite Score (E cells only; 0 for interneurons) | mV | 0 |
| `Da[i]` | Apical dendrite Score (E cells only) | mV | 0 |
| `G[i]` | Divisive (shunting) PV trace | dimensionless | 0 |
| `ref[i]` | Remaining refractory steps | steps | 0 |
| `noul[i]` | Last computed Noul | [0,1] | 0 |
| `lastSpikeStep[i]` | Step index of last spike | steps | −1 |
| `xPre[i]`, `yPost[i]` | STDP traces | dimensionless | 0 |

Delay ring buffer: `L_ring = 4` slots (covers max delay 3 steps + current). Each slot holds `inBasal[N]`, `inApical[N]`, `inSoma[N]`, `inShunt[N]`.

### 2.3 Parameters and defaults (FR-SIM-03)

`params.js` MUST export a frozen `DEFAULTS` object and a `PARAM_SPECS` table containing exactly these entries (UI-adjustable ones have a slider; see Section 4).

| Key | Symbol | Default | Range (UI) | Unit | Source / tag |
|---|---|---|---|---|---|
| `tauM` | τ_m | 10 | 1–50 | ms | Potjans & Diesmann Table 5 [14] |
| `tauBasal` | τ_b | 10 | fixed | ms | DEMO (heterogeneous branch τ motivated by [2]) |
| `tauApical` | τ_a | 30 | fixed | ms | DEMO (motivated by [2]) |
| `tRef` | t_ref | 2 | fixed | ms | [14, 17] |
| `theta` | θ | 15 | 5–40 | mV rel. rest | [14]: −50 − (−65) = 15 mV |
| `vReset` | V_reset | 0 | fixed | mV rel. rest | [14] V_reset −65 mV; E_L −65 mV assumed (R2: not confirmed in HTML) |
| `delta` | Δ | 2 | 0.5–10 | mV | DEMO (escape-noise slope; sigmoid form is a simplification of [16, 18]) |
| `noulWindowMs` | W | 10 | fixed | ms | DEMO (Noul = probability of ≥ 1 spike within W) |
| `sigmaV` | σ_V | 3 | 0–10 | mV | DEMO (stationary membrane noise SD) |
| `g` | g | 4 | 0–8 | ratio | DEMO (named after g in [14], where inhibitory PSPs are 4× excitatory; here g/4 scales hand-chosen inhibitory base weights) |
| `dExc` | d_E | 1.5 | fixed | ms (→ 3 steps) | [14] |
| `dInh` | d_I | 0.8 | fixed | ms (→ 2 steps, rounded up) | [14] |
| `dInput` | d_in | 1.0 | fixed | ms (→ 2 steps) | DEMO |
| `aBasal` | a_b | 1.0 | fixed | — | DEMO |
| `aApical` | a_a | 0.5 | fixed | — | DEMO |
| `caAmp` | A_ca | 10 | fixed | mV | DEMO (dendritic Ca²⁺ nonlinearity motivated by [29, 30]) |
| `caTheta` | θ_ca | 10 | fixed | mV | DEMO |
| `caDelta` | Δ_ca | 1.5 | fixed | mV | DEMO |
| `tauShunt` | τ_G | 5 | fixed | ms | DEMO |
| `pvMode` | — | `"subtractive"` | `subtractive` \| `divisive` \| `both` | — | DEMO (divisive motivated by [28]) |
| `tauC` | τ_c | 1.0 | 0.05–5 | — | DEMO (routing temperature) |
| `routing` | — | `"hard"` | `hard` \| `soft` | — | DEMO |
| `attention` | A | 0.3 | 0–1 | — | DEMO (top-down drive to VIP and apical dendrites) |
| `rTopDownMax` | r_td | 40 | fixed | Hz | DEMO |
| `stdp` | — | `false` | on/off | — | DEMO |
| `tauPlus`, `tauMinus` | τ₊, τ₋ | 20, 20 | fixed | ms | [25, 26] (window ≈ ±20 ms [25]; exponential τ values from [26]) |
| `aPlus`, `aMinus` | A₊, A₋ | 0.01, 0.0105 | fixed | × w_max | DEMO, ratio from [26], form from [27] |
| `contrast` | c | 1.0 | 0–2 | — | DEMO |
| `pixelNoise` | σ_px | 0.05 | 0–0.5 | intensity | DEMO |
| `rBase` | r_base | 2 | fixed | Hz | DEMO |
| `rMax` | r_max | 80 | 10–200 | Hz | DEMO |
| `wIn` | W_in | 90 | fixed (calibrated) | mV (kernel-normalised) | DEMO |
| `wFfPv` | w_ffPV | 0.4 | fixed (calibrated) | mV per pixel spike | DEMO |
| `jevControl` | — | `true` | on/off | — | DEMO |
| `autoJev` | — | `true` | on/off | — | DEMO |
| `jevIntervalMs` | — | 500 | 100–5000 | sim ms | DEMO |
| `liveMinIntervalMs` | — | 2000 | 1000–10000 | wall ms | DEMO |
| `budget` | — | 50 | 0–500 | LIVE calls / session | DEMO |
| `speed` | — | 100 | {10, 25, 50, 100, 250, 500, 1000} | sim ms per wall s | DEMO |
| `seed` | — | 42 | 0–4294967295 | uint32 | DEMO |

Slider steps (`PARAM_SPECS[k].step`): tauM 1, theta 0.5, delta 0.1, sigmaV 0.5, g 0.1, tauC 0.05, attention 0.05, jevIntervalMs 100, liveMinIntervalMs 500, contrast 0.05, pixelNoise 0.01, rMax 10, budget 1.

Derived: `λ_m = exp(−dt/τ_m)`, `λ_b = exp(−dt/τ_b)`, `λ_a = exp(−dt/τ_a)`, `λ_G = exp(−dt/τ_G)`, `λ₊ = exp(−dt/τ₊)`, `λ₋ = exp(−dt/τ₋)`, `refSteps = round(t_ref/dt) = 4`, delay steps `ceil(d/dt)`, `noulExp = dt / noulWindowMs = 0.05`.

FR-SIM-04: `setParams(partial)` MUST clamp every value into its range, recompute derived constants, and never reset state (except `seed`, which requires reset). Fixed keys are ignored unless the sim was created with `{test: true}` (test harness, Section 5.2).

### 2.4 Update equations per step (FR-SIM-05)

Order within one step `n` is normative (determinism depends on it):

1. **Input sources.** For each pixel `p` (row-major, `p = y·16 + x`): draw `u = rngInput()`; pixel spikes if `u < r_p · dt/1000`. Each pixel spike adds `W_in · K[i][p]` to `inBasal[i]` of every `L4E` neuron `i`, and `wFfPv = 0.4` mV to `inSoma` of every `L4PV`, in ring slot `(n + 2) mod 4`.
2. **Top-down sources.** For each `L23E`, `L5E` and `L23VIP` neuron (ascending index), draw `u = rngTopDown()`; event if `u < A · r_td · dt/1000`. Event adds 3 mV to `inApical` (E cells) or 6 mV to `inSoma` (VIP) in slot `(n + 2) mod 4`.
3. **Read slot** `s = n mod 4` into `Ib, Ia, Is, Ish`.
4. **Neuron update** for `i = 0 … N−1`:
   - Dendrites (E cells): `Db[i] ← λ_b·Db[i] + Ib[i]`; `Da[i] ← λ_a·Da[i] + Ia[i]`.
   - Apical nonlinearity: `φ(Da) = Da + A_ca · σ((Da − θ_ca)/Δ_ca)`.
   - Shunt: `G[i] ← λ_G·G[i] + Ish[i]` (only nonzero if `pvMode` ≠ `subtractive`).
   - Noise: `ξ = σ_V · sqrt(1 − λ_m²) · z`, `z = gauss(rngNoise)` (always drawn, one per neuron per step; exact stationary SD σ_V).
   - If `ref[i] > 0`: `ref[i] ← ref[i] − 1`; `S[i] ← V_reset`; `noul[i] ← 0`.
   - Else, E cells: `S[i] ← λ_m·S[i] + (1 − λ_m)·(a_b·Db[i] + a_a·φ(Da[i])) / (1 + G[i]) + Is[i] + ξ`.
   - Else, interneurons: `S[i] ← λ_m·S[i] + Is[i] + ξ`.
   - Stability clamp: `S, Db, Da ∈ [−20, 40]`, `G ∈ [0, 20]` (FR-SIM-09).
   - NaN guard: if any of `S, Db, Da, G` is not finite → set to 0, increment `nanResets` (FR-SIM-11).
   - Noul: `noul[i] ← σ((S[i] − θ)/Δ)` when not refractory, where `σ(x) = 1/(1+exp(−x))` computed stably (`x < −30 → 0`, `x > 30 → 1`).
5. **Spike sampling** for `i = 0 … N−1`: draw `u = rngSpike()` (always, one per neuron). Per-step hazard `p_step = 1 − (1 − noul[i])^(dt/W)` with `W = noulWindowMs = 10 ms` (so `p_step = 1` when `noul = 1`, and constant Noul gives probability Noul of ≥ 1 spike in 10 ms, ignoring refractoriness). Spike if `ref[i] == 0` (after step 4) and `u < p_step`.
6. **Spike handling** for spiking neurons in ascending index order:
   - `S[i] ← V_reset`; `ref[i] ← refSteps`; `lastSpikeStep[i] ← n`; record `(n, i)` in the spike log.
   - Deliver **trunk** synapses (always).
   - E cells: compute Choice (Section 2.5), draw `u = rngRoute()` (always one draw per spiking E cell, in both routing modes), deliver collateral synapses.
   - Interneurons: deliver all outgoing synapses (no Choice).
   - Delivery of synapse `(j, compartment, w, dSteps)`: add `w` to the compartment array of target `j` in slot `(n + dSteps) mod 4`. For PV → E synapses: if `pvMode ∈ {subtractive, both}` add `w_eff` to `inSoma`; if `pvMode ∈ {divisive, both}` add `0.3 · g/4` to `inShunt`.
7. **STDP** (only if `stdp` on; Section 2.8, normative order there).
8. **Clear slot** `s`; `n ← n + 1`.

### 2.5 Choice routing (FR-SIM-06)

Each E neuron `i` has collaterals `k = 0 … K_i − 1` with bias `b_k` and apical gain `γ_k`:

```
a_k = b_k + γ_k · (Da[i] / θ) + β_k
p_k = exp((a_k − max_j a_j)/τ_c) / Σ_j exp((a_j − max_j a_j)/τ_c)
```

`β_k` is the JEV control bias (Section 3.4.3), 0 unless set.

| Population | k | Collateral ID | Targets (compartment, w mV, p_conn, delay) | b_k | γ_k |
|---|---|---|---|---|---|
| L4E (group o) | 0 | `ascending` | L23E group o (basal, 12, 1.0, d_E) | 0.5 | 0 |
| L4E | 1 | `recurrent` | other L4E of the same group o, excluding self (basal, 4, 0.5, d_E) | 0 | 0 |
| L23E (group o) | 0 | `output` | L5E group o (basal, 12, 1.0, d_E) | 0 | 4 |
| L23E | 1 | `recurrent` | other L23E of the same group o, excluding self (basal, 4, 0.5, d_E) | 0.3 | 0 |
| L23E | 2 | `lateral` | all L23SST (soma, 6, 1.0, d_E) | −0.3 | 0 |
| L5E (group o) | 0 | `output` | none (spikes routed here are the readout's output spikes, FR-RO-01) | 0.5 | 1 |
| L5E | 1 | `recurrent` | the other L5E of the same group o, excluding self (basal, 4, 1.0, d_E) | 0 | 0 |

- `recurrent` candidates are the other 3 (L4E, L23E) or 1 (L5E) neurons of the SAME orientation group. A collateral that ends up with no targets (possible with p_conn 0.5) stays in the softmax; a spike routed to it delivers nothing (still logged and counted in Choice statistics).
- **Hard routing:** choose `k` with `u` (from step 6) by inverse CDF over `p_k` (first `k` with cumulative `≥ u`; last `k` if rounding leaves a gap). Deliver collateral `k` at full weight.
- **Soft routing:** deliver every collateral `k` with weights multiplied by `p_k`. Expected input per target equals hard routing (FR-SIM-07; unit test U-12).
- Choice statistics: per E neuron, ring buffer of the inverse-CDF pick `k` of the always-drawn `u` over the last 1000 ms, in both routing modes (in soft mode the pick is used only for statistics), for the Choice bars.

### 2.6 Connectivity (FR-NET-02)

Build order with `rngTopo` (normative): (1) collateral synapses of Section 2.5: sources ascending, then collaterals `k` ascending, then candidate targets ascending; (2) the non-collateral connections below (trunk and interneuron outputs), rows in table order, within a row sources ascending then targets ascending. Exactly one `rngTopo()` draw per candidate (source, target) pair with `p_conn < 1`; connect if `u < p_conn`. Pairs with `p_conn = 1` consume no draw. No self-connections (self is never a candidate and consumes no draw).

| Source → Target | Compartment | w (mV) | p_conn | Delay |
|---|---|---|---|---|
| PX → L4E | basal | `W_in · K[i][p]` | all | d_in |
| PX → L4PV | soma | 0.4 | all | d_in |
| L4E → L4PV (trunk) | soma | 4 | 0.5 | d_E |
| L4PV → L4E | soma | −3 · g/4 | 0.75 | d_I |
| L23E → L23PV (trunk) | soma | 4 | 0.5 | d_E |
| L23PV → L23E | soma | −3 · g/4 | 0.75 | d_I |
| L23SST → L23E | apical | −4 · g/4 | 0.75 | d_I |
| L23SST → L23PV | soma | −2 · g/4 | 0.5 | d_I |
| L23VIP → L23SST | soma | −6 · g/4 | 1.0 | d_I |
| L23E → L23VIP (trunk) | soma | 1 | 0.3 | d_E |
| L5E → L5PV (trunk) | soma | 4 | 1.0 | d_E |
| L5E → L5SST (trunk) | soma | 3 | 1.0 | d_E |
| L5PV → L5E | soma | −3 · g/4 | 0.75 | d_I |
| L5SST → L5E | apical | −4 · g/4 | 0.75 | d_I |
| Top-down → L23E, L5E | apical | 3 | Poisson | d_in |
| Top-down → L23VIP | soma | 6 | Poisson | d_in |

FR-NET-03: `g` changes MUST rescale inhibitory weights live (weights store the base value; effective = base · g/4).

### 2.7 Input encoding (FR-ENC-01 … 05)

**FR-ENC-01 Stimulus grid:** 16×16 `Float32Array`, values in [0, 1], `x` right, `y` down, index `y·16 + x`.

**FR-ENC-02 Presets** (exact definitions; pixels not listed are 0):

| ID | Label | Definition |
|---|---|---|
| `blank` | Blank | all 0 |
| `white` | All white | all 1 |
| `vbar` | Vertical bar | `x ∈ {7, 8}`, `2 ≤ y ≤ 13` |
| `hbar` | Horizontal bar | `y ∈ {7, 8}`, `2 ≤ x ≤ 13` |
| `diag45` | Diagonal ／ | `x + y ∈ {14, 15}`, `2 ≤ x ≤ 13` |
| `diag135` | Diagonal ＼ | `x − y ∈ {0, 1}`, `2 ≤ x ≤ 13` |
| `checker` | Checkerboard | `(floor(x/4) + floor(y/4)) mod 2 == 0` |
| `digit1` | Glyph "1" | `x ∈ {8, 9}, 2 ≤ y ≤ 13`; `y = 13, 6 ≤ x ≤ 11`; pixels (7,3), (6,4) |
| `digit7` | Glyph "7" | `y ∈ {2, 3}, 3 ≤ x ≤ 12`; for `4 ≤ y ≤ 13`: `x0 = round(12 − 0.6·(y − 3))`, pixels `x0` and `x0 + 1` |
| `digit0` | Glyph "0" | `0.55 ≤ ((x − 7.5)/4.5)² + ((y − 7.5)/6)² ≤ 1.0` |
| `noise` | Noise | each pixel 1 with probability 0.5 using a fresh `mulberry32(streamSeed(seed, "noisePreset"))`, regenerated identically on every call (never consumes sim streams) |
| `custom` | Drawn | from the draw canvas (FR-UI-14) |

**FR-ENC-03 Contrast and pixel noise:** effective intensity `x'_p = clamp(0.5 + c·(x_p − 0.5) + σ_px·z_p, 0, 1)`, where `z_p` are 256 `gauss(rngStim)` draws (pixel order) taken at every step with `n mod 100 == 0` (every 50 ms sim), always, even when `σ_px = 0` (at `c = 1`, `σ_px = 0` the image is unchanged). Changes of `c`, `σ_px` or the stimulus recompute `x'` with the current `z` (no redraw). `rngStim` is used for nothing else; UI code (thumbnails, previews) MUST NOT draw from any sim stream.

**FR-ENC-04 Rates:** `r_p = r_base + (r_max − r_base) · x'_p` (Hz). Spikes are Bernoulli per step with probability `r_p · dt/1000` (Poisson approximation; ≤ 0.1 at `r_max = 200`).

**FR-ENC-05 Orientation kernels** for each `L4E` neuron `i` with orientation `o` and offset `d_j ∈ {−3, −1, +1, +3}` px:
- Along-unit vector `e_o`: vertical `(0, 1)`, horizontal `(1, 0)`, diag45 `(1, −1)/√2`, diag135 `(1, 1)/√2`. Perpendicular `n_o = (−e_y, e_x)`.
- For pixel centre `q = (x, y) − (7.5, 7.5)`: `u = q·n_o − d_j`, `v = q·e_o`.
- Raw: `K̃ = exp(−v²/(2·6²)) · [exp(−u²/(2·1.2²)) − 0.5·exp(−u²/(2·3²))]`.
- Normalise: scale positive entries so they sum to +1 and negative entries so they sum to −1 (zero-mean kernel). Store as `Float32Array(256)` per neuron.
- Rationale [DEMO]: an elongated centre with antagonistic flanks gives orientation selectivity [24] and zero response to uniform images (a functional stand-in for centre–surround filtering [22, 23], which is not modelled separately).

### 2.8 STDP (FR-SIM-08, optional, default off)

Applies only to excitatory collateral synapses (`ascending`, `recurrent`, `output` targets in Section 2.5). Pair-based, all-to-all traces [27]. Step 7 order (normative):
- (a) Decay all traces: `xPre ← λ₊·xPre`, `yPost ← λ₋·yPost` for all neurons.
- (b) For each neuron that spiked in step 6, in ascending post index `j`: LTP on its incoming plastic synapses `i → j` in ascending pre index `i`: `w ← w + M · A₊ · w_max · xPre[i]`. Then, for each neuron that spiked, in ascending pre index `i`: LTD on its outgoing plastic synapses `i → j` (all collaterals, regardless of routing) in ascending post index `j`: `w ← w − M · A₋ · w_max · yPost[j]`. Traces used are the values after (a) and before (c).
- (c) Increment traces of all spikers: `xPre[i] ← xPre[i] + 1`, `yPost[i] ← yPost[i] + 1`.
- Bounds: `w ∈ [0, w_max]` (clamped after each update), `w_max = 2 · w0` (initial weight).
- Third factor `M` = 1 by default; when `jevControl` is on and a valid novelty Noul `ν` exists, `M = 0.5 + ν` ∈ [0.5, 1.5] [PROPOSAL; a simplified gain modulation inspired by three-factor rules [10], without eligibility traces].
- Reset restores all weights to `w0`.

### 2.9 Readout (FR-RO-01 … 03)

- **FR-RO-01 Local readout:** over the last `W_r = 200` ms sim time, count output spikes of each L5E orientation group (2 neurons): an L5E spike counts 1 if routed to `output` (hard routing) or `p_output` (soft routing; fractional counts). Let `c_o` be counts, `c_max` the largest, `c_2` the second largest.
  - If `Σ c_o < 4` → label `nothing`.
  - Else if `c_max ≥ 1.5 · c_2` and `c_max ≥ 4` → label = orientation of `c_max` (ties broken by lower `o`).
  - Else → label `uncertain`.
  - Display probabilities `c_o / Σ c_o` as bars (0 when sum is 0).
- **FR-RO-02 JEV readout:** the latest validated `circuit_orientation` Choice answer (Section 3.4) with its confidence and mode tag.
- **FR-RO-03 Agreement indicator:** shows `agree` when local label equals JEV choice (`nothing`/`uncertain` count as agreeing with `none`), otherwise `disagree`.

### 2.10 Stability guards (FR-SIM-09 … 12)

- **FR-SIM-09 Clamp:** Section 2.4 step 4.
- **FR-SIM-10 Soft-max stability:** subtract the maximum logit before `exp`; `τ_c` clamped to ≥ 0.05.
- **FR-SIM-11 NaN guard:** non-finite values reset to 0, counter `nanResets` increments, banner `warn` "Numerical issue corrected" shown at most once per run.
- **FR-SIM-12 Runaway detection:** every 50 ms sim time compute mean rate of all E neurons. If > 150 Hz for 3 consecutive windows → `dampGain ← max(0.4, dampGain · 0.8)`, applied as a multiplier to all excitatory collateral weights; show `runaway-warning` ("Runaway activity — excitation auto-damped to NN%"). Every 500 ms with mean E rate < 50 Hz, `dampGain ← min(1.0, dampGain + 0.05)`; warning hides when `dampGain = 1.0`. Reset sets `dampGain = 1.0`.

### 2.11 Calibration acceptance (FR-SIM-13)

Default weights above are design estimates. Task T05 MUST verify, with defaults, seed 42, `autoJev` off, measured over sim time 200–1200 ms:

| Check | Target |
|---|---|
| `vbar`: L4E vertical group mean rate | 15–80 Hz |
| `vbar`: each other L4E orientation group mean rate | ≤ 0.5 × vertical group |
| `blank`: every E population mean rate | ≤ 5 Hz |
| `white`: L4E mean rate | ≤ 10 Hz |
| Local readout correct by 500 ms for `vbar`, `hbar`, `diag45`, `diag135` | ≥ 9 of seeds 1–10 each |
| No runaway warning with defaults on any preset | 0 warnings, seeds 1–10 |

If a target fails, the implementer MAY tune only `wIn`, the `ascending` weight, the `output` weight, `wFfPv` and the four inhibitory base weights, each within ×0.25–×4 of the default, and MUST record final values in `params.js` and in Appendix A of this spec (changelog row with date and reason). If targets still fail: also allow `σ_V`, `rBase` and collateral biases `b_k` ±0.5; if still failing, relax each failing target by at most 2×, record it in Appendix A and as a new open question in Section 10, and continue (do not stall).

---

## 3. JEV integration

### 3.1 Real API facts (from R3, verbatim; FR-JEV-01)

- Endpoint: `POST https://api.typesafe.ai/v1/systemone`
- Headers: `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`.
- Body: `{ "state": <string|object|array>, "model": "jev-latest", "questions": { <key>: <question> } }`. Question keys are not sent to the model; answers come back under the same keys.
- Question types:
  - `noul`: `type`, `instructions` required; `criteria` optional `{true: ..., false: ...}`.
  - `choice`: `criteria` = map option → description (or null), **max 255 options**.
  - `score`: `criteria` = **ordered array, 2–10 levels**. A dict → HTTP 422.
- Limits: body ≤ 32 MiB; UTF-8 JSON without BOM; nesting ≤ 64; finite numbers only. Max questions per request: undocumented.
- Models: `jev-latest` → `jev-1.13.0` (observed); `jev-1.14.0` and `jev-preview` available. Response `model` reports the concrete version.
- Latency: ~0.26–0.29 s warm (probes from one machine).
- Price: ≈ $42 per 1 B input tokens; output free. A 3-question request ≈ 428 input tokens ≈ $0.00002.
- Rate limits: per organisation (tokens/s, requests/s); numbers only in the console. `Retry-After` / `retry-after-ms` are exposed headers but undocumented.

Request example (R3):

```json
{
  "state": "<string | object | array>",
  "model": "jev-latest",
  "questions": {
    "<your_key>": {"type":"noul","instructions":"..."},
    "<your_key>": {"type":"choice","instructions":"...","criteria":{"opt":"desc"}},
    "<your_key>": {"type":"score","instructions":"...","criteria":["level0","level1","level2"]}
  }
}
```

Response example (real, R3):

```json
{"model":"jev-1.13.0","answers":{"n1":{"type":"noul","noul":0.99},"c1":{"type":"choice","choice":"technical","confidence":1.0,"probabilities":{"billing":0.0,"technical":1.0,"sales":0.0}},"s1":{"type":"score","score":0.66,"confidence":0.49,"legend":{"0":"Calm, just stating facts","1":"Frustrated but civil","2":"Very angry, strong language"},"probabilities":{"0":0.34,"1":0.66,"2":0.0}}},"usage":{"input_tokens":428,"output_tokens":71}}
```

Error bodies (verbatim, R3):

| Status | Meaning | Body |
|---|---|---|
| 400 | rule violation | `{"detail":{"error_type":"api_usage_error","message":"Invalid request."}}` |
| 401 | bad key | `{"detail":{"error_type":"authentication_error","message":"Cannot authenticate with the server. Please check your API key and try again."}}` |
| 403 | no Authorization header | `{"detail":{"error_type":"authentication_error","message":"Must supply an API key! Check your request and try again."}}` |
| 413 | body > 32 MiB | (docs only) |
| 415 | bad Content-Encoding | (docs only) |
| 422 | validation | `{"detail":[{"type":"list_type","loc":["body","questions","q","score","criteria"],"msg":"Input should be a valid list","input":{"a":"b","c":"d"}}]}` |
| 429 | rate limit | back off and retry |
| 529 | overloaded | retry with backoff |

### 3.2 Modes (FR-JEV-02 … 06)

| Mode | Badge text | Backend | Key needed | Default availability |
|---|---|---|---|---|
| `SIMULATED` | `SIMULATED JEV` | `emulator.js` (local, deterministic) | No | Always |
| `REPLAY` | `REPLAY JEV` | `replay.js` over `data/jev-recording.json`, emulator fallback | No | When the recording loads and validates |
| `LIVE` | `LIVE JEV` | same-origin `POST api/jev` → proxy → JEV (or canned answers with `--mock-upstream`) | Env key on proxy, browser-pasted key, or none with `--mock-upstream` | When `GET api/health` succeeds and validates |

- FR-JEV-02: Default mode on load is `SIMULATED`. URL `?mode=replay|live` requests another mode; if unavailable, stay in `SIMULATED` and show an info banner.
- FR-JEV-03: The mode badge (`mode-badge`) MUST always be visible and show the active mode; in REPLAY it appends ` · N unrecorded` when N > 0.
- FR-JEV-04: Public visitors with no key and no proxy MUST get the full experience (simulation, dashboard, JEV readout, JEV log) in SIMULATED mode.
- FR-JEV-05: Health detection runs once on load and again on each attempt to select LIVE: `fetch('api/health', {cache:'no-store'})` with a 1500 ms timeout. A 404 or any failure is handled silently (no thrown error, no `console.error`; the browser's own network line is filtered in tests, FR-TST-07). LIVE is available only if the response is HTTP 200, `Content-Type` contains `application/json`, and the body validates as `{ok: true, keySource: "env"|"none"|"mock", model: string, budget: {used: int, cap: int}, mock: boolean, recording: boolean}`. Otherwise the LIVE selector is disabled with tooltip: `LIVE needs the local proxy: run "node tools/jev-proxy.mjs" and open http://127.0.0.1:8787`. A health result is applied only if the selection token at resolve time equals the token at request time (a late success after the user switched away is ignored).
- FR-JEV-06: REPLAY availability: `fetch('data/jev-recording.json')` validates against Section 3.6 and has ≥ 1 entry; otherwise the REPLAY selector is disabled with tooltip `No JEV recording is bundled with this build`. Until T17 ships a real recording, T07 commits a placeholder `docs/data/jev-recording.json` = `{"format":"jev-recording","version":1,"entries":[]}` so the fetch never 404s.

### 3.3 Call policy (FR-JEV-07 … 14)

- FR-JEV-07: JEV is NEVER called per neuron per step. The local loop (Section 2) computes Score, Noul and Choice for every neuron every step.
- FR-JEV-08 Triggers (implemented in the DOM-free scheduler `docs/js/core/scheduler.js`, Section 5.2; all times are SIM time, never wall time):
  1. **Auto tick** (when `autoJev` on): evaluated by `scheduler.afterStep(n)` after step `n` completes, when `(n + 1) · dt` is a multiple of `jevIntervalMs` (default 500 ms). The grid is fixed from t = 0 and never shifted.
  2. **Stimulus change** at sim time `t_c`: one tick at `t_c + 50 ms` sim. Changes within 300 ms SIM time of the previous change are debounced (the pending change tick moves to the latest change + 50 ms). The change tick replaces the next grid tick only if that grid tick is < 300 ms sim after the change tick.
  3. **Ask JEV** button (`btn-ask-jev`): one neuron request for the selected neuron.
  - `windowMs` in the circuit summary = sim time since the previous circuit tick (or since reset), ≤ `jevIntervalMs` for grid ticks.
  - `callIndex` = per-run counter of emulator calls (circuit and neuron, all modes that call the emulator, including fallback and `unrecorded`), starting at 0, reset to 0 on Reset and seed change. It is passed to `emulate()` as `ctx.callIndex` and then incremented.
- FR-JEV-09 Timing by mode:
  - SIMULATED and REPLAY: answered synchronously; the answer is applied at the start of the next step. Wall-clock gating does not apply. This keeps runs deterministic (FR-DET-02). The log shows a simulated latency: SIMULATED = 270 ms; REPLAY = the recorded `latencyMs`.
  - LIVE: asynchronous. A tick is sent only if (a) no request is in flight (max in-flight = 1), (b) at least `liveMinIntervalMs` wall time (default 2000) has passed since the last LIVE request, and (c) budget remains. Otherwise the tick is skipped (not queued) and the skip counter increments. The answer is applied at the step after it arrives.
- FR-JEV-10 Batching: each circuit tick sends exactly 3 questions in one request; each neuron request sends exactly 3 questions in one request. The client MUST NOT send more than 8 questions per request.
- FR-JEV-11 Timeout: client aborts after 6000 ms (`AbortController`); the proxy aborts upstream after 5000 ms.
- FR-JEV-12 Retries (LIVE only): classification uses the proxy JSON `error.code` (table in Section 3.7), never the HTTP status alone. Retry ONLY on `upstream_rate_limited`, `upstream_overloaded` and `network`: up to 2 retries with delays 1000 ms and 2000 ms; if `Retry-After` (seconds) or `retry-after-ms` is present and ≤ 10 s, use `max(delay, Retry-After)`; if it is > 10 s → no retry, fall back immediately. NEVER retry `budget_exhausted`, `bad_request`, `unauthorized`, `timeout` (timeout → no retry, tick fallback) or any other code. The budget is checked before every attempt including retries; each attempt counts against the budget. While retrying, the request still counts as in flight.
- FR-JEV-13 Budget: session cap `budget` (default 50) counts LIVE attempts only. The LIVE selector is disabled while `used ≥ cap`. Counter `jev-budget` shows `LIVE calls: used / cap` in all modes. When `used == cap`: switch to SIMULATED, turn `autoJev` off, show banner `warn` "JEV budget reached (cap/cap). Continuing in SIMULATED mode." The cap can be raised in the params panel (takes effect immediately; does not reset `used`). Reload resets `used`.
- FR-JEV-14 Fallback: when a LIVE tick fails after retries, that tick is answered by the emulator, logged with status `fallback:<code>`, and applied. After 3 consecutive failed LIVE ticks, the mode switches to SIMULATED with an error banner naming the last error.

### 3.4 What is sent (FR-JEV-15 … 18)

FR-JEV-15: `state` objects contain only numbers rounded to 1 decimal place, booleans and fixed enum strings produced by the app. No user-typed text ever enters `state`. Keys are stable and ordered as listed.

#### 3.4.1 Circuit tick

```json
{
  "state": {
    "kind": "circuit_summary",
    "description": "Rates of a 58-neuron model visual cortex column over the last window.",
    "simTimeMs": 1500.0,
    "windowMs": 500.0,
    "stimulus": "vbar",
    "l4_rates_hz": {"vertical": 34.5, "horizontal": 2.1, "diag45": 6.0, "diag135": 5.2},
    "l23_rates_hz": {"vertical": 28.0, "horizontal": 1.2, "diag45": 3.9, "diag135": 3.1},
    "l5_rates_hz": {"vertical": 19.5, "horizontal": 0.0, "diag45": 2.5, "diag135": 0.0},
    "inhibitory_rates_hz": {"pv": 22.1, "sst": 9.8, "vip": 7.5},
    "prev_l4_rates_hz": {"vertical": 1.0, "horizontal": 0.8, "diag45": 1.1, "diag135": 0.9},
    "local_readout": "vertical"
  },
  "model": "jev-latest",
  "questions": {
    "circuit_orientation": {
      "type": "choice",
      "instructions": "These are firing rates of orientation-tuned neuron groups in a small model of visual cortex. Which edge orientation does the stimulus most likely contain?",
      "criteria": {
        "vertical": "Vertical edges or bars dominate",
        "horizontal": "Horizontal edges or bars dominate",
        "diag45": "Diagonal edges from bottom-left to top-right dominate",
        "diag135": "Diagonal edges from top-left to bottom-right dominate",
        "none": "No clear oriented structure (blank, uniform, or noise)"
      }
    },
    "circuit_novelty": {
      "type": "noul",
      "instructions": "Is the layer-4 activity in this window substantially different from the previous window, suggesting a new stimulus?"
    },
    "circuit_evidence": {
      "type": "score",
      "instructions": "How strong is the evidence for a single dominant orientation?",
      "criteria": ["No evidence", "Weak", "Moderate", "Strong", "Unambiguous"]
    }
  }
}
```

`stimulus` is one of the preset IDs in FR-ENC-02 (`custom` for drawings). `local_readout` is one of `vertical | horizontal | diag45 | diag135 | nothing | uncertain`.

#### 3.4.2 Neuron request (Ask JEV)

```json
{
  "state": {
    "kind": "neuron_summary",
    "simTimeMs": 1234.5,
    "neuron": "L23E-5",
    "population": "L2/3 excitatory pyramidal",
    "preferred_orientation": "horizontal",
    "soma_mv": 12.3,
    "threshold_mv": 15.0,
    "basal_mv": 14.1,
    "apical_mv": 2.4,
    "refractory": false,
    "ms_since_last_spike": 14.5,
    "rate_hz_last_200ms": 22.0,
    "input_spikes_last_10ms": {"excitatory": 6, "inhibitory": 2},
    "collaterals": [
      {"id": "output", "target": "L5 excitatory cells of the same orientation"},
      {"id": "recurrent", "target": "L2/3 excitatory cells of the same orientation"},
      {"id": "lateral", "target": "L2/3 SST interneurons (lateral inhibition)"}
    ],
    "routing_rule": "Higher apical (top-down) depolarization favors the output collateral."
  },
  "model": "jev-latest",
  "questions": {
    "neuron_score": {
      "type": "score",
      "instructions": "Rate this model neuron's somatic membrane state relative to its firing threshold.",
      "criteria": ["Hyperpolarized (below rest)", "At rest", "Depolarized, clearly subthreshold", "Near threshold", "At or above threshold"]
    },
    "neuron_noul": {
      "type": "noul",
      "instructions": "Will this neuron fire a spike within the next 10 ms?"
    },
    "neuron_choice": {
      "type": "choice",
      "instructions": "If this neuron fires now, which axon collateral should carry the spike?",
      "criteria": {"output": "Descending output to layer 5", "recurrent": "Recurrent excitation within layer 2/3", "lateral": "Recruit lateral inhibition"}
    }
  }
}
```

For interneurons, `neuron_choice` is omitted (2 questions) and `collaterals` is `[]`. For L4E and L5E the criteria map lists that population's collaterals from Section 2.5 with these descriptions: `ascending` "Feedforward to layer 2/3", `recurrent` "Recurrent excitation within the layer", `output` (L5) "Output to subcortical targets".

**Local comparison (FR-JEV-16):** the dashboard compare table (`compare-score`, `compare-noul`, `compare-choice`) shows local vs JEV values side by side:
- Local Score level: `0` if `S < −2`; `1` if `−2 ≤ S < 2`; `2` if `2 ≤ S < θ − 3`; `3` if `θ − 3 ≤ S < θ`; `4` if `S ≥ θ`.
- Local Noul (10 ms): Noul itself (`σ((S − θ)/Δ)`), because Noul is defined over the same 10 ms window that the question asks about.
- Local Choice: current `p_k` (Section 2.5).

#### 3.4.3 How answers act on the circuit (FR-JEV-17, only when `jevControl` is on)

| Answer | Effect | Bounds |
|---|---|---|
| `circuit_orientation` | Display only (JEV readout, FR-RO-02) | — |
| `circuit_novelty.noul` = ν | STDP third factor `M = 0.5 + ν` (if STDP on); if ν > 0.7, flash `readout-panel` with "novel input" for 1 s wall | ν clamped to [0, 1] |
| `circuit_evidence.score` = s | `β_output = 1.0 · (s/4 − 0.5)` added to the `output` collateral logit of all L23E | β ∈ [−0.5, 0.5] |
| Neuron answers | Display only (compare table) | — |

FR-JEV-18: Turning `jevControl` off sets all β to 0 and M to 1 immediately.

### 3.5 Simulated-mode emulator (FR-JEV-19 … 22)

`emulate(request, ctx) → response` where `ctx = {seed, callIndex}`. Pure function; deterministic for equal inputs.

- FR-JEV-19 Response shape is identical to the real API: `{model, answers: {<key>: {...}}, usage}`. `model = "jev-sim"`. `usage.input_tokens = ceil(JSON.stringify(request).length / 4)`, `usage.output_tokens = 20 · numberOfQuestions`.
- FR-JEV-20 Jitter: `rng = mulberry32((streamSeed(seed, "emulator") ^ fnv1a32(String(callIndex))) >>> 0)`; `jit() = (rng() − 0.5) · 0.04` (±0.02). Draw order: question keys in ascending (sorted) order; per key: `circuit_orientation` 5 draws (criteria order vertical, horizontal, diag45, diag135, none), `circuit_novelty` 1, `circuit_evidence` 0, `neuron_score` 0, `neuron_noul` 1, `neuron_choice` K (criteria order), unknown keys 0.
- FR-JEV-21 Known keys:
  - `circuit_orientation`: `r` = `l4_rates_hz` in order (vertical, horizontal, diag45, diag135); `T = Σr + 1e-6`; `m = max r`; logits `ℓ_o = 6 · (r_o / T) · min(m/10, 1)`, `ℓ_none = 6 · clamp(1 − m/10, 0, 1)`; `p = softmax(ℓ)`; add `jit()` to each `p`, clamp to ≥ 0, renormalise; `choice = argmax p` (first on tie); `confidence = 1 − H(p)/ln 5`.
  - `circuit_novelty`: `ν = clamp(2 · Σ|r − r_prev| / (Σr + Σr_prev + 10) + jit(), 0, 1)`.
  - `circuit_evidence`: sort `r` descending; `v = clamp((r₁ − r₂)/(r₁ + 5), 0, 1)`; score interpolation below.
  - `neuron_score`: `v = clamp((level + f)/4, 0, 1)` where `level` is the local Score level (FR-JEV-16) of `soma_mv` and `f = clamp((S − lo)/(hi − lo), 0, 0.99)` is the position inside that bin (open-ended bins use `lo = −20`, `hi = 40`).
  - `neuron_noul`: local Noul (10 ms) = `σ((soma_mv − threshold_mv)/Δ)` with default Δ, `+ jit()`, clamped to [0, 1].
  - `neuron_choice`: softmax of Section 2.5 logits reconstructed from `apical_mv`, `threshold_mv` and default b/γ, `τ_c = 1`; plus `jit()`, renormalised.
  - Unknown key: `noul` → 0.5; `choice` → uniform over criteria, choice = first key; `score` → `v = 0.5`.
- FR-JEV-22 Score interpolation (N levels): `x = v·(N−1)`, `i = floor(x)`, `f = x − i`; `p_i = 1 − f`, `p_{i+1} = f` (if `i = N−1`, `p_i = 1`); `score = Σ k·p_k`; `legend = {"0": criteria[0], …}`; `confidence = 1 − H(p)/ln N`. Entropy `H` everywhere uses `0 · ln 0 = 0`.
- Rounding (all types): numbers to 2 decimals; probability maps adjusted so the largest entry absorbs the rounding residual and the map sums to exactly 1.00.

### 3.6 REPLAY recording (FR-REC-01 … 07)

FR-REC-01 File `docs/data/jev-recording.json`, schema:

```json
{
  "format": "jev-recording",
  "version": 1,
  "recordedAt": "2026-10-17T12:00:00Z",
  "model": "jev-1.13.0",
  "app": {"name": "systemone-microcircuit", "commit": "abc1234"},
  "seed": 42,
  "params": {"<key>": "<value from DEFAULTS at record time>"},
  "stimulusSequence": [{"stimulus": "blank", "fromSimMs": 0}, {"stimulus": "vbar", "fromSimMs": 2000}],
  "usageTotal": {"input_tokens": 15000, "output_tokens": 2500, "calls": 35},
  "entries": [
    {
      "i": 0,
      "simTimeMs": 500.0,
      "requestHash": "9f2c1a7b",
      "matchKey": {"kind": "circuit_summary", "stimulus": "blank", "questionKeys": ["circuit_evidence", "circuit_novelty", "circuit_orientation"], "features": [0.25, 0.25, 0.25, 0.25, 0.02]},
      "questions": {"circuit_evidence": "score", "circuit_novelty": "noul", "circuit_orientation": "choice"},
      "stateDigest": {"kind": "circuit_summary", "stimulus": "blank", "simTimeMs": 500.0},
      "response": {"model": "jev-1.13.0", "answers": {}, "usage": {"input_tokens": 431, "output_tokens": 71}},
      "latencyMs": 281,
      "recordedAtMs": 1760702400000
    }
  ]
}
```

- FR-REC-01a Content restriction: each entry stores only (a) `response` = the normalized output of `validateResponse(request, upstream)` (fields `model`, validated and clamped `answers`, `usage`), never the raw upstream body; (b) `questions` = question key → type (the instructions and criteria are the fixed templates of Section 3.4 and are not stored); (c) `matchKey` and a minimal `stateDigest` (`kind`, `stimulus` or `population`, `simTimeMs`). The full `state`, raw upstream body, HTTP headers and any prompt text beyond the fixed templates MUST NOT be written.
- FR-REC-01b `validateRecording` requires only `format`, `version` and `entries[].{requestHash, matchKey, response.answers}`. Proxy-built recordings set `seed`, `params`, `stimulusSequence` and `app.commit` to `null`, and `simTimeMs` = `state.simTimeMs ?? null`.
- FR-REC-02 The file MUST NOT contain any key, `Authorization`, `X-JEV-Key`, cookies or any HTTP header. A unit test enforces this (U-40).
- FR-REC-03 `requestHash` = `fnv1a32(canonicalJSON({state, questions}))` as 8 lowercase hex digits (`model` excluded). `canonicalJSON` sorts object keys recursively, no whitespace.
- FR-REC-04 `matchKey.features`:
  - circuit: `[r_v, r_h, r_45, r_135] / max(Σr, 1)` followed by `min(max r, 50)/50` (5 numbers).
  - neuron: `[soma_mv/threshold_mv, apical_mv/threshold_mv, min(rate,50)/50]` and `kind`/`population` instead of `stimulus`.
- FR-REC-05 Matching order: (1) exact `requestHash`; (2) same `kind`, same `stimulus` (circuit) or `population` (neuron), same sorted `questionKeys`, minimum L1 distance of `features`, accepted if ≤ 0.25 (circuit) or ≤ 0.30 (neuron); ties → lowest `i`. (3) No match → emulator answer, log status `unrecorded`, increment badge count. Every matched entry is re-validated with `validateResponse(request, entry.response)` before it acts on the sim; on failure → the `unrecorded` path.
- FR-REC-06 Recording paths: (a) proxy flag `--record <path>` appends each successful upstream pair; (b) `btn-export-recording` (enabled only in LIVE with ≥ 1 successful call) downloads the same schema built from the session log. Both use the shared `buildRecordingEntry()` from `docs/js/jev/replay.js`.
- FR-REC-07 Recording procedure (task T17, automated): `tests/e2e/record.spec.mjs`, run only when `JEV_LIVE_TEST=1` and `TYPESAFE_API_KEY` is set, with webServer `node tools/jev-proxy.mjs --port 8791 --record docs/data/jev-recording.json` (env key passed through only in this case, FR-TST-05); page `?test=1&autoplay=0&seed=42`; via `window.__mc`: stimulus sequence `blank, vbar, hbar, diag45, diag135, checker, digit1, noise`, `runSteps(4000)` (2000 ms sim) each, auto JEV on (4 ticks each = 32 calls); then Ask JEV on `L4E-1`, `L23E-5`, `L5E-0` (3 calls). No key is ever typed into the page. Expected cost < $0.001. Without a key T17 is marked `deferred` and is non-blocking.

### 3.7 Error taxonomy (FR-JEV-23)

**Proxy error codes.** Every non-200 `/api/*` response from the proxy has body `{"error":{"code":<code>,"message":<string ≤ 200 chars, key-redacted>}}`. The client classifies by `code` (FR-JEV-12); the HTTP status is secondary.

| Proxy HTTP | `error.code` | Cause | Client retry | Client code |
|---|---|---|---|---|
| 400 | `bad_request` | invalid JSON or `validateRequest()` failure | no | `bad_request` |
| 401 | `no_key` | no env key and no `X-JEV-Key` | no | `no_key` |
| 401 | `unauthorized` | upstream 401 | no | `unauthorized` |
| 403 | `forbidden` | upstream 403 | no | `forbidden` |
| 403 | `bad_origin` | Origin / Sec-Fetch-Site check failed | no | `bad_request` |
| 413 | `too_large` | body > 32 768 bytes | no | `bad_request` |
| 415 | `bad_content_type` | Content-Type not JSON | no | `bad_request` |
| 421 | `bad_host` | Host check failed | no | `bad_request` |
| 400 / 422 | `upstream_rejected` | upstream 400 or 422 | no | `bad_request` |
| 429 | `upstream_rate_limited` | upstream 429 | **yes** | `rate_limited` |
| 429 | `rate_limited` | proxy token bucket | no | `rate_limited` |
| 429 | `budget_exhausted` | proxy budget cap | no | `budget_exhausted` |
| 503 | `upstream_overloaded` | upstream 529, 502 or 503 | **yes** | `overloaded` |
| 502 | `network` | proxy could not reach upstream | **yes** | `network` |
| 504 | `timeout` | upstream > 5000 ms | no | `timeout` |
| 502 | `upstream_malformed` | upstream 200 non-JSON, or any other upstream status | no | `malformed` |

Client-only codes: `proxy_unreachable` (`fetch` rejects with `TypeError`, for example proxy stopped), `timeout` (client abort at 6000 ms), `malformed` (FR-JEV-24 validation failure), `budget_exhausted` (client cap), `aborted`.

| Client code | UI behaviour | Mode change |
|---|---|---|
| `no_key` | Open key modal (only if LIVE is available, FR-KEY-11); info banner "Paste a JEV key or set TYPESAFE_API_KEY for the proxy" | Stay in previous mode |
| `unauthorized` | If `keySource = "env"`: error banner "The proxy's TYPESAFE_API_KEY was rejected (401) — fix it and restart the proxy"; no modal; browser key untouched. Otherwise: error banner "JEV rejected the key (401)"; key marked invalid in memory (not deleted); key modal opens | → SIMULATED |
| `forbidden` | Error banner "No key reached JEV (403)" | → SIMULATED |
| `bad_request` | Log entry error with sanitised message; tick fallback; after 3 consecutive → banner "JEV rejected the request format" | after 3 → SIMULATED |
| `rate_limited` | upstream: retry per FR-JEV-12, warn banner "JEV rate limit — retrying"; proxy bucket: tick fallback | fallback per FR-JEV-14 |
| `overloaded` | Retry per FR-JEV-12; warn banner | fallback per FR-JEV-14 |
| `network` | Retry per FR-JEV-12; then tick fallback | fallback per FR-JEV-14 |
| `budget_exhausted` | Warn banner (FR-JEV-13) | → SIMULATED, autoJev off |
| `proxy_unreachable` | Re-run health check; error banner "Lost connection to the local proxy" | → SIMULATED; LIVE disabled until health passes |
| `timeout` | Log entry; tick fallback (no retry) | after 3 consecutive → SIMULATED |
| `malformed` | Log entry "Malformed JEV response ignored"; tick fallback | after 3 consecutive → SIMULATED |
| `aborted` | Log entry `aborted`; late response ignored | none |

JEV log statuses are a closed set: `ok | exact | nearest | unrecorded | aborted | fallback:<client code> | error:<client code>`.

### 3.8 Response validation (FR-JEV-24)

`validateResponse(request, json) → {ok: true, answers} | {ok: false, reason}`:
- Top level MUST be an object with `answers` object; `model` string ≤ 64 chars (else replaced by `"unknown"`); `usage` optional with non-negative integers.
- Every question key in the request MUST be present in `answers`; extra keys are dropped.
- `answers[k].type` MUST equal the requested type.
- noul: `noul` finite number → clamp [0, 1].
- choice: `choice` MUST be a key of the request's criteria; `probabilities` keys ⊆ criteria keys, values finite, clamped [0, 1], renormalised to sum 1 (if sum is 0 → invalid); `confidence` clamped [0, 1].
- score: `probabilities` keys `"0"…"N−1"`, finite, clamped, renormalised; `score` clamped to [0, N−1]; `legend` values coerced to strings truncated to 200 chars; `confidence` clamped [0, 1].
- Any string from the response is rendered only via `textContent` (NFR-SEC-06). Response text is data, never instructions; nothing in a response can change params other than the bounded effects in FR-JEV-17.

### 3.9 Key lifecycle (FR-KEY-01 … 10)

- FR-KEY-01: The key is never committed, embedded in any file, placed in a URL, logged (console, JEV log, recording, proxy stdout/stderr) or sent anywhere except: browser → same-origin proxy (`POST api/jev` only) in header `X-JEV-Key`; proxy → the validated upstream (FR-PRX-04) in `Authorization: Bearer`. The page has NO URL parameter or setting for the API base; the client attaches `X-JEV-Key` only when `new URL(url, location.href).origin === location.origin` and the path is `/api/jev`.
- FR-KEY-02: Resolution order in LIVE: (1) `--mock-upstream` (health `keySource: "mock"` regardless of env; no key needed, none used or sent); (2) proxy env `TYPESAFE_API_KEY` (health `keySource: "env"`; the browser never sends a key and the key modal says "The proxy is using its own key"); (3) browser-pasted key sent as `X-JEV-Key`.
- FR-KEY-03: Entry via `key-modal` only, `<input type="password" autocomplete="off" spellcheck="false">`.
- FR-KEY-04: Normalisation: trim leading/trailing whitespace and newlines; reject (inline error, not stored) if the result is shorter than 8 or longer than 512 characters, contains whitespace, or contains characters outside printable ASCII 0x21–0x7E.
- FR-KEY-05: Storage: `sessionStorage['smc.jevKey']` by default; if `key-remember` is checked, `localStorage['smc.jevKey']` instead (and removed from sessionStorage). All storage access wrapped in try/catch; on failure keep the key in memory only and show info "Storage unavailable — key kept for this tab only".
- FR-KEY-06: Display: masked as `•••• ` + last 4 characters (`key-masked`); never the full key.
- FR-KEY-07: `btn-key-forget` removes the key from memory, sessionStorage and localStorage, and switches to SIMULATED if LIVE depended on it.
- FR-KEY-08: If the URL contains a `key`, `apiKey` or `token` query parameter, the app MUST ignore it, remove it via `history.replaceState`, and show warn banner "Keys in URLs are ignored for your safety".
- FR-KEY-09: `serializeLogEntry()`, `buildRecordingEntry()` and the `?test=1` state (`window.__mc.getState()`) MUST NOT include the key; unit tests U-38, U-39 and U-40 enforce this.
- FR-KEY-10: The key is held in a module-private variable in `keystore.js`; it is not attached to `window`, the store, or the event bus.
- FR-KEY-11: Key entry exists only behind a working same-origin proxy. The key modal's `key-input`, `key-remember` and `btn-key-save` are enabled, and keys are read from or written to storage, only when the last health check passed (`GET /api/health` OK, FR-JEV-05). On GitHub Pages or any static host (`--no-api`, health 404): `btn-key` is disabled with tooltip (`title`) `Keys can only be used with the local proxy (node tools/jev-proxy.mjs)`, the keystore is not initialised from storage, and nothing is stored. With `keySource = "env"` or `"mock"` the modal shows only `key-proxy-note`, the safety text and `btn-key-forget`.

---

## 4. UI / UX specification

### 4.1 Layout (FR-UI-01)

Desktop ≥ 1200 px (primary target 1280×800):

```
┌──────────────────────────────── header (56 px) ────────────────────────────────┐
│ title · pitch · [mode badge] [SIM|REPLAY|LIVE] [key] [▶/❚❚] [step] [reset]     │
│ speed ▭  t=1234.5 ms  seed [42][apply][🎲]  LIVE calls 0/50  [about] [theme]    │
├───────────── left 280 px ─┬────────── center 1fr ──────────┬─ right 400 px ────┤
│ Input: presets grid       │ SVG microcircuit               │ Readout            │
│ preview 16×16             │  Input grid → L4 → L2/3 → L5   │ Raster             │
│ draw canvas               │  E/PV/SST/VIP nodes            │ Score traces       │
│ contrast/noise/rate       │  collaterals + spikes          │ Noul trace         │
│ ───────────────           │  legend                        │ Choice bars        │
│ Params (collapsible)      │                                │ Pop. rates         │
│                           │                                │ Compare + Ask JEV  │
│                           │                                │ JEV log            │
└───────────────────────────┴────────────────────────────────┴────────────────────┘
```

- CSS grid: `grid-template-columns: 280px minmax(0, 1fr) 400px; grid-template-rows: auto minmax(0, 1fr)`. Header spans all columns. Left and right columns scroll independently (`overflow-y: auto`); the page body does not scroll at ≥ 1200 × 760.
- 768–1199 px: two columns `minmax(0,1fr) 360px`; left panel moves below the circuit in column 1.
- < 768 px: single column, order: header (wraps to 2–3 rows), circuit (aspect 4:3, max-height 60vh), input, dashboard, params. 16 px side gutter. No horizontal page scroll at 375 px (NFR-UI-01, test E09).

### 4.2 Components and test IDs (FR-UI-02 … 20)

Every interactive or asserted element MUST carry the listed `data-testid`. Sliders have a sibling `<output>` with `data-testid="<id>-value"`.

**Header**

| testid | Element | Behaviour |
|---|---|---|
| `app-title` | h1 | "SystemOne Microcircuit" |
| `pitch` | p | pitch text (Section 0.1) |
| `mode-badge` | span, `role="status"` | active mode text (FR-JEV-03) |
| `mode-select-sim`, `mode-select-replay`, `mode-select-live` | radio-style buttons, `aria-pressed` | switch mode; disabled when unavailable, tooltip text in the `title` attribute and referenced by `aria-describedby` (hover does not fire on disabled buttons; tests assert `title`) |
| `btn-key` | button | opens key modal; label shows `Key ✓` when a key is stored; disabled with `title` tooltip when health failed (FR-KEY-11) |
| `btn-play` | button, `aria-pressed` | toggles run/pause; label "Play"/"Pause" |
| `btn-step` | button | advances 5 ms sim (10 steps); pauses first if running |
| `btn-reset` | button | reset (FR-UI-18) |
| `speed-slider` | range, 7 stops | sim ms per wall s |
| `sim-time` | output | `t = 1234.5 ms` |
| `seed-input` | input text, `inputmode="numeric"` | uint32 |
| `btn-seed-apply` | button | validate, apply, reset |
| `btn-seed-random` | button | random uint32 from `crypto.getRandomValues`, apply, reset |
| `jev-budget` | output | `LIVE calls: used / cap` |
| `btn-about` | button | opens About drawer |
| `btn-theme` | button | cycles `system → dark → light` |

**Banner:** `banner` (`role="alert"` for error, `role="status"` otherwise), `banner-text`, `banner-dismiss`. One banner at a time; newer replaces older; errors persist until dismissed, warn/info auto-hide after 8 s wall (with `?test=1` they persist until dismissed, FR-TST-09).

**Left: input panel**

| testid | Element |
|---|---|
| `stimulus-preset-<id>` | button per preset in FR-ENC-02 except `custom` (11 buttons: blank, white, vbar, hbar, diag45, diag135, checker, digit1, digit7, digit0, noise); each shows a 16×16 thumbnail (rendered without consuming sim streams); `aria-pressed` on active |
| `stimulus-preview` | canvas 128×128 CSS px, shows effective intensities `x'` |
| `draw-canvas` | canvas 192×192 CSS px, pointer drawing |
| `brush-draw`, `brush-erase` | toggle buttons |
| `btn-draw-clear` | clears drawing |
| `btn-draw-use` | rasterises to 16×16 (area average), selects `custom` |
| `contrast-slider` | c |
| `pixel-noise-slider` | σ_px |
| `rate-max-slider` | r_max |
| `cycle-toggle` | checkbox: cycle presets `vbar → hbar → diag45 → diag135` every 2000 ms sim |

**Left: params panel** (`params-panel`, `<details>` open by default on desktop, closed on < 768 px)

| testid | Param |
|---|---|
| `param-tauM` | τ_m |
| `param-theta` | θ |
| `param-delta` | Δ |
| `param-sigmaV` | σ_V |
| `param-g` | E/I balance g |
| `param-tauC` | τ_c |
| `routing-hard`, `routing-soft` | routing radio |
| `param-pvMode` | select |
| `param-attention` | A |
| `param-stdp` | checkbox |
| `param-jevControl` | checkbox |
| `param-autoJev` | checkbox |
| `param-jevIntervalMs` | slider |
| `param-liveMinIntervalMs` | slider |
| `param-budget` | number input 0–500 |
| `btn-params-default` | restore DEFAULTS (keeps seed and mode) |

**Center: circuit view**

| testid | Element |
|---|---|
| `circuit-svg` | SVG, `viewBox="0 0 800 600"`, `role="img"` with `aria-label` summarising activity, plus `<title>` |
| `neuron-<ID>` | `<g>` per neuron (58), `tabindex="0"`, `role="button"`, `aria-label="L23E-5, L2/3 excitatory, horizontal, 12.3 mV"` (label updates at most 2×/s) |
| `input-grid` | 16×16 rect grid at top showing pixel spikes (flash on spike) |
| `collateral-<ID>-<collateralId>` | path per E-neuron collateral bundle |
| `layer-label-L4`, `layer-label-L23`, `layer-label-L5`, `layer-label-input` | text |
| `legend` | colour legend for E/PV/SST/VIP, Score scale, spike |
| `tooltip` | hover/focus tooltip: ID, population, S, Db, Da (not for L4E), Noul, rate, last chosen collateral |

Geometry: rows at y = 70 (input grid, 16×16 cells of 8 px centred), 230 (L4), 380 (L2/3), 520 (L5). E neurons as triangles (pyramidal glyph, 18 px), interneurons as circles (12 px), coloured by class token; orientation groups clustered left-to-right in order vertical, horizontal, diag45, diag135, each labelled with a small orientation glyph. Interneurons placed to the right of each layer row. Fill brightness = `clamp(S/θ, 0, 1)` mixing `--surface-2` to the class colour; spike → 120 ms wall glow (`--spike`).

Spike animation (FR-UI-12): routed spikes animate a dot along the chosen collateral path over `max(150, 60 · dSteps)` ms wall; soft routing animates all collaterals with opacity `p_k`. Max 300 concurrent particles (oldest dropped). With `prefers-reduced-motion: reduce`, no travelling dots; the collateral path instead flashes (opacity step for 120 ms) and node glow still updates (NFR-A11Y-05).

Selection (FR-UI-13): click/Enter/Space on a neuron selects it (replaces selection); Shift+click adds (max 3; fourth replaces oldest). Selected neurons have a 2 px `--accent` ring. Default selection on load: `L23E-1`.

**Right: dashboard**

| testid | Element | Content |
|---|---|---|
| `readout-panel` | section | `title` tooltip with the FR-SCI-09 text |
| `readout-local` | output | local label + bars `readout-bar-<o>` (`<o>` = orientation name: `vertical`, `horizontal`, `diag45`, `diag135`) |
| `readout-jev` | output | JEV choice, confidence, mode tag (`SIM`/`REPLAY`/`LIVE`/`FALLBACK`/`UNRECORDED`) |
| `readout-agree` | output | `agree` / `disagree` |
| `raster-canvas` | canvas | last 1000 ms sim, one row per neuron (58 rows) grouped by population with colour bands |
| `trace-canvas` | canvas | S (solid), Db (dashed), Da (dotted) of selected neurons, last 1000 ms, θ line |
| `noul-canvas` | canvas | Noul of selected neurons, last 1000 ms, y ∈ [0, 1]; axis label "Noul = P(≥ 1 spike in 10 ms)" |
| `choice-bars` | div | for primary selected E neuron: `choice-bar-<collateralId>` showing current `p_k` (filled) and chosen fraction over last 1000 ms (outline); for interneurons the text "Interneuron: local axon, no Choice" |
| `rate-canvas` | canvas | 9 population rates, 10 ms bins, 50 ms boxcar smoothing, last 5000 ms |
| `selected-neuron-label` | output | IDs of selected neurons |
| `compare-table` | table | rows `compare-score`, `compare-noul`, `compare-choice`: Local vs JEV |
| `btn-ask-jev` | button | sends neuron request; disabled while in flight or (LIVE) budget exhausted |
| `jev-log` | ol, `aria-live="polite"` | newest first, max 200 entries |
| `jev-log-entry` | li per entry | `#n · t=<sim ms> · MODE · kind · status · latency ms · summary` (status from the closed set in Section 3.7; sim time, not wall clock, so screenshots are reproducible); `<details>` with request (state + questions) and response JSON in `<pre>` via `textContent` |
| `btn-clear-log` | button | clears the log display (not budget) |
| `btn-export-recording` | button | FR-REC-06 (b) |
| `runaway-warning` | div `role="status"` | FR-SIM-12 |
| `fps-meter` | output | only with `?debug=1` |

**Key modal** (`key-modal`, `role="dialog"`, `aria-modal="true"`, focus trap, Esc closes): `key-input`, `key-remember` (checkbox, label "Remember on this device"), `btn-key-save`, `btn-key-cancel`, `btn-key-forget`, `key-masked`, `key-error`, `key-proxy-note` (shown when `keySource = "env"` or `"mock"`). The modal can be opened only when health passed (FR-KEY-11). Safety text (verbatim): "Your key is only sent to the local proxy on this computer, which forwards it to api.typesafe.ai. It is never put in the URL, logs, or recordings. A pasted key is visible in your browser's developer tools (Network tab), so when presenting prefer the proxy's environment key."

**About drawer** (`about-drawer`, `role="dialog"`, focus trap, Esc closes, `btn-about-close`). Content lives in the DOM-free data module `docs/js/ui/about-content.js` (exports plain strings/arrays; importable in Node for U-57) and is rendered with `textContent`. Sections, in order, each MUST be non-empty:
- `about-pitch`: Section 0.1 pitch paragraph verbatim.
- `about-mapping`: table 1.4 verbatim, followed by the hard-routing [DEMO] paragraph below it.
- `about-established`: the bullets of Section 1.2 verbatim, each with its citation numbers.
- `about-proposal`: the bullets of Section 1.3 verbatim; then the FR-SCI-01 correction paragraph of Section 0.2 verbatim (containing the sentence "Noul is a probability; spike is a Bernoulli sample of the per-step hazard derived from it."); then statement 1.5 verbatim.
- `about-simplification`: exactly these bullets, in order: (1) "This page is a didactic toy: the numbers are chosen for clarity, not fitted to data." (2) the FR-SCI-08 scaling statement verbatim; (3) the hard-routing [DEMO] paragraph of Section 1.4 verbatim; (4) the FR-SCI-09 text verbatim; (5) "Noul uses a sigmoid of the distance to threshold, a simplification within the escape-noise family [16, 18]."; (6) "Dendritic input gating is not modelled. Layer-4 cells keep an apical compartment only for code uniformity."; (7) "The STDP third factor is a simple gain on immediate weight updates, without eligibility traces [10]."; (8) "SIMULATED and REPLAY runs are deterministic for a given seed; LIVE runs are not reproducible."; then one bullet per DEMO-tagged parameter of Section 2.3, rendered from `PARAM_SPECS` as `<symbol> = <default> <unit>: <source text>`.
- `about-refs`: numbered references from Section 11, each with a DOI link, or the URL when there is no DOI ([37–39]), `rel="noopener noreferrer"`, `target="_blank"`.

**File-protocol notice** (`file-protocol-notice`): shown by `boot.js` when `location.protocol === 'file:'` (Section 10, OQ-01).

### 4.3 States (FR-UI-15)

| State | Entered when | Visible cues |
|---|---|---|
| `idle` | after load with `?autoplay=0`, or after reset while paused | Play label "Play", t = 0 |
| `running` | Play pressed or autoplay | Play label "Pause", animations |
| `paused` | Pause, Step, tab hidden | Play label "Play" |
| `live-pending` | LIVE request in flight | spinner dot in `mode-badge`, `btn-ask-jev` disabled |
| `error` | error banner shown | banner `role="alert"` |
| `no-key` | LIVE selected (health passed), `keySource = "none"` and no key | key modal open, mode stays previous |

Autoplay: default on (`?autoplay=1`), starting with preset `vbar`.

### 4.4 Interactions (FR-UI-16 … 20)

- FR-UI-16 Parameter changes apply live at the next step; charts reflect them without reset.
- FR-UI-17 Stimulus selection applies at the next step; triggers FR-JEV-08 (2).
- FR-UI-18 Reset: aborts in-flight JEV (status `aborted`), increments `runId` (late responses carrying an old `runId` are discarded), rebuilds network from seed, zeroes state, clears charts and readout, keeps params, mode, stimulus, selection, budget and log (a log separator entry "— reset —" is added).
- FR-UI-19 Mode switch: aborts in-flight request, increments `runId`, does not reset the simulation.
- FR-UI-20 Rapid input: Play toggles are idempotent per click; Reset and Step are processed synchronously in the event handler; no work is queued; Ask JEV is ignored while disabled.

### 4.5 Keyboard (NFR-A11Y-01)

Active only when focus is not in `input`, `textarea`, `select` or a `contenteditable` element, and no modal/drawer is open.

| Key | Action |
|---|---|
| Space | Play / Pause (`preventDefault` to avoid scrolling) |
| S | Step |
| R | Reset |
| K | Open key modal |
| A | Open About drawer |
| J | Ask JEV |
| 1–9, 0 | Select preset in order: vbar, hbar, diag45, diag135, checker, digit1, digit7, digit0, noise, blank |

### 4.6 Accessibility (NFR-A11Y-02 … 06)

- NFR-A11Y-02 All buttons and inputs have accessible names (`aria-label` or visible `<label>`).
- NFR-A11Y-03 Visible focus ring (`2px solid var(--accent)`, offset 2 px) on every focusable element; tab order follows layout.
- NFR-A11Y-04 Text contrast ≥ 4.5:1 against its background in both themes (checked in E10/E11 via computed styles).
- NFR-A11Y-05 Reduced motion: no particle animation, no glow transitions longer than 120 ms; simulation and charts keep updating.
- NFR-A11Y-06 Canvas charts have `role="img"` and an `aria-label` updated at most once per second (for example "Raster: 312 spikes in last second, L4E most active").

### 4.7 Colour tokens (NFR-UI-02)

Defined on `:root` in `css/tokens.css`. Theme resolution: `data-theme="dark"|"light"` on `<html>` wins; otherwise `prefers-color-scheme`. Dark is the reference "lab" look.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0b0f17` | `#f6f8fb` | page background |
| `--surface` | `#111827` | `#ffffff` | panels |
| `--surface-2` | `#1f2937` | `#e9eef5` | inactive nodes, chart bg |
| `--border` | `#2d3748` | `#cfd8e3` | borders |
| `--text` | `#e6edf3` | `#111827` | body text |
| `--text-muted` | `#9aa7b6` | `#4b5563` | secondary text |
| `--accent` | `#22d3ee` | `#0e7490` | focus, selection, accents |
| `--exc` | `#ff6b9d` | `#c2185b` | excitatory |
| `--pv` | `#4dabf7` | `#1864ab` | PV |
| `--sst` | `#b197fc` | `#6741d9` | SST |
| `--vip` | `#63e6be` | `#087f5b` | VIP |
| `--spike` | `#fff3bf` | `#f08c00` | spike glow, raster dots |
| `--ok` | `#69db7c` | `#2b8a3e` | success |
| `--warn` | `#ffd43b` | `#a35f00` | warnings |
| `--error` | `#ff6b6b` | `#c92a2a` | errors |

Required CSS skeleton: tokens on `:root` (light values), redefined under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and under `:root[data-theme="dark"] { … }`. `body { background: var(--bg); color: var(--text); }`. Font: system stack `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; monospace `ui-monospace, "SFMono-Regular", Consolas, monospace`. No web fonts.

### 4.8 Performance (NFR-PERF-01 … 06)

- NFR-PERF-01 ≥ 50 fps median over 10 s at 1280×800, default network, speed 100, on a mid-range laptop (4-core, integrated GPU). Verified with the `?debug=1` fps meter (E19); fps = median of `1000/Δt` over the last 120 rAF frames.
- NFR-PERF-02 Fixed-step accumulator (pure function `computeSteps` in `docs/js/core/loop.js`): each `requestAnimationFrame`, `acc += min(wallDeltaMs, 100) · speed/1000`; run `floor(acc/dt)` steps, capped at 400 steps per frame; if the cap is hit, drop the excess (`acc = 0`) and show `fps-meter` note "sim slowed" (debug only). Render once per frame after stepping.
- NFR-PERF-03 Charts use ring buffers with fixed capacity: raster 1000 ms of spikes (max 58 × 500 = 29 000 events), traces 2000 samples × 3 neurons × 4 series, rate 500 bins × 9, Choice history 1000 ms. Memory MUST NOT grow with run length (E20: heap after 60 s within +10 % of heap after 10 s, at speed 1000).
- NFR-PERF-04 SVG node attribute updates batched once per frame; only changed attributes written.
- NFR-PERF-05 Tab hidden (`visibilitychange`): auto-pause, remember prior state, reset accumulator; on visible, resume if it was running (no catch-up).
- NFR-PERF-06 Sim core step for N = 58 MUST take < 0.05 ms median in Node (U-30 benchmark, informational, not CI-failing).

---

## 5. Architecture

### 5.1 File tree (FR-ARCH-01)

```
docs/                         # GitHub Pages root
  index.html                  # T01: ALL region containers + data-testids, links every css file
  .nojekyll
  SPEC.md
  css/tokens.css              # T01
  css/base.css                # T01: reset, layout grid, focus ring, test-mode rules
  css/header.css              # T10 (T01 creates empty placeholder)
  css/circuit.css             # T11 (placeholder by T01)
  css/dashboard.css           # T12 (placeholder by T01)
  css/panels.css              # T13 (placeholder by T01)
  css/dialogs.css             # T14 (placeholder by T01)
  data/jev-recording.json     # placeholder by T07 (empty entries), real file by T17
  js/boot.js                  # classic script: theme pre-paint, file:// notice
  js/main.js                  # module entry: wiring + rAF loop + window.__mc test hook
  js/core/rng.js
  js/core/hash.js
  js/core/params.js
  js/core/ringbuffer.js
  js/core/loop.js             # computeSteps (NFR-PERF-02)
  js/core/stimuli.js
  js/core/encoding.js
  js/core/network.js
  js/core/sim.js
  js/core/readout.js
  js/core/scheduler.js        # DOM-free JEV tick scheduler + bounded control (FR-JEV-08)
  js/jev/schema.js
  js/jev/summary.js
  js/jev/emulator.js
  js/jev/replay.js
  js/jev/client.js
  js/jev/keystore.js
  js/ui/store.js
  js/ui/bus.js
  js/ui/header.js
  js/ui/banner.js
  js/ui/input-panel.js
  js/ui/params-panel.js
  js/ui/circuit-view.js
  js/ui/charts.js
  js/ui/dashboard.js
  js/ui/jev-log.js
  js/ui/key-modal.js
  js/ui/about.js
  js/ui/about-content.js      # DOM-free About text data (U-57)
  js/ui/theme.js
  js/ui/keyboard.js
tools/
  jev-proxy.mjs
  cf-worker.js                # MAY (T19)
tests/
  unit/*.test.mjs
  e2e/*.spec.mjs
  fixtures/recording.json
  screenshots/
  EVIDENCE.md
.gitignore                    # FR-TST-07
package.json                  # dev only: "type":"module", "private":true, engines, exact-pinned devDependency
package-lock.json             # committed; CI/verify uses npm ci
playwright.config.mjs
README.md
```

**File ownership (normative).** Every file has exactly one owning task (Section 8.2). T01 creates `index.html` with every region container and every `data-testid` container of Section 4.2 as empty mount elements, plus `css/tokens.css`, `css/base.css` and empty placeholder files for each `css/<component>.css` (so no stylesheet 404s). Later UI tasks only fill their own container from their own JS module and write only their own `css/<component>.css`; no two tasks edit the same file.

- FR-ARCH-02: Everything under `docs/js/core/` and `docs/js/jev/` (except `client.js` network calls, which take an injected `fetch`), plus `docs/js/ui/about-content.js`, MUST be DOM-free and importable in Node with `node --test`. Development and tests require Node ≥ 22 (`package.json` `"engines": {"node": ">=22"}`); the proxy runtime alone still works on Node ≥ 18.
- FR-ARCH-02a `package.json` (dev only; the page itself has zero dependencies): `{"name": "systemone-microcircuit", "private": true, "type": "module", "engines": {"node": ">=22"}, "scripts": {...Section 7.1}, "devDependencies": {"@playwright/test": "1.49.1"}}` (exact pin, no `^`). `package-lock.json` is committed; CI and verify steps install with `npm ci`.
- FR-ARCH-03: No bundler, no transpiler, no npm runtime dependency. ES modules with relative imports including the `.js` extension.
- FR-ARCH-04: No external scripts, styles or fonts. If a library ever becomes necessary it MUST be vendored under `docs/vendor/` with its licence, or loaded from a CDN pinned to an exact version with SRI.
- FR-ARCH-05: `index.html` includes `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`. No inline scripts, no inline `style=""` attributes in HTML (JS `element.style` is allowed). `connect-src 'self'` is final: the page never talks to any origin other than its own (no API-base parameter, FR-KEY-01).

### 5.2 Module interfaces (FR-ARCH-06)

```js
// core/rng.js
export function mulberry32(seed: number): () => number;          // [0,1); seed coerced with >>> 0
export function streamSeed(seed: number, salt: string): number;  // = fnv1a32(String(seed >>> 0) + ":" + salt), uint32
export function gauss(rng: () => number): number;                 // z = sqrt(−2·ln(1 − u1))·cos(2π·u2); consumes exactly 2 draws
export const STREAM = Object.freeze({ TOPOLOGY:"topology", STIM:"stim", INPUT:"input", TOPDOWN:"topdown",
  NOISE:"noise", SPIKE:"spike", ROUTE:"route", EMULATOR:"emulator", NOISE_PRESET:"noisePreset", UI:"ui" });
// Every named PRNG stream is mulberry32(streamSeed(masterSeed, STREAM.X)), created at build/reset.
// Sim streams: topology (buildNetwork), stim (pixel noise z_p), input, topdown, noise, spike, route.
// emulator: per call, FR-JEV-20. noisePreset: fresh per makePreset('noise') call. ui: anything visual that
// needs randomness (thumbnails, particles jitter); ui and noisePreset never consume sim streams and sim code
// never reads them. Draws per step per stream are fixed (Section 2.4), so stream contents depend only on seed.

// core/hash.js
export function fnv1a32(str: string): number;
export function fnv1a32Bytes(u8: Uint8Array): number;
export function canonicalJSON(value: unknown): string;
export function hex8(n: number): string;

// core/params.js
export const DEFAULTS: Readonly<Params>;
export const PARAM_SPECS: Readonly<Record<string, {min?, max?, step?, options?, unit, source, tag, symbol}>>;
export function clampParams(p: Partial<Params>, opts?: {allowFixed?: boolean}): Params;
export function derive(p: Params): Derived;                       // λs, refSteps, delay steps, noulExp
export function parseSeed(s: string): {ok: true, seed: number} | {ok: false, error: string}; // EC-32, U-03

// core/ringbuffer.js
export class RingBuffer { constructor(capacity: number, ArrayType = Float32Array);
  push(v: number): void; get(i: number): number; get length(): number; clear(): void; toArray(): Float32Array; }

// core/loop.js
export function computeSteps(acc: number, wallDeltaMs: number, speed: number):
  {steps: number, acc: number, capped: boolean};                   // NFR-PERF-02, U-51

// core/stimuli.js
export const PRESET_IDS: readonly string[];
export function makePreset(id: string, seed: number): Float32Array;  // 256; 'noise' uses its own noisePreset stream
export function rasterize(rgba: Uint8ClampedArray, w: number, h: number): Float32Array; // area-average to 16×16, luminance, clamped
export function effectiveIntensity(img: Float32Array, c: number, sigmaPx: number, z: Float32Array): Float32Array; // z drawn by sim (FR-ENC-03)

// core/encoding.js
export function rates(intensity: Float32Array, rBase: number, rMax: number): Float32Array;
export function makeKernel(o: 0|1|2|3, offset: number): Float32Array;          // FR-ENC-05

// core/network.js
export function buildNetwork(params: Params, seed: number): Network;   // draws from STREAM.TOPOLOGY in Section 2.6 order
export function buildSingleNeuronNetwork(pop: PopId): Network;         // test harness: N = 1, no synapses, no kernels
// Network = { N, pops: PopInfo[], neurons: NeuronInfo[], trunk: Synapse[][], collaterals: Collateral[][],
//             kernels: Float32Array[], plastic: Int32Array }  (Synapse = {target, comp:0|1|2, w0, dSteps, inhibitory})
// createSim accepts any object of this shape; tests MAY build minimal network literals.

// core/sim.js
export function createSim(network: Network, params: Params, seed: number, opts?: {test?: boolean}): Sim;
// Sim = { step(): StepResult; stepN(k): void; setParams(p): void; setStimulus(img: Float32Array, id: string): void;
//         setControl({betaOutput?: number, stdpM?: number}): void; reset(seed?: number): void;
//         readonly t: number; readonly n: number; state: SimState; spikesSince(n0): Int32Array /*pairs n,i*/;
//         stats: {nanResets, dampGain, runawayActive}; rasterHash(): string; inputHash(): string;
//         debug?: { inject(i, comp: 0|1|2, mV: number, delaySteps = 0): void; forceNoul(i, p: number|null): void;
//                   setState(i, partial: {S?, Db?, Da?, G?, ref?}): void } }   // debug only when opts.test
// StepResult = { spikes: Int32Array /*neuron ids*/, routes: Array<{src, k, p: Float32Array}> }
// inputHash() = hex8 fnv1a32 over [n, p] pixel-spike pairs since reset (U-22).
// With opts.test, setParams may override fixed keys (FR-SIM-04). Test harness for U-05…U-16:
// createSim(buildSingleNeuronNetwork('L23PV'), params, 1, {test: true}) plus debug.* — no other hooks.

// core/readout.js
export function localReadout(spikeLog, n: number, network, windowMs = 200): {label, counts: number[], probs: number[]};
export function agree(localLabel: string, jevChoice: string | null): boolean | null;  // FR-RO-03, U-59

// core/scheduler.js  (DOM-free; FR-JEV-08/09/17/18; owned by T08)
export function createScheduler({sim, network, client, getParams, getStimulusId, bus}): Scheduler;
// Scheduler = { afterStep(n): void;            // called by the loop and by __mc.runSteps after every sim.step()
//               onStimulusChange(id, tMs): void; reset(): void;   // reset: clears pending ticks, windowMs base
//               lastTickMs: number }
export function applyControl(answers, params): {betaOutput: number, stdpM: number};  // FR-JEV-17/18 bounds, U-58

// jev/schema.js
export function circuitRequest(summary): JevRequest;
export function neuronRequest(neuronSummary): JevRequest;
export function validateResponse(request: JevRequest, json: unknown): {ok: true, response} | {ok: false, reason: string};
export function validateRequest(body: unknown): {ok: true} | {ok: false, reason: string}; // shared with proxy

// jev/summary.js
export function summarizeCircuit(sim, network, windowMs, prevWindow, stimulusId, localLabel): object;
export function summarizeNeuron(sim, network, id: string): object;

// jev/emulator.js
export function emulate(request: JevRequest, ctx: {seed: number, callIndex: number}): JevResponse;

// jev/replay.js
export function validateRecording(json: unknown): {ok: true, recording} | {ok: false, reason};
export function matchKey(request: JevRequest): MatchKey;
export function findMatch(recording, request): {entry, kind: "exact"|"nearest"} | null;
export function buildRecordingEntry(i, simTimeMs, request, validatedResponse, latencyMs): Entry; // FR-REC-01a fields only
export function buildRecording(meta, entries): Recording;
export function serializeLogEntry(entry): object;                 // JEV log <details> payload; never the key (U-39)

// jev/keystore.js  (storage injected for tests: {session, local} with getItem/setItem/removeItem)
export function createKeystore(storage): { enable(): void;  // called only after health passed (FR-KEY-11); before
  // enable() the keystore never reads or writes storage and set() returns {ok:false, error:"disabled"}
  get(): string|null; set(raw: string, remember: boolean): {ok, error?, memoryOnly?}; forget(): void;
  masked(): string; has(): boolean; markInvalid(): void; isInvalid(): boolean; readonly enabled: boolean };
export function normalizeKey(raw: string): {ok: true, key} | {ok: false, error};

// jev/client.js
export function createJevClient({mode, fetchImpl, emulator, replay, keystore, bus, now, setTimeout, clearTimeout}): JevClient;
// JevClient = { setMode(m): void; ask(kind: "circuit"|"neuron", request, simTimeMs): Promise<Result>|Result;
//   abortAll(reason): void; resetRun(): void /* abortAll + callIndex = 0 */; readonly callIndex: number;
//   budget: {used, cap}; setBudgetCap(n): void; inFlight: boolean; health(): Promise<Health|null> }
// Result = { ok, mode, status, latencyMs, response?, error?: {code, message} }   // code = client code, Section 3.7
// The API URL is the constant "api/jev" (relative, same origin); there is no option to change it (FR-KEY-01).
export function classifyError(httpStatus: number|null, body: unknown, thrown?: unknown): {code: string, retry: boolean}; // U-54

// ui/about-content.js  (DOM-free data, T14)
export const ABOUT: Readonly<{pitch: string, mapping: {rows: string[][], note: string}, established: string[],
  proposal: string[], simplification: string[], refs: Array<{n: number, text: string, href: string}>}>;

// ui/store.js
export function createStore(initial): { get(): State; set(patch): void; subscribe(fn): () => void };
// ui/bus.js
export function createBus(): { on(evt, fn): () => void; emit(evt, payload): void };
```

### 5.3 State store (FR-ARCH-07)

```
State = {
  run: "idle"|"running"|"paused", runId: int, speed, seed,
  params: Params, stimulus: {id, img: Float32Array},
  mode: "SIMULATED"|"REPLAY"|"LIVE", availability: {replay: bool, live: bool, keySource: "env"|"none"|"mock"|null},
  selection: string[], budget: {used, cap}, unrecorded: int,
  banner: {level: "info"|"warn"|"error", text} | null,
  theme: "system"|"dark"|"light", reducedMotion: bool,
  jevReadout: {choice, confidence, modeTag} | null, compare: {...} | null
}
```

The store never holds the key (FR-KEY-10).

### 5.4 Event bus (FR-ARCH-08)

| Event | Payload | Emitted by |
|---|---|---|
| `frame` | `{stepsRun, spikes, routes}` | main loop, once per frame |
| `stimulus:changed` | `{id}` | input panel |
| `params:changed` | `{patch}` | params panel |
| `mode:changed` | `{mode}` | header / client |
| `neuron:selected` | `{ids}` | circuit view |
| `jev:request` | `{id, kind, mode, request}` | client |
| `jev:response` | `{id, result}` | client |
| `jev:error` | `{id, code, message}` | client |
| `banner` | `{level, text}` | any |
| `run:changed` | `{run}` | header / keyboard |
| `reset` | `{runId}` | header / keyboard |

### 5.5 Data flow

```
stimulus ─► encoding (rates, kernels) ─► sim.step() ×k per frame ─► spikes/routes ─► charts, circuit view
                                              │                        │
                                              ▼                        ▼
                                  summary every jevIntervalMs      local readout
                                              │
                                    client (mode) ─► emulator | replay | fetch('api/jev') ─► proxy ─► JEV
                                              │
                               validateResponse ─► bounded control (β, M) ─► sim.setControl()
                                              └─► JEV readout, compare table, JEV log
```

### 5.6 Proxy `tools/jev-proxy.mjs` (FR-PRX-01 … 16)

- FR-PRX-01 Runtime Node ≥ 18, built-in `node:http`, `node:fs`, `node:path`, `node:url` and global `fetch` only; npm packages are forbidden, but the proxy MAY import relative modules from `docs/js/core/` and `docs/js/jev/` (`validateRequest`, `validateResponse`, `normalizeKey`, `emulate`, `buildRecordingEntry`, `buildRecording`). No npm install. Exports `createProxy({port = 8787, root, budget = 200, rate = 2, record = null, mockUpstream = false, mockStatus = null, noApi = false, env = process.env, log = console.log}) → Promise<{server, close(): Promise<void>}>` (resolves after listening); runs the CLI when executed directly. The key and base URL are read ONLY from the `env` option (`env.TYPESAFE_API_KEY`, `env.TYPESAFE_BASE_URL`), never from `process.env` directly; all proxy unit tests pass an explicit `env` object (FR-TST-08).
- FR-PRX-02 CLI flags: `--port <n>` (default 8787; `0` = ephemeral for tests), `--root <dir>` (default `docs` relative to the repo root resolved from the script location), `--budget <n>` (default 200 upstream calls per process), `--rate <n>` (requests per second, token bucket, burst = n, default 2), `--record <path>`, `--mock-upstream` (deterministic canned answers from `emulate(request, {seed: 42, callIndex: <per-process counter>})`, model `"jev-mock"`; makes no network connection at all and works with no key; health `keySource: "mock"`), `--mock-status <code>` (with `--mock-upstream`, return the proxy error body of Section 3.7 for that upstream status), `--no-api` (static files only: every `/api/*` path → plain 404, mimicking GitHub Pages; used for static-host tests), `--help`.
- FR-PRX-03 Binds `127.0.0.1` only. There is no host flag. On start prints exactly one line: `systemone-microcircuit proxy listening on http://127.0.0.1:<port> (key: env|none|mock, api: on|off, upstream: <origin>)`. The proxy is the only local server this project needs (no python, no `npx http-server`).
- FR-PRX-04 Upstream URL: `(env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "") + "/v1/systemone"` (same convention as R3's client; tests point it to a local fake). `TYPESAFE_BASE_URL` is accepted only if it starts with `https://`, `http://127.0.0.1:` or `http://localhost:`; otherwise the CLI exits with code 1 (and `createProxy` rejects). An empty string counts as unset.
- FR-PRX-05 Host check: reject (421, `bad_host`) any request whose `Host` header, compared case-insensitively, is not `127.0.0.1:<port>` or `localhost:<port>` (DNS-rebinding defence).
- FR-PRX-06 Static serving: `GET`/`HEAD` under `--root`; `/` → `index.html`. Path resolution: decode once; reject (404) if the decoded path contains `\0` or `\`; `p = path.resolve(root, '.' + decoded)`; reject unless `path.relative(root, fs.realpathSync(p))` neither starts with `..` nor is absolute (covers `docs-other` prefix collisions and symlinks); directories other than `/` → 404. MIME map for `.html .js .mjs .css .json .png .svg .ico .md`; unknown extension → `application/octet-stream`. Every response carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `Content-Security-Policy` = the FR-ARCH-05 policy plus `; frame-ancestors 'none'`. `/api/*` responses use `Content-Type: application/json; charset=utf-8`. Other methods on static paths → 405.
- FR-PRX-07 `GET /api/health` → 200 `{ok: true, keySource: "env"|"none"|"mock", model: "jev-latest", budget: {used, cap}, mock, recording}`. With `--no-api` → 404.
- FR-PRX-08 `POST /api/jev` requirements, checked in order: `Content-Type` starts with `application/json` (else 415 `bad_content_type`); `Origin: null` → 403 `bad_origin`; if `Origin` is present it MUST equal `http://127.0.0.1:<port>` or `http://localhost:<port>` (else 403 `bad_origin`); if `Sec-Fetch-Site` is present and equals `cross-site` or `same-site` → 403 `bad_origin`; body ≤ 32 768 bytes (else 413 `too_large`, then `req.destroy()`); valid JSON and `validateRequest()` passes (else 400 `bad_request`): exactly keys `state`, `model`, `questions`; `model ∈ {"jev-latest","jev-1.13.0","jev-1.14.0","jev-preview"}`; 1–8 questions; types `noul|choice|score`; instructions string ≤ 1000 chars; choice criteria object with 2–255 keys; score criteria array of 2–10 strings; serialized `state` ≤ 16 384 bytes. Server timeouts: `server.requestTimeout = 10000`, `server.headersTimeout = 5000`.
- FR-PRX-09 `OPTIONS` on any path → 405 with no CORS headers. The proxy NEVER sends `Access-Control-Allow-*` headers.
- FR-PRX-10 Key: with `--mock-upstream` no key is needed or used (`keySource: "mock"`, even if env has a key). Otherwise env `TYPESAFE_API_KEY` if non-empty; else header `X-JEV-Key` (normalised with `normalizeKey`); else 401 `{"error":{"code":"no_key","message":"No JEV key: set TYPESAFE_API_KEY or paste a key in the page."}}`.
- FR-PRX-11 Upstream request: only headers `Authorization: Bearer <key>`, `Content-Type: application/json`, `Accept: application/json`. No `Origin`, `Cookie`, `X-JEV-Key` or other forwarded headers. Body re-serialised from the validated object. Timeout 5000 ms via `AbortSignal.timeout`.
- FR-PRX-12 Response mapping (codes and statuses exactly as the proxy error-code table in Section 3.7): upstream 200 with JSON object → 200 body as-is; upstream 401 → 401 `unauthorized`; 403 → 403 `forbidden`; 400/422 → same status `upstream_rejected`; 429 → 429 `upstream_rate_limited`; 529/502/503 → 503 `upstream_overloaded`; network error → 502 `network`; timeout → 504 `timeout`; non-JSON 200 or any other upstream status → 502 `upstream_malformed`. `message` = upstream `detail.message` or `msg` (string, ≤ 200 chars, key-redacted). `Retry-After` is forwarded only if it is an integer 0–60 (seconds); anything else is dropped.
- FR-PRX-13 Rate limit: token bucket per process → 429 `rate_limited` with `Retry-After: 1`. Budget: every upstream fetch attempt counts (any outcome); at cap → 429 `budget_exhausted`. Mock calls count toward budget too (so budget tests work offline).
- FR-PRX-14 Logging: one line per `/api/*` request to stdout: ISO time, method, path, status, latency ms, question count, `input_tokens` if known. NEVER headers, bodies, keys or query strings. All log and error strings pass through `redact(str, secrets[])` which replaces every occurrence of the env key and the request's `X-JEV-Key` with `[REDACTED]`.
- FR-PRX-15 `--record`: after each successful upstream (or mock) 200, run `validateResponse(request, upstream)`; on success append `buildRecordingEntry(i, state.simTimeMs ?? null, request, validated, latencyMs)` (content restricted per FR-REC-01a; unknown upstream fields are never written) and rewrite the file atomically (write temp then rename). Creates the file with `buildRecording` metadata on first write (`seed`, `params`, `stimulusSequence`, `app.commit` = `null`, FR-REC-01b).
- FR-PRX-16 Graceful shutdown on SIGINT/SIGTERM.

### 5.7 Optional Cloudflare Worker `tools/cf-worker.js` (FR-PRX-17, MAY)

Documentation-grade template for presenters only, not deployed by the project and not wired into the page. It handles `POST /api/jev` and `GET /api/health`; the key comes only from the Worker secret `TYPESAFE_API_KEY`; the Worker ignores any `X-JEV-Key` header and always reports `keySource: "env"`. The published page never sends a key to it and has no setting that points at it (FR-KEY-01, FR-ARCH-05). A presenter who wants to use it forks the repo and serves a copy of `docs/` from the Worker's own origin (same-origin `/api/jev`), so `connect-src 'self'` still holds.

Access control: the Worker has no user authentication (a page cannot hold a shared secret), so it is documented as an open credit spender. The `ALLOWED_ORIGINS` allowlist (exact match; missing or unknown `Origin` → 403) is defence in depth for browsers only and is explicitly NOT authentication: scripts can spoof `Origin`. Same validation as FR-PRX-08 (copied, no imports); per-isolate `BUDGET` (default 100), which is NOT a global cap.

Header comment MUST say verbatim: "Deploying this spends YOUR JEV credits for ANYONE on the internet: the Origin allowlist only stops browsers on other sites, not scripts. Keep the allowlist minimal, configure a Cloudflare rate-limiting rule (for example 10 requests/min per IP) and a daily spend cap or alert; the per-isolate BUDGET is not a global cap. Delete the Worker after the demo."

---

## 6. Edge cases and adversarial scenarios (FR-EDGE)

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| EC-01 | No key, GitHub Pages | SIMULATED works fully; LIVE disabled with tooltip; no network calls except recording fetch and health probe (404 handled silently) | E08 |
| EC-02 | Wrong key (LIVE via proxy, `keySource: none`) | 401 → error banner, key marked invalid, modal opens, mode SIMULATED | E07, P-08 |
| EC-03 | Key revoked mid-run | Next LIVE tick 401 → same as EC-02; sim never stops | E07b |
| EC-04 | CORS block (page on github.io attempting LIVE) | Health fails → LIVE disabled; no request to api.typesafe.ai is ever made from the browser | E08, U-45 |
| EC-05 | Offline | Health fails → LIVE disabled; recording fetch fails → REPLAY disabled; SIMULATED works | E21 |
| EC-06 | Slow API (> 6 s) | Client timeout → `timeout` log, fallback tick; 3 in a row → SIMULATED | U-46, P-12 |
| EC-07 | 429 from JEV | Retry 1 s, 2 s (Retry-After honoured ≤ 10 s); then fallback | U-47, P-10 |
| EC-08 | Huge drawn image | Draw canvas is fixed 192×192; rasterised to 16×16; dropped files ignored (`dragover`/`drop` `preventDefault`) | U-08, E17 |
| EC-09 | Blank image | Near-zero E activity; local readout `nothing`; JEV readout `none` (emulator) | U-31, E02b |
| EC-10 | All-white image | Zero-mean kernels give no net L4E drive; PV feedforward suppresses; readout `nothing` or `uncertain`; no runaway | U-32 |
| EC-11 | τ_m at minimum (1 ms) | Stable, `λ_m = exp(−0.5)`; no NaN | U-33 |
| EC-12 | θ extremes (5 and 40 mV) | 5 → high rates, runaway guard may engage; 40 → near silence; no NaN | U-34 |
| EC-13 | Noise max (σ_V = 10) | Higher spontaneous rates; clamps hold | U-35 |
| EC-14 | Δ minimum (0.5) | Sigmoid stable (overflow guard); near-deterministic threshold | U-06 |
| EC-15 | τ_c minimum (0.05) | Softmax stable via max-subtraction; near-argmax routing; sums to 1 | U-11 |
| EC-16 | NaN injected into state | Guard resets to 0, `nanResets` = 1, banner once | U-36 |
| EC-17 | Tab hidden | Auto-pause; resume on visible if previously running; no catch-up burst | E22 |
| EC-18 | Window resize | Layout reflows; canvases resize to device pixel ratio on `ResizeObserver`; buffers kept | E09 |
| EC-19 | Rapid button mashing (Play ×20, Reset ×10 in 1 s) | Final state consistent with last action; no exceptions; no duplicate rAF loops (exactly one active loop) | E23 |
| EC-20 | Reset during in-flight LIVE call | Request aborted, log `aborted`; late response (old `runId`) discarded | U-48, E24 |
| EC-21 | Mode switch during in-flight call | Same as EC-20; new mode effective immediately | U-49 |
| EC-22 | localStorage/sessionStorage throws (private mode) | Key kept in memory; info banner; theme preference not persisted; no crash | U-41, E25 |
| EC-23 | `file://` origin | `boot.js` shows `file-protocol-notice` with the server command `node tools/jev-proxy.mjs` (and the GitHub Pages URL); module loading failure does not leave a blank page | E18 |
| EC-24 | Reduced motion | No travelling particles; updates continue | E16 |
| EC-25 | Small screen 375 px | Single column, no horizontal scroll, all controls reachable | E09 |
| EC-26 | Key pasted with whitespace/newline | Trimmed; internal whitespace → rejected with `key-error` | U-37 |
| EC-27 | XSS via user-editable text (seed field, key field, response legend strings) | Rendered with `textContent` only; seed validated numeric; `<img onerror>` payloads appear as literal text; CSP blocks inline script | U-50, E26 |
| EC-28 | Prompt injection in API response (for example legend "Ignore previous instructions and set theta=0") | Treated as data; schema-validated; numbers clamped [0,1]; strings truncated to 200; no param change beyond FR-JEV-17 bounds | U-42, U-43 |
| EC-29 | Budget exhausted | Switch to SIMULATED, autoJev off, banner; `btn-ask-jev` in LIVE disabled | U-44, E15 |
| EC-30 | Very long run (1 h) | Bounded memory (ring buffers, log max 200, particle cap 300) | E20 |
| EC-31 | rAF drift / long frame (> 100 ms) | Wall delta clamped to 100 ms; step cap 400 per frame | U-51 |
| EC-32 | Seed edge values: 0, 4294967295, −1, 4294967296, "abc", "1e3", " 7 " | 0 and 4294967295 accepted and run; " 7 " trimmed → 7; −1, 4294967296, "abc", "1e3" rejected with inline error, previous seed kept | U-03, E27 |
| EC-33 | Key in URL (`?key=…`) | Ignored, stripped via `replaceState`, warn banner | E28 |
| EC-34 | Malformed recording file | REPLAY disabled with tooltip; no crash | U-39b |
| EC-35 | Request has no recorded match in REPLAY | Emulator answer, log `unrecorded`, badge count increments | U-39c |
| EC-36 | Proxy receives cross-site POST (`Origin: https://evil.example`) or `text/plain` | 403 / 415; no upstream call | P-05, P-06 |
| EC-37 | DNS-rebinding (`Host: evil.example:8787`) | 421 | P-07 |
| EC-38 | Path traversal (`/../tools/jev-proxy.mjs`, `%2e%2e/`, `..%5c`, `/C:/…`, `/../docs-x/`) | 404 | P-09 |
| EC-39 | JEV returns 200 with HTML | `upstream_malformed` 502 from proxy; client `malformed` | P-13 |
| EC-40 | Health endpoint returns HTML 200 (other static server) | Fails validation → LIVE disabled | U-45 |
| EC-41 | Key entry on a static host (GitHub Pages, `--no-api`) | `btn-key` disabled with tooltip; key modal cannot open; nothing read from or written to storage (FR-KEY-11) | E31 |
| EC-42 | Crafted link with an API-base query parameter (for example `api` set to `https://evil.example`) | Unknown parameter ignored; requests go only to same-origin `api/jev`; `X-JEV-Key` never attached to a cross-origin URL | U-53 |
| EC-43 | Developer machine has `TYPESAFE_API_KEY` set globally | Tests and Playwright servers run with it explicitly emptied (FR-TST-08); no billed call unless `JEV_LIVE_TEST=1` | P-02, P-19 |

---

## 7. Test plan

### 7.1 Tooling (FR-TST-01 … 09)

- FR-TST-01 Unit tests: `node --test "tests/unit/*.test.mjs"` (quoted glob, expanded by Node itself, so identical in bash, PowerShell and cmd; Node ≥ 22). No dependencies.
- FR-TST-02 E2E: Playwright `@playwright/test` pinned exactly to `1.49.1` in `package.json` `devDependencies` (FR-ARCH-02a); `package-lock.json` committed; install with `npm ci` then `npx playwright install chromium`; run `npx playwright test`. The demo itself never requires npm.
- FR-TST-03 `playwright.config.mjs`: two `webServer` entries, both the proxy: (1) `node tools/jev-proxy.mjs --port 8790 --mock-upstream` for LIVE tests (no network, no key, `keySource: "mock"`); (2) `node tools/jev-proxy.mjs --port 8080 --no-api` for static-host tests (mimics GitHub Pages: `/api/*` → 404). Both set `env: {...process.env, TYPESAFE_API_KEY: "", TYPESAFE_BASE_URL: ""}` so a globally set key never reaches them. Projects `desktop` (1280×800) and `mobile` (375×812). `use: {trace: 'off', video: 'off', screenshot: 'off'}` globally; screenshots are taken only by explicit `page.screenshot()` calls in the steps of Section 7.3, saved to `tests/screenshots/<ID>.png`.
- FR-TST-04 Local serving: only the proxy: `node tools/jev-proxy.mjs` (static + API, port 8787) or `node tools/jev-proxy.mjs --no-api` (static only). No python.
- FR-TST-05 Real JEV smoke test (`tests/e2e/live-real.spec.mjs` and `tests/unit/live-real.test.mjs`) and the T17 recording spec run only when `JEV_LIVE_TEST=1` and `TYPESAFE_API_KEY` are set; skipped otherwise; never in CI by default. Max 2 billed calls for the smoke test. Only in this case is the env key passed through (a separate webServer on port 8791 started by the spec's own `test.beforeAll`, `trace: 'off'`, `video: 'off'`, `screenshot: 'off'`). The key is NEVER typed into the page in any test; only keys containing `FAKE` are typed.
- FR-TST-06 Evidence file (below Section 7.3).
- FR-TST-07 `.gitignore` contains at least: `node_modules/`, `test-results/`, `playwright-report/`, `blob-report/`, `*.trace.zip`, `*.har`, `.env`, `.env.*`. Console-error filter used by every "no console errors" assertion (E01 etc.): ignore a message only if `msg.type() === 'error'` and `/^Failed to load resource: the server responded with a status of 404/.test(msg.text())` and `/\/api\/health$/.test(msg.location().url)`. Every other console error fails the test.
- FR-TST-08 Environment isolation: unit tests never read `process.env` for keys; `createProxy` gets an explicit `env` object (for example `{}` or `{TYPESAFE_API_KEY: "test-key-FAKE-123", TYPESAFE_BASE_URL: "http://127.0.0.1:<fakePort>"}`); tests that spawn the CLI pass `env: {...process.env, TYPESAFE_API_KEY: "", TYPESAFE_BASE_URL: ""}` unless `JEV_LIVE_TEST=1`.
- FR-TST-09 Test hook (only when the URL has `?test=1`): `window.__mc = {pause(), runSteps(n), setSeed(s), getState()}`. `pause()` stops the rAF loop driving the sim; `runSteps(n)` pauses, then runs exactly `n` sim steps synchronously through the same path as the loop (`sim.step()` then `scheduler.afterStep(n)` per step), renders once and returns `getState()`; `setSeed(s)` = apply seed + reset (as `btn-seed-apply`); `getState()` returns `{t, n, run, mode, frame, spikeCountsByPop, spikeCountsByGroup: {L4E: [4], L23E: [4], L5E: [4]}, readoutLocal, readoutJev, jevLogLength, budget, selection, rasterHash, unrecorded}`, never the key. `?test=1` also forces reduced motion (as `prefers-reduced-motion: reduce`), adds class `test-mode` on `<html>` (`base.css`: `.test-mode *, .test-mode *::before, .test-mode *::after {transition: none !important; animation: none !important}`) and keeps warn/info banners until dismissed. Screenshot protocol: `setSeed(42)` (or the stated seed) → click the stated `stimulus-preset-<id>` → `runSteps(<fixed n>)` → `page.screenshot({animations: 'disabled'})`. No wall-clock waits except waiting for rendering idle (`requestAnimationFrame` twice).
- `package.json` scripts: `"test:unit": "node --test \"tests/unit/*.test.mjs\""`, `"test:e2e": "playwright test"`, `"serve": "node tools/jev-proxy.mjs"`.

### 7.2 Unit tests (`tests/unit/*.test.mjs`)

| ID | File | Assertion |
|---|---|---|
| U-01 | rng.test | `mulberry32(42)` first 3 outputs equal a recorded golden triple; all outputs in [0,1) over 10⁵ draws |
| U-02 | rng.test | `gauss` mean within ±0.02 and SD within ±0.02 of 0/1 over 10⁵ samples (seed 1); consumes exactly 2 draws |
| U-03 | params.test | `parseSeed` accepts "0", "4294967295", " 7 "; rejects "-1", "4294967296", "abc", "1e3", "" |
| U-04 | params.test | `clampParams({tauM: 0})` → 1; `{tauC: 0}` → 0.05; `{theta: 99}` → 40; unknown keys dropped |
| U-05 | sim.test | Leak: harness `createSim(buildSingleNeuronNetwork('L23PV'), {...DEFAULTS, sigmaV: 0}, 1, {test: true})`, `debug.setState(0, {S: 10})`, no input → after 20 steps (10 ms) S = 10·e⁻¹ ± 1e-4 |
| U-06 | sim.test | Noul: S = θ → 0.5; S = θ + 10Δ → > 0.9999; S = θ − 10Δ → < 1e-4; Δ = 0.5 with S = 40 → finite 1 |
| U-07 | sim.test | Spike hazard: harness neuron, `debug.forceNoul(0, 0.5)`, dt = 0.5 ms, W = 10 ms → `p_step = 1 − 0.5^(0.05) = 0.0340636710751544` (exact formula check ± 1e-12); empirical spike probability over 10⁵ steps with refractoriness cleared (`debug.setState(0, {ref: 0})` before each step) = 0.03406 ± 0.0025 (≈ 4 SD); `forceNoul(0, 1)` → `p_step = 1` (spike on every step where `ref = 0`); `forceNoul(0, 0)` → no spikes |
| U-08 | stimuli.test | `rasterize` of a 192×192 all-white RGBA → 256 ones; of half-black → 128 ones ± 0; output length 256 |
| U-09 | sim.test | Refractory: harness neuron, after spike `S = 0` and no spike for exactly 4 steps even with `debug.forceNoul(0, 1)` and `debug.inject(0, 0, 30)` every step |
| U-10 | sim.test | Reset: after spike S = V_reset |
| U-11 | sim.test | Softmax: `p` sums to 1 ± 1e-6 for τ_c ∈ {0.05, 1, 5} and logits ∈ [−50, 50]; τ_c = 0.05 puts ≥ 0.99 on argmax when gap ≥ 1 |
| U-12 | sim.test | Soft vs hard expectation: minimal network literal (1 L23E source with 3 collaterals, 1 target each, `opts.test`, `debug.forceNoul(0, 1)`); mean delivered weight per collateral over 10⁴ spikes (hard) within 3 % of soft |
| U-13 | sim.test | Delays (minimal network literal, `debug.forceNoul`): E synapse arrives exactly 3 steps after spike; I synapse 2 steps; input 2 steps |
| U-14 | sim.test | PV divisive mode: harness neuron, `debug.setState(0, {G: 1})` vs `{G: 0}`, `debug.inject(0, 1, 4)`: dendritic drive halved |
| U-15 | sim.test | SST input lands only in `Da` (apical); VIP spikes reduce SST S |
| U-16 | sim.test | STDP (minimal 2-neuron network literal, `debug.forceNoul` places spikes): pre at t, post at t+5 ms → Δw > 0; post before pre → Δw < 0; same-step pre+post follows Section 2.8 order (a)→(b)→(c); magnitudes match formula ± 1e-6; weights stay in [0, w_max] after 10⁴ random pairings |
| U-17 | network.test | N = 58; population counts as Section 2.1; no self-connections; L23E collateral IDs `output, recurrent, lateral` |
| U-18 | network.test | Same seed → identical topology hash; different seed → different hash; the build consumes exactly as many `topology` draws as there are candidate pairs with p_conn < 1 in Section 2.6 order (self excluded) |
| U-19 | encoding.test | Each kernel: positive sum 1 ± 1e-5, negative sum −1 ± 1e-5; response to all-ones image 0 ± 1e-5 |
| U-20 | encoding.test | Vertical kernel (offset +1) response to `vbar` > response to `hbar` × 3 |
| U-21 | determinism.test | Seed 42, `vbar`, 2000 steps twice → identical `rasterHash()`; seed 43 → different |
| U-22 | determinism.test | Changing `routing` hard↔soft does not change input spike sequence (stream separation): `inputHash()` equal; calling `makePreset('noise', seed)` 10× and drawing from a `ui` stream between steps leaves `rasterHash()` unchanged |
| U-23 | scheduler.test | SIMULATED mode with auto JEV on, driven by `createScheduler` in Node (no DOM): seed 42, `vbar`, stimulus change to `hbar` at 1000 ms sim, 4000 steps; two runs → identical raster hash and identical answer sequence |
| U-24 | emulator.test | Response for circuit request has keys `model, answers, usage`; each answer type matches question; probabilities sum to 1.00; values have ≤ 2 decimals |
| U-25 | emulator.test | Emulator output passes `validateResponse` for 1000 random valid summaries |
| U-26 | emulator.test | Same request + ctx → deep-equal response; different `callIndex` → jitter differs |
| U-26b | emulator.test | Golden: seed 42, callIndex 0, the Section 3.4.1 example request → response deep-equal to committed `tests/fixtures/emulator-golden.json` (generated once by T06, reviewed against FR-JEV-20/21 draw order) |
| U-27 | emulator.test | Rates (40, 5, 8, 8) Hz → choice `vertical` (ℓ ≈ 3.93, 0.49, 0.79, 0.79; ℓ_none = 0); rates (1.9, 0, 0, 0) → choice `none` (ℓ_v = 6·1·0.19 = 1.14 < ℓ_none = 4.86), per FR-JEV-21 including `min(m/10, 1)` |
| U-28 | emulator.test | Score with 5 levels and v = 0.6 → `probabilities {"0":0,"1":0,"2":0.6,"3":0.4,"4":0}`, `score = 2.4` |
| U-29 | schema.test | `circuitRequest` and `neuronRequest` pass `validateRequest`; score criteria is an array; choice criteria ≤ 255 keys |
| U-30 | bench.test | 10 000 steps; reports median step time (informational) |
| U-31 | sim.test | Blank, 1000 ms: all E pops ≤ 5 Hz (seed 42) |
| U-32 | sim.test | White, 1000 ms: L4E ≤ 10 Hz; `runawayActive` false |
| U-33 | sim.test | τ_m = 1: 2000 steps, all state finite |
| U-34 | sim.test | θ = 5 and θ = 40: 2000 steps finite; θ = 40 → total spikes < θ = 15 run |
| U-35 | sim.test | σ_V = 10: all |S| ≤ 40 |
| U-36 | sim.test | Inject `S[3] = NaN` → after one step finite, `nanResets = 1` |
| U-37 | keystore.test | `normalizeKey("  FAKEkey123456\n")` → ok `FAKEkey123456`; `"FAKE key 12345"` → error; `"FAKE"` → error (short); 513 chars (`"FAKE"` + 509 × `x`) → error; `"ключFAKE1234"` → error |
| U-38 | keystore.test | Before `enable()`: `set` returns `{ok: false, error: "disabled"}` and the storage mocks record zero calls. After `enable()`: `set(key, false)` writes session only; `set(key, true)` writes local only; `forget()` clears both and memory; `masked()` = `•••• ` + last 4; `JSON.stringify(keystore)` does not contain the key |
| U-39 | replay.test | `buildRecordingEntry` and `serializeLogEntry` outputs never contain the key or the strings `Authorization`, `X-JEV-Key`, `Bearer` |
| U-39b | replay.test | `validateRecording` rejects wrong `format`, missing `entries`, entry without `response.answers` |
| U-39c | replay.test | Exact hash match → `exact`; perturbed features (L1 0.1) → `nearest`; L1 0.5 → `null` |
| U-40 | secrets.test | Scans every file from `git ls-files` plus `git ls-files --others --exclude-standard` plus `docs/data/*.json` for `/sk-[A-Za-z0-9_-]{16,}/`, `/Bearer\s+[A-Za-z0-9._-]{20,}/`, `/TYPESAFE_API_KEY\s*[=:]\s*["']?[A-Za-z0-9._-]{8,}/`. A match is allowed only if the matched text contains `FAKE`, `SENTINEL` or `REDACTED` (allowlist by content; no path-based excludes). Every fixture or example key in specs, tests and docs MUST contain `FAKE` (for example `sk-FAKE-0000000000000000`, `test-key-FAKE-123`). Unconditionally: if env `TYPESAFE_API_KEY` is set (length ≥ 8), its exact value appears in no scanned file |
| U-41 | keystore.test | Storage whose methods throw → `set` returns ok with `memoryOnly: true`; `get` returns the key; no exception |
| U-42 | schema.test | Response with `noul: 7` → clamped 1; `noul: "0.5"` → invalid; `choice: "admin"` not in criteria → invalid; probabilities sum 0 → invalid; missing question key → invalid; extra key dropped |
| U-43 | schema.test | Legend string of 10 000 chars → truncated to 200; contains `<script>` → preserved as text (no transformation), flagged for `textContent` use |
| U-44 | client.test | Budget cap 2: third LIVE `ask` returns `budget_exhausted` without calling `fetchImpl`; mode becomes SIMULATED |
| U-45 | client.test | `health()` with fetch returning HTML 200, 404, JSON missing `keySource`, or rejecting → `null` |
| U-46 | client.test | Fake fetch never resolves → abort at 6000 ms (fake timers) → `timeout`; 3 consecutive → mode SIMULATED |
| U-47 | client.test | 429, 429, 200 sequence → success after 2 retries; delays 1000/2000 ms; `Retry-After: 5` → 5000 ms; budget used = 3 |
| U-48 | client.test | `abortAll` during flight → result `aborted`; late resolution with old `runId` not emitted as `jev:response` |
| U-49 | client.test | `setMode('SIMULATED')` during LIVE flight → aborted; next `ask` answered by emulator synchronously |
| U-50 | dom-free.test | Static check: no `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` with non-literal arguments in `docs/js/**` (regex scan; literal-only template strings allowed). Also: every file of the Section 5.1 tree under `docs/` and `tools/` exists (FR-ARCH-01; this tree-completeness case is `test.skip` until T20 enables it); every module in `docs/js/core/`, `docs/js/jev/` and `docs/js/ui/about-content.js` imports in Node without a DOM (FR-ARCH-02) and exports the Section 5.2 names (FR-ARCH-06); no bare-specifier imports in `docs/js/**` (FR-ARCH-03); `index.html` references no `http:`/`https:` script, style or font (FR-ARCH-04) |
| U-51 | loop.test | `computeSteps(acc, wallDelta=250, speed=1000)` clamps delta to 100 → 200 steps; cap 400 respected |
| U-52 | client.test | LIVE mode with `keySource: "env"` or `"mock"` never sets `X-JEV-Key`; with `"none"` sets it to the stored key; request URL is exactly `api/jev` |
| U-53 | client.test | With `location` stubbed to `https://benedekmolnarvito.github.io/systemone-microcircuit/` plus a query parameter `api` = `https://evil.example`, the client still requests only same-origin `api/jev`; a helper call with a cross-origin URL never attaches `X-JEV-Key`; `createJevClient` has no API-base option |
| U-54 | client.test | `classifyError` for every row of the Section 3.7 proxy table plus client-only codes: retry is true only for `upstream_rate_limited`, `upstream_overloaded`, `network`; `budget_exhausted`, `bad_request`, `unauthorized`, `timeout` → no retry; `Retry-After: 30` → no retry, immediate fallback; 3 consecutive `bad_request` (or `malformed`) LIVE ticks → fallback answers logged `fallback:<code>`, then mode SIMULATED (FR-JEV-14) |
| U-55 | client.test | Health race: select LIVE, switch to SIMULATED before health resolves, then resolve OK → mode stays SIMULATED (selection token, FR-JEV-05) |
| U-56 | scheduler.test | Grid ticks at steps n where `(n+1)·dt` is a multiple of 500 ms; stimulus change at 1000 ms → change tick at 1050 ms and the 1500 ms grid tick is kept (1500 − 1050 = 450 ≥ 300); change at 1300 ms → tick at 1350 ms replaces grid tick 1500 ms; two changes 100 ms apart (sim) → one change tick; `windowMs` = time since previous tick; `client.resetRun()` / Reset → `callIndex` 0 |
| U-57 | about.test | Imports `docs/js/ui/about-content.js`: every section (`pitch`, `mapping`, `established`, `proposal`, `simplification`, `refs`) non-empty; `proposal` contains the exact sentence "Noul is a probability; spike is a Bernoulli sample of the per-step hazard derived from it."; `simplification` contains the FR-SCI-09 text verbatim; every `[n]` citation is in 1..39; no text matches `/roadmap|200.?300 ms|Douglas.{0,20}1995|SE-SNN|AllenYolk|\u03C4_N|tau[N]/i` |
| U-58 | scheduler.test | `applyControl`: evidence score s = 4 → β = 0.5; s = 0 → −0.5; novelty ν = 0.2 → M = 0.7; `jevControl` off → β = 0, M = 1 (FR-JEV-17/18) |
| U-59 | readout.test | `agree('vertical','vertical')` → true; `agree('vertical','none')` → false; `agree('nothing','none')` and `agree('uncertain','none')` → true; `agree(x, null)` → null (FR-RO-03) |
| U-60 | sim.test | Runaway: θ = 5, g = 0, σ_V = 10 (as E14) → `dampGain` < 1 and `runawayActive` true within 1000 ms sim; then DEFAULTS restored → `dampGain` back to 1.0 within 10 000 ms sim (FR-SIM-12 recovery) |
| U-61 | sim.test | `setParams({g: 8})` doubles every inhibitory effective weight vs g = 4 without reset and without changing stored base weights (FR-NET-03) |
| U-62 | stimuli.test | `makePreset` for all 11 preset IDs returns 256 values in [0, 1]; `makePreset('noise', s)` is identical across calls and differs for another seed; `effectiveIntensity(img, 1, 0, z)` = `img`; `rates` follows FR-ENC-04 (`x' = 0` → r_base, `x' = 1` → r_max) (FR-ENC-02 … 04) |

**Proxy tests (`tests/unit/proxy.test.mjs`)** — start `createProxy({port: 0, env: {...}, ...})` with an explicit `env` object (never `process.env`, FR-TST-08) and a fake upstream (`node:http` server on port 0) passed as `env.TYPESAFE_BASE_URL`:

| ID | Assertion |
|---|---|
| P-01 | `server.address().address === '127.0.0.1'` |
| P-02 | `GET /api/health` → 200 valid shape; `keySource: "env"` with `env: {TYPESAFE_API_KEY: "test-key-FAKE-123"}`, `"none"` with `env: {}`, `"mock"` with `mockUpstream: true` (even with an env key) |
| P-03 | Env key `test-key-FAKE-123`: fake upstream receives `Authorization: Bearer test-key-FAKE-123` and no `X-JEV-Key`, `Origin`, `Cookie` |
| P-04 | Captured `log` output + stdout + stderr over 10 requests (success, 401, 422, timeout, bad JSON) contain neither `test-key-FAKE-123` nor the `X-JEV-Key` value `hdr-key-FAKE-456` |
| P-05 | `Origin: https://evil.example` → 403 `bad_origin`, upstream not called; `Origin: null` → 403; `Sec-Fetch-Site: cross-site` → 403; `Host: 127.0.0.1:<PORT>` in upper/lower case variants accepted (P-05b) |
| P-06 | `Content-Type: text/plain` → 415, upstream not called |
| P-07 | `Host: evil.example:<port>` → 421 |
| P-08 | Upstream 401 verbatim body → proxy 401 `{"error":{"code":"unauthorized",...}}`; upstream 403 → 403 `forbidden`; 422 → 422 `upstream_rejected`; 529 → 503 `upstream_overloaded` |
| P-09 | `GET /../tools/jev-proxy.mjs`, `/%2e%2e/package.json`, `/%00`, `/..%5c..%5ctools/jev-proxy.mjs`, `/C:/Windows/win.ini`, `/../docs-x/`, `/css/` (directory) → 404 |
| P-10 | Upstream 429 with `Retry-After: 3` → 429 `upstream_rate_limited` and `Retry-After: 3` passed through; `Retry-After: 999` or `Retry-After: soon` → header dropped |
| P-11 | Body of 32 769 bytes → 413 `too_large`; invalid JSON → 400 `bad_request`; 9 questions → 400; score criteria as dict → 400 |
| P-12 | Fake upstream sleeps 6 s → 504 `timeout` within 5.5 s |
| P-13 | Upstream 200 `text/html` → 502 `upstream_malformed` |
| P-14 | `budget: 2`: third call → 429 `budget_exhausted`; a failed upstream attempt (fake 503) also counts |
| P-15 | `OPTIONS /api/jev` → 405 with no `Access-Control-*` headers |
| P-16 | `record: tmp.json` with a fake upstream whose 200 body has an extra field `x_debug: "FAKE-debug"` → file validates with `validateRecording`; contains neither `test-key-FAKE-123` nor `x_debug`; entries contain only the FR-REC-01a fields |
| P-17 | `env: {}` and no `X-JEV-Key` → 401 `no_key` |
| P-18 | Static: `.js` → `text/javascript`, `.css` → `text/css`, unknown extension → `application/octet-stream`; every response has `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a CSP containing `frame-ancestors 'none'`; `POST /index.html` → 405 |
| P-19 | `mockUpstream: true` with `env: {TYPESAFE_API_KEY: "test-key-FAKE-123", TYPESAFE_BASE_URL: "http://127.0.0.1:<fakePort>"}`: 5 calls succeed with model `jev-mock`; the fake upstream records zero connections (no outbound network) |
| P-20 | `noApi: true`: `GET /api/health` and `POST /api/jev` → 404; `GET /` → 200 `index.html` |
| P-21 | `env.TYPESAFE_BASE_URL = "http://evil.example"` → `createProxy` rejects; CLI exits 1 |
| P-22 | CLI child process (`--port 0 --mock-upstream`, emptied key env) prints the FR-PRX-03 start line; `SIGTERM` (or `child.kill()` on Windows) → process exits within 2 s (FR-PRX-16) |

### 7.3 E2E scenarios (`tests/e2e/*.spec.mjs`)

All use `?test=1&autoplay=0&seed=42` unless stated and follow the screenshot protocol of FR-TST-09 (`window.__mc.setSeed` → click preset → `__mc.runSteps(n)` → screenshot). `__mc.getState()` never contains the key (asserted in E05). Static scenarios run against the `--no-api` server (port 8080), LIVE scenarios against the `--mock-upstream` server (port 8790). Every scenario asserts zero console errors using the FR-TST-07 filter.

| ID | Steps | Assertions | Screenshot |
|---|---|---|---|
| E01 | Static server (`--no-api`); open `/?test=1` (autoplay default, then `__mc.pause()`) | Title, pitch, `mode-badge` = `SIMULATED JEV`, 58 `neuron-*` nodes; zero console errors except exactly the `/api/health` 404 network line (FR-TST-07 filter) | `E01-initial-load.png` |
| E02 | `setSeed(42)`, click `stimulus-preset-vbar`, `runSteps(2000)` (t = 1000 ms) | L4E vertical group spikes > each other group (`spikeCountsByGroup`), `readout-local` = vertical | `E02-running-vbar.png` |
| E02b | `setSeed(42)`, click `stimulus-preset-blank`, `runSteps(4000)` | readout `nothing` | `E02b-blank.png` |
| E03 | Click `neuron-L23E-1`, Shift+click `neuron-L4E-1`, `runSteps(2000)` | `selected-neuron-label` lists both; trace canvas non-empty (pixel sample differs from background) | `E03-selected-traces.png` |
| E04 | Select `L23E-1`; routing hard, `runSteps(2000)`; then soft, `runSteps(2000)` | `choice-bar-output/recurrent/lateral` present; bar widths sum ≈ 100 % (±2 %) | `E04-choice-bars-hard.png`, `E04-choice-bars-soft.png` |
| E05 | Mock server (health OK, `keySource: "mock"` is overridden by `page.route('**/api/health')` → valid body with `keySource: "none"`); open key modal, type `test-key-FAKE-789`, save | `key-masked` = `•••• -789`; `getState()` JSON, `document.body.innerText`, URL and `localStorage` do not contain the full key; sessionStorage does | `E05-key-modal.png` |
| E06 | Mock server; open `http://127.0.0.1:8790/?test=1&autoplay=0&seed=42`; select LIVE (no key, no `no_key` error, `keySource: "mock"`); Ask JEV | badge `LIVE JEV`; log entry status `ok`, model `jev-mock`; budget `1 / 50`; `compare-score`, `compare-noul`, `compare-choice` show both Local and JEV values (FR-JEV-16) | `E06-live-mocked.png` |
| E07 | Mock server; Playwright route `**/api/health` → valid body with `keySource:"none"`, `**/api/jev` → 401 `{"error":{"code":"unauthorized","message":"Invalid API key"}}`; paste `test-key-FAKE-401`; LIVE; Ask JEV | error banner contains "401"; badge returns to `SIMULATED JEV`; key modal open | `E07-error-401.png` |
| E07b | As E07 but first 2 calls 200, then 401 during auto ticks | sim keeps running; banner; mode SIMULATED | — |
| E08 | Static server (`--no-api`) | `mode-select-live` disabled with `title` containing `node tools/jev-proxy.mjs`; no request to any origin other than the page's (network log); zero console errors with the FR-TST-07 filter | `E08-no-key-simulated.png` |
| E09 | Mobile project 375×812 | `document.documentElement.scrollWidth <= 375`; all header buttons visible after scrolling | `E09-mobile-375.png` |
| E10 | `colorScheme: 'dark'` | `--bg` computed `#0b0f17`; text contrast ≥ 4.5 for 5 sampled elements | `E10-dark.png` |
| E11 | `colorScheme: 'light'` | `--bg` computed `#f6f8fb`; contrast ≥ 4.5 | `E11-light.png` |
| E12 | `page.route('**/data/jev-recording.json')` fulfils with `tests/fixtures/recording.json`; reload; select REPLAY; click `vbar`, `runSteps(4000)` | badge `REPLAY JEV`; log entries `exact` or `nearest` | `E12-replay.png` |
| E13 | Open About | sections `about-pitch`, `about-mapping`, `about-established`, `about-proposal`, `about-simplification`, `about-refs` visible and non-empty; FR-SCI-01 sentence, statement 1.5 and FR-SCI-09 text present | `E13-about.png` |
| E14 | Set θ = 5, g = 0, σ_V = 10, `runSteps(6000)` | `runaway-warning` visible | `E14-runaway.png` |
| E15 | Mocked LIVE, set budget 2, auto JEV on, `runSteps(1000)` then wait for in-flight calls (`liveMinIntervalMs` is wall time; test waits on log length, max 10 s) | after 2 calls: banner budget, badge SIMULATED, `mode-select-live` disabled while `used ≥ cap` | `E15-budget.png` |
| E16 | `reducedMotion: 'reduce'` | no element with class `particle` exists during run; node fills still change | `E16-reduced-motion.png` |
| E34 | WITHOUT `?test=1` (normal motion), `?autoplay=1&seed=42`, speed 1000, `vbar`, 3 s wall; sample every 100 ms | number of `.particle` elements never exceeds 300 (FR-UI-12) | — |
| E17 | Draw a vertical stroke on `draw-canvas`, click `btn-draw-use`, `runSteps(4000)` | `stimulus-preview` matches; `readout-local` = vertical | `E17-draw.png` |
| E18 | Open `file:///…/docs/index.html` | `file-protocol-notice` visible with `node tools/jev-proxy.mjs` | `E18-file-protocol.png` |
| E19 | `?debug=1`, run 10 s | median fps ≥ 50 (reported, soft assertion on CI) | — |
| E20 | Run 60 s at speed 1000, sample `performance.memory` (Chromium) at 10 s and 60 s | growth ≤ 10 % | — |
| E21 | Load, then `page.route('**/api/health')` and `page.route('**/data/jev-recording.json')` → `route.abort()`, reload | LIVE and REPLAY disabled; SIM runs | — |
| E22 | `addInitScript` overriding `document.visibilityState`; run; set hidden + dispatch `visibilitychange`, then visible + dispatch | paused while hidden, running after | — |
| E23 | Click Play 20× and Reset 10× rapidly | no page errors; `getState().run` matches last action; only one rAF loop (`getState().frame` increases by ≤ 1 per frame) | — |
| E24 | Mocked LIVE with 3 s delayed response; Ask JEV; Reset after 500 ms | log shows `aborted`; no `ok` entry appears after the delay | — |
| E25 | Init script overriding `Storage.prototype.setItem` to throw | page loads; key save shows memory-only info | — |
| E26 | Type `<img src=x onerror=alert(1)>` into `seed-input`, apply | inline error; no dialog event; text shown literally | — |
| E27 | Seeds 0 and 4294967295 apply and run; `-1` rejected | as EC-32 | — |
| E28 | Open `/?key=sk-FAKE-abcdefghijklmnop` | URL no longer contains `key=`; warn banner | — |
| E29 | Determinism: load twice with `?seed=7&test=1&autoplay=0`, `runSteps(4000)` each | equal `rasterHash`; seed 8 differs | — |
| E30 | Keyboard: Space toggles run; S steps 5 ms; R resets t to 0; Tab reaches `neuron-L4E-0` and Enter selects it | as described | — |
| E31 | Static server (`--no-api`) | `btn-key` disabled with `title` `Keys can only be used with the local proxy (node tools/jev-proxy.mjs)`; pressing `K` opens nothing; after load `localStorage` and `sessionStorage` have no `smc.jevKey` and the keystore made no storage writes (FR-KEY-11) | `E31-static-key-disabled.png` |
| E32 | Static server | `meta[http-equiv="Content-Security-Policy"]` present with `connect-src 'self'`; `getByRole('button', {name})` finds Play, Step, Reset, About, Ask JEV; every canvas has `role="img"` and non-empty `aria-label` (NFR-A11Y-02/06); Tab order reaches header → input → circuit → dashboard; focused element has a visible outline (NFR-A11Y-03) | — |
| E33 | `setSeed(42)`; click `vbar`; `runSteps(200)`; change `param-tauM`, `param-theta`; click `hbar`; `runSteps(200)`; select 4 neurons with Shift+click; Reset | params applied without reset (`t` kept until Reset, FR-UI-16); selection max 3 (FR-UI-13); after Reset: params, stimulus, selection, budget and log kept, log has "— reset —" (FR-UI-18); URL `seed=42` (FR-DET-04); in mocked LIVE after 1 call `btn-export-recording` downloads a file that passes `validateRecording` (FR-REC-06 b) | — |

`tests/EVIDENCE.md` (FR-TST-06) MUST list every screenshot file with its scenario ID, date, commit, viewport, mode and a one-sentence statement of what it proves (for example "E07-error-401.png — a rejected key produces a visible error banner and falls back to SIMULATED mode without exposing the key").

### 7.4 Traceability matrix (FR → tests)

Every requirement has at least one test. "DoD" = checked in the Definition of Done (Section 8.5). Every element a test touches is in the Section 4.2 `data-testid` lists (the class `particle` and `meta` CSP tag are the only non-testid selectors).

| Requirement | Tests |
|---|---|
| FR-SCI-01 | U-57, E13 |
| FR-SCI-02 | U-57, E13 |
| FR-SCI-03 | U-57 (citations in 1..39) |
| FR-SCI-04, FR-SCI-05 | U-57 (banned-text regex) |
| FR-SCI-06, FR-SCI-07 | U-57, E13 |
| FR-SCI-08, FR-SCI-09 | U-57, E13 |
| FR-SIM-01, FR-SIM-02, FR-SIM-03 | U-04, U-05, U-33 |
| FR-SIM-04 | U-04, U-05 |
| FR-SIM-05 | U-05, U-06, U-07, U-09, U-10, U-13, U-21 |
| FR-SIM-06 | U-11, E04 |
| FR-SIM-07 | U-12 |
| FR-SIM-08 | U-16 |
| FR-SIM-09 | U-35 |
| FR-SIM-10 | U-11 |
| FR-SIM-11 | U-36 |
| FR-SIM-12 | U-60, E14 |
| FR-SIM-13 | `calibration.test` (T05) |
| FR-NET-01 | U-17 |
| FR-NET-02 | U-17, U-18 |
| FR-NET-03 | U-61 |
| FR-ENC-01 | U-08 |
| FR-ENC-02, FR-ENC-03, FR-ENC-04 | U-62, U-22 |
| FR-ENC-05 | U-19, U-20 |
| FR-RO-01 | U-31, E02 |
| FR-RO-02 | E06, E12 |
| FR-RO-03 | U-59 |
| FR-DET-01 | U-21, U-23, E29 |
| FR-DET-02 | U-22, U-18 |
| FR-DET-03 | U-21 |
| FR-DET-04 | U-03, E33 |
| FR-JEV-01, FR-JEV-10, FR-JEV-15 | U-29 |
| FR-JEV-02, FR-JEV-03 | E06, E08, E12 |
| FR-JEV-04 | E08 |
| FR-JEV-05 | U-45, U-55, E08 |
| FR-JEV-06 | E12, E21 |
| FR-JEV-07, FR-JEV-08, FR-JEV-09 | U-23, U-56, U-49 |
| FR-JEV-11 | U-46, P-12 |
| FR-JEV-12 | U-47, U-54 |
| FR-JEV-13 | U-44, E15 |
| FR-JEV-14 | U-46, U-54 |
| FR-JEV-16 | E06 |
| FR-JEV-17, FR-JEV-18 | U-58 |
| FR-JEV-19 | U-24, U-25 |
| FR-JEV-20, FR-JEV-21 | U-26, U-26b, U-27 |
| FR-JEV-22 | U-28 |
| FR-JEV-23 | U-54, E07 |
| FR-JEV-24 | U-42, U-43 |
| FR-REC-01, FR-REC-02 | U-39b, U-40, P-16 |
| FR-REC-03, FR-REC-04, FR-REC-05 | U-39c, E12 |
| FR-REC-06 | P-16, E33 |
| FR-REC-07 | `record.spec` (T17, optional), U-40 |
| FR-KEY-01 | U-52, U-53, P-03 |
| FR-KEY-02 | U-52, P-02 |
| FR-KEY-03, FR-KEY-06 | E05, U-38 |
| FR-KEY-04 | U-37 |
| FR-KEY-05, FR-KEY-07, FR-KEY-10 | U-38, U-41, E05 |
| FR-KEY-08 | E28 |
| FR-KEY-09 | U-39, U-40, E05 |
| FR-KEY-11 | U-38, E31 |
| FR-UI-01, NFR-UI-01 | E09 |
| FR-UI-02 | E01 |
| FR-UI-12 | E34, E16 |
| FR-UI-13 | E03, E33 |
| FR-UI-14 | E17 |
| FR-UI-15 | E01, E05, E07 |
| FR-UI-16, FR-UI-18 | E33, U-48 |
| FR-UI-17 | U-56, E02 |
| FR-UI-19 | U-49 |
| FR-UI-20 | E23 |
| NFR-A11Y-01 | E30 |
| NFR-A11Y-02, NFR-A11Y-03, NFR-A11Y-06 | E32 |
| NFR-A11Y-04, NFR-UI-02 | E10, E11 |
| NFR-A11Y-05 | E16 |
| NFR-PERF-01, NFR-PERF-04 | E19 |
| NFR-PERF-02 | U-51 |
| NFR-PERF-03 | E20 |
| NFR-PERF-05 | E22 |
| NFR-PERF-06 | U-30 |
| FR-ARCH-01 … 04, FR-ARCH-06 | U-50 |
| FR-ARCH-05 | E32, P-18 |
| NFR-SEC-06 (response strings via `textContent` only, Section 3.8) | U-43, U-50, E26 |
| FR-ARCH-07, FR-ARCH-08 | E05, U-48 |
| FR-PRX-01, FR-PRX-03 | P-01, P-22 |
| FR-PRX-02 | P-14, P-19, P-20 |
| FR-PRX-04 | P-03, P-21 |
| FR-PRX-05 | P-05, P-07 |
| FR-PRX-06 | P-09, P-18 |
| FR-PRX-07 | P-02, P-20 |
| FR-PRX-08 | P-05, P-06, P-11 |
| FR-PRX-09 | P-15 |
| FR-PRX-10 | P-03, P-17, P-19 |
| FR-PRX-11 | P-03 |
| FR-PRX-12 | P-08, P-10, P-12, P-13 |
| FR-PRX-13 | P-14 |
| FR-PRX-14 | P-04 |
| FR-PRX-15 | P-16 |
| FR-PRX-16 | P-22 |
| FR-PRX-17 | T19 verify (`node --check tools/cf-worker.js` + header-text grep) |
| FR-TST-01 … 06 | DoD |
| FR-TST-07 | E01, E08, DoD (`.gitignore` content) |
| FR-TST-08 | P-02, P-19 |
| FR-TST-09 | E29, E02 |
| FR-DOC-01, FR-DOC-02 | DoD |

---

## 8. Implementation plan (multi-agent, long-horizon)

### 8.1 Rules for implementers (FR-DOC-01)

- Follow the persistence protocol: before each task set `.agent/TASKS.md` row to `in-progress` with timestamp; update `.agent/PROGRESS.md` (Now/Next/Blockers/Decisions, < 60 lines) after each meaningful step; mark `done` with how verified; commit per task with a small message.
- Each subagent writes its full report to `.agent/reports/<task-id>.md` and returns ≤ 10 lines.
- Tasks are idempotent: re-running a half-done task MUST be safe.
- A brief assumption that contradicts this spec → stop and report `BLOCKED`, do not improvise.

### 8.2 Task table

| ID | Description | Files touched | Depends on | Verify by |
|---|---|---|---|---|
Unit verify command for every task: `node --test "tests/unit/*.test.mjs"` (quoted glob). Each file below has exactly one owner; the only sequential hand-overs are noted in the "Files touched" column.

| ID | Description | Files touched (owned) | Depends on | Verify by |
|---|---|---|---|---|
| T01 | Scaffolding + core utilities | `package.json`, `package-lock.json` (via `npm install --save-dev --save-exact @playwright/test@1.49.1`), `.gitignore`, `docs/index.html` (ALL containers + `data-testid`s of Section 4.2, links to every css file, loads `js/boot.js` and `js/main.js`), `docs/.nojekyll`, `docs/css/{tokens,base}.css`, empty placeholders `docs/css/{header,circuit,dashboard,panels,dialogs}.css`, `docs/js/core/{rng,hash,params,ringbuffer,loop}.js`, `tests/unit/{rng,params,loop,secrets,dom-free}.test.mjs` | — | U-01–U-04, U-40, U-50, U-51 green |
| T02 | Stimuli + encoding | `docs/js/core/{stimuli,encoding}.js`, `tests/unit/{stimuli,encoding}.test.mjs` | T01 | U-08, U-19, U-20, U-62 |
| T03 | Network builder (incl. `buildSingleNeuronNetwork`) | `docs/js/core/network.js`, `tests/unit/network.test.mjs` | T01, T02 | U-17, U-18 |
| T04 | Sim core incl. Choice, inhibition, STDP, guards, test harness (`opts.test`, `debug.*`, `inputHash`) | `docs/js/core/sim.js`, `tests/unit/{sim,determinism,bench}.test.mjs` | T03 | U-05–U-16, U-21, U-22, U-30, U-31–U-36, U-60, U-61 |
| T05 | Readout + calibration (Section 2.11) | `docs/js/core/readout.js`, `docs/js/core/params.js` (weights only; hand-over from T01), `tests/unit/{readout,calibration}.test.mjs`, SPEC Appendix A | T04 | U-59; calibration table all pass |
| T06 | JEV schema, summary, emulator | `docs/js/jev/{schema,summary,emulator}.js`, `tests/unit/{schema,emulator}.test.mjs`, `tests/fixtures/emulator-golden.json` | T01 (summary tested against a stub of the Section 5.2 Sim interface) | U-24–U-29, U-26b, U-42, U-43 |
| T07 | Replay + placeholder recording | `docs/js/jev/replay.js`, `tests/unit/replay.test.mjs`, `tests/fixtures/recording.json`, `docs/data/jev-recording.json` (placeholder, FR-JEV-06) | T06 | U-39, U-39b, U-39c |
| T08 | Keystore + client + scheduler | `docs/js/jev/{keystore,client}.js`, `docs/js/core/scheduler.js`, `tests/unit/{keystore,client,scheduler}.test.mjs` | T04, T06, T07 | U-23, U-37, U-38, U-41, U-44–U-49, U-52–U-56, U-58 |
| T09 | Proxy | `tools/jev-proxy.mjs`, `tests/unit/proxy.test.mjs` | T06, T07 | P-01–P-22 |
| T10 | UI shell JS: header, banner, theme, store, bus, boot | `docs/js/boot.js`, `docs/js/ui/{store,bus,header,banner,theme}.js`, `docs/css/header.css` | T01 | `node --check` on each file; visual check via E01/E09–E11 after T15 |
| T11 | Circuit view (SVG) | `docs/js/ui/circuit-view.js`, `docs/css/circuit.css` | T03, T10 | `node --check`; E01, E03, E16, E34 after T15 |
| T12 | Charts + dashboard + JEV log | `docs/js/ui/{charts,dashboard,jev-log}.js`, `docs/css/dashboard.css` | T10 | `node --check`; E02–E04, E06 after T15 |
| T13 | Input panel + params panel | `docs/js/ui/{input-panel,params-panel}.js`, `docs/css/panels.css` | T02, T10 | `node --check`; E02, E17, E33 after T15 |
| T14 | Key modal + About drawer + About content | `docs/js/ui/{key-modal,about,about-content}.js`, `docs/css/dialogs.css`, `tests/unit/about.test.mjs` | T08, T10 | U-57; E05, E13, E31 after T15 |
| T15 | Main wiring, rAF loop, keyboard, URL params, `window.__mc` test hook | `docs/js/main.js`, `docs/js/ui/keyboard.js` | T04–T14 | full app runs in all three modes (LIVE via `--mock-upstream`); E01 green |
| T16 | E2E suite, screenshots, EVIDENCE | `tests/e2e/*.spec.mjs` (except `record.spec.mjs`), `playwright.config.mjs`, `tests/screenshots/*`, `tests/EVIDENCE.md` | T09, T15 | `npm ci && npx playwright install chromium && npx playwright test`: E01–E34 green (E19 soft) |
| T17 | Record real JEV session (automated, FR-REC-07; OPTIONAL) | `tests/e2e/record.spec.mjs`, `docs/data/jev-recording.json` (replaces T07 placeholder) | T09, T15, T16 | needs `JEV_LIVE_TEST=1` + key; then U-40 and E12 green with the real file. Without a key: mark `deferred` in TASKS.md; non-blocking |
| T18 | README guide (Section 9) | `README.md` | T15 | every command in it run once (unit tests, `--no-api` server, proxy `--help`) |
| T19 | Cloudflare Worker template (MAY) | `tools/cf-worker.js` | T09 | `node --check tools/cf-worker.js`; header comment contains the Section 5.7 warning verbatim |
| T20 | Final review + DoD | enables the U-50 tree case in `tests/unit/dom-free.test.mjs` (hand-over from T01) | all | DoD checklist below |

### 8.3 Parallel groups (file-disjoint)

| Wave | Tasks in parallel (file sets disjoint, all dependencies in earlier waves) |
|---|---|
| W1 | T01 |
| W2 | T02, T06, T10 |
| W3 | T03, T07, T12, T13 |
| W4 | T04, T09, T11 |
| W5 | T05, T08 |
| W6 | T14 |
| W7 | T15 |
| W8 | T16, T18, T19 |
| W9 | T17 (optional), then T20 |

Rechecked after v1.1: no file appears in two tasks of the same wave. Sequential hand-overs only: `docs/js/core/params.js` (T01 → T05), `docs/data/jev-recording.json` (T07 → T17), `tests/unit/dom-free.test.mjs` (T01 → T20). `summary.js` (T06) needs `sim.js` interfaces from Section 5.2 only; it is tested against a stub until T04 lands.

### 8.4 Milestones

- M1 (after W5): sim core + JEV layer + scheduler + proxy fully unit-tested headless.
- M2 (after W7): complete app usable in SIMULATED and mocked LIVE modes.
- M3 (after W8): E2E green, screenshots and evidence committed, README written.
- M4 (after W9, optional): real recording shipped, REPLAY live on GitHub Pages.

### 8.5 Definition of Done

- [ ] `node --test "tests/unit/*.test.mjs"` green on Node ≥ 22 (all U- and P- tests, including the U-50 tree case).
- [ ] `npm ci && npx playwright install chromium && npx playwright test` green (E19 may be soft-failed on CI hardware), run with `TYPESAFE_API_KEY` set in the shell to prove isolation (FR-TST-08).
- [ ] Every screenshot listed in Section 7.3 exists in `tests/screenshots/` and is described in `tests/EVIDENCE.md`.
- [ ] Calibration table (Section 2.11) passes; Appendix A updated if weights changed.
- [ ] U-40 secret scan green, including with `TYPESAFE_API_KEY` set in the environment; `git log -p --all | grep -E <U-40 patterns>` shows only matches containing `FAKE`, `SENTINEL` or `REDACTED`.
- [ ] `.gitignore` matches FR-TST-07; `git status --porcelain` shows no `test-results/`, `playwright-report/` or trace files.
- [ ] Page works from the GitHub Pages URL (or the `--no-api` server) in SIMULATED (and REPLAY if a recording is shipped) with no console errors other than the filtered `/api/health` 404 line (FR-TST-07).
- [ ] About drawer content matches Section 1 tags and Section 4.2 About spec (U-57, E13); only Section 11 references cited.
- [ ] README contains Section 9 content with the owner URL verified via `git remote -v`.
- [ ] No file other than those in the Section 5.1 file tree (which includes `package-lock.json` and `.gitignore`), `tests/fixtures/` and `.agent/` was added.
- [ ] Optional, non-blocking human checks (never gate DoD; agents mark them `deferred-human` in TASKS.md): visual look at the screenshots; LIVE with a real key via `node tools/jev-proxy.mjs` (≤ 5 billed calls); T17 recording.

---

## 9. README guide content (FR-DOC-02)

Insert the following into `README.md`. The owner is `BenedekMolnarVito` (from `git remote -v` at the time of writing); the implementer MUST re-verify with `git remote -v` and correct the URLs if the owner changed.

````markdown
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
$env:TYPESAFE_API_KEY = Read-Host -MaskInput 'JEV key'
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
Screenshots and what each proves: [`tests/EVIDENCE.md`](tests/EVIDENCE.md). Full spec: [`docs/SPEC.md`](docs/SPEC.md).
````

---

## 10. Open questions and risks (each with a default decision)

| ID | Question / risk | Default decision |
|---|---|---|
| OQ-01 | The brief asks the page to open from `file://`, but ruling 7 requires ES modules, which Chromium and Firefox block on `file://`. A classic-script bundle would need a build step. | **Disagreement flagged.** Default: no `file://` support for the app; `boot.js` (a classic script, which does load on `file://`) shows `file-protocol-notice` with the local-server command `node tools/jev-proxy.mjs` and the GitHub Pages URL. Revisit only if the owner prefers a committed bundle produced by a zero-dependency script. |
| OQ-02 | Default mode SIMULATED vs REPLAY (REPLAY shows genuine JEV output to visitors). | SIMULATED per ruling; REPLAY one click away and advertised in the badge tooltip when available. |
| OQ-03 | Max questions per JEV request is undocumented. | Send ≤ 3; proxy caps at 8. |
| OQ-04 | `Retry-After` semantics undocumented. | Honour `Retry-After` seconds / `retry-after-ms` ≤ 10 s; > 10 s → no retry, immediate fallback; absent → fixed backoff 1 s / 2 s. Proxy forwards only integer 0–60. |
| OQ-05 | JEV rate-limit numbers unknown (console only). | Client ≥ 2 s between LIVE calls; proxy 2 req/s; budgets 50 (page) and 200 (proxy). |
| OQ-06 | Default weights may miss calibration targets. | Tuning protocol in Section 2.11; record in Appendix A. |
| OQ-07 | `jev-latest` may move to a new version (1.14.0 already available). | Request `jev-latest`; recording stores the concrete `model`; REPLAY shows it in the log. |
| OQ-08 | Potjans & Diesmann numbers were extracted from the PMC HTML page, not the PDF. | Quote only τ_m, t_ref, θ, reset, delays and excitatory rates (as in R2's table); never inhibitory rates. |
| OQ-09 | Sigmoid Noul form is not confirmed by the escape-noise sources. | Label as [DEMO] simplification within the escape-noise family. |
| OQ-10 | Webcam input could be eye-catching. | Out of scope (OOS-1): adds permissions and privacy risk with little didactic gain over drawing. |
| OQ-11 | Cloudflare Worker would let visitors use LIVE on a public URL. | Template only (MAY); never deployed by the project; not wired into the page (no API-base parameter); documented as spending the deployer's credits for anyone (Origin allowlist is not authentication); needs rate-limit rule + daily cap. |
| OQ-12 | GitHub username for the Pages URL. | `BenedekMolnarVito` → `https://benedekmolnarvito.github.io/systemone-microcircuit/`; implementer re-verifies with `git remote -v`. |
| OQ-13 | Could TypeSafe allow-list a GitHub Pages origin at org level? | Assume no; architecture does not depend on it. |
| OQ-14 | Branco & Staras 2009 was only search-sourced in R2. | Verified by Crossref in S1 (title, authors, Nat Rev Neurosci 10:373–383) → cited [34]. |
| OQ-15 | Playwright cannot run via bare `npx` without a resolvable package for config imports. | Dev-only `package.json` (`"type": "module"`, `"private": true`, engines Node ≥ 22) with exact-pinned `@playwright/test@1.49.1` and committed `package-lock.json`; CI uses `npm ci`; the demo never needs npm. |
| OQ-16 | JEV Score is an ordered-rubric expectation; local Score is continuous mV. | Map via the 5-level binning in FR-JEV-16; explain in About. |
| OQ-17 | LIVE answers arrive asynchronously, so LIVE runs are not reproducible. | Determinism guaranteed for SIMULATED and REPLAY only (FR-DET-02); stated in the About drawer. |
| OQ-18 | R2 cited the Poirazi 2003 paper "Arithmetic of subthreshold synaptic summation" without a DOI. | Cite instead the Crossref-verified companion "Pyramidal neuron as two-layer neural network" (doi:10.1016/S0896-6273(03)00149-1), which matches the claim used. |

### Determinism requirements (referenced above)

- FR-DET-01: Same seed + same stimulus sequence (by sim time) + same params + mode SIMULATED or REPLAY → identical spike raster (`rasterHash`), readouts and JEV log answers.
- FR-DET-02: Random streams are separated per purpose: named PRNG streams derived from the master seed via fixed string salts (`STREAM` in Section 5.2: `topology`, `stim`, `input`, `topdown`, `noise`, `spike`, `route`, `emulator`, `noisePreset`, `ui`). Each step consumes a fixed number of draws per stream as specified in Section 2.4; topology draws follow the Section 2.6 build order; STDP follows the Section 2.8 order; JEV ticks follow FR-JEV-08 in sim time; emulator draws follow FR-JEV-20. Thumbnails, the noise preset and any UI randomness never consume sim streams.
- FR-DET-03: `rasterHash()` = `hex8(fnv1a32Bytes(Uint32Array of [n, i] pairs, little-endian))` over all spikes since reset.
- FR-DET-04: The seed is shown in `seed-input`, settable, and reflected in the URL (`?seed=`) via `replaceState` when applied.

---

## 11. References

Source tags: **[C]** cited in the source conversation and verified in R1; **[R]** own research, Crossref-verified in R2; **[S]** Crossref-verified in this spec (S1); **[V]** vendor documentation (R3).

1. Chavlis S, Poirazi P. Dendrites endow artificial neural networks with accurate, robust and parameter-efficient learning. *Nat Commun.* 2025;16. doi:10.1038/s41467-025-56297-9. https://doi.org/10.1038/s41467-025-56297-9 [C]
2. Zheng H, Zheng Z, Hu R, Xiao B, Wu Y, Yu F, Liu X, Li G, Deng L. Temporal dendritic heterogeneity incorporated with spiking neural networks for learning multi-timescale dynamics. *Nat Commun.* 2024;15. doi:10.1038/s41467-023-44614-z. https://doi.org/10.1038/s41467-023-44614-z [C]
3. Pagkalos M, Chavlis S, Poirazi P. Introducing the Dendrify framework for incorporating dendrites to spiking neural networks. *Nat Commun.* 2023;14. doi:10.1038/s41467-022-35747-8. https://doi.org/10.1038/s41467-022-35747-8 [C]
4. Takahashi N, Ebner C, Sigl-Glöckner J, Moberg S, Nierwetberg S, Larkum ME. Active dendritic currents gate descending cortical outputs in perception. *Nat Neurosci.* 2020;23. doi:10.1038/s41593-020-0677-8. https://doi.org/10.1038/s41593-020-0677-8 [C]
5. Kudithipudi D, Schuman C, Vineyard CM, Pandit T, Merkel C, et al. Neuromorphic computing at scale. *Nature.* 2025;637. doi:10.1038/s41586-024-08253-8. https://doi.org/10.1038/s41586-024-08253-8 [C]
6. Lei Z, Gu W, Gao S. Dendritic learning for AI: a survey of models, algorithms, applications, and future directions. *J Artif Intell Autom.* 2026;1. doi:10.53941/jaia.2026.100006. https://doi.org/10.53941/jaia.2026.100006 [C]
7. Wright WJ, Hedrick NG, Komiyama T. Distinct synaptic plasticity rules operate across dendritic compartments in vivo during learning. *Science.* 2025;388. doi:10.1126/science.ads4706. https://doi.org/10.1126/science.ads4706 [C]
8. Mikulasch FA, Rudelt L, Priesemann V. Local dendritic balance enables learning of efficient representations in networks of spiking neurons. *Proc Natl Acad Sci USA.* 2021;118. doi:10.1073/pnas.2021925118. https://doi.org/10.1073/pnas.2021925118 [C]
9. Urbanczik R, Senn W. Learning by the dendritic prediction of somatic spiking. *Neuron.* 2014;81. doi:10.1016/j.neuron.2013.11.030. https://doi.org/10.1016/j.neuron.2013.11.030 [C] (the conversation linked a GitHub repository instead of the paper; the DOI is correct)
10. Frémaux N, Gerstner W. Neuromodulated spike-timing-dependent plasticity, and theory of three-factor learning rules. *Front Neural Circuits.* 2016;9:85. doi:10.3389/fncir.2015.00085. https://doi.org/10.3389/fncir.2015.00085 [C]
11. Yamazaki K, Vo-Ho VK, Bulsara D, Le N. Spiking neural networks and their applications: a review. *Brain Sci.* 2022;12(7):863. doi:10.3390/brainsci12070863. https://doi.org/10.3390/brainsci12070863 [C]
12. Douglas RJ, Martin KAC. A functional microcircuit for cat visual cortex. *J Physiol.* 1991;440:735–769. doi:10.1113/jphysiol.1991.sp018733. https://doi.org/10.1113/jphysiol.1991.sp018733 [R]
13. Douglas RJ, Martin KAC. Neuronal circuits of the neocortex. *Annu Rev Neurosci.* 2004;27:419–451. doi:10.1146/annurev.neuro.27.070203.144152. https://doi.org/10.1146/annurev.neuro.27.070203.144152 [R]
14. Potjans TC, Diesmann M. The cell-type specific cortical microcircuit: relating structure and activity in a full-scale spiking network model. *Cereb Cortex.* 2014;24:785–806. doi:10.1093/cercor/bhs358. https://pmc.ncbi.nlm.nih.gov/articles/PMC3920768/ [R]
15. Harris KD, Shepherd GMG. The neocortical circuit: themes and variations. *Nat Neurosci.* 2015;18:170–181. doi:10.1038/nn.3917. https://doi.org/10.1038/nn.3917 [R, re-checked S]
16. Gerstner W, Kistler W. *Spiking Neuron Models: Single Neurons, Populations, Plasticity.* Cambridge University Press; 2002. doi:10.1017/CBO9780511815706. https://doi.org/10.1017/CBO9780511815706 [R]
17. Brunel N. Dynamics of sparsely connected networks of excitatory and inhibitory spiking neurons. *J Comput Neurosci.* 2000;8:183–208. doi:10.1023/A:1008925309027. https://doi.org/10.1023/A:1008925309027 [R]
18. Gerstner W. Population dynamics of spiking neurons: fast transients, asynchronous states, and locking. *Neural Comput.* 2000;12:43–89. doi:10.1162/089976600300015899. https://doi.org/10.1162/089976600300015899 [R]
19. Pfeffer CK, Xue M, He M, Huang ZJ, Scanziani M. Inhibition of inhibition in visual cortex: the logic of connections between molecularly distinct interneurons. *Nat Neurosci.* 2013;16:1068–1076. doi:10.1038/nn.3446. https://doi.org/10.1038/nn.3446 [R]
20. Pi HJ, Hangya B, Kvitsiani D, Sanders JI, Huang ZJ, Kepecs A. Cortical interneurons that specialize in disinhibitory control. *Nature.* 2013;503:521–524. doi:10.1038/nature12676. https://doi.org/10.1038/nature12676 [R]
21. Tremblay R, Lee S, Rudy B. GABAergic interneurons in the neocortex: from cellular properties to circuits. *Neuron.* 2016;91:260–292. doi:10.1016/j.neuron.2016.06.033. https://doi.org/10.1016/j.neuron.2016.06.033 [R]
22. Kuffler SW. Discharge patterns and functional organization of mammalian retina. *J Neurophysiol.* 1953;16:37–68. doi:10.1152/jn.1953.16.1.37. https://doi.org/10.1152/jn.1953.16.1.37 [R]
23. Enroth-Cugell C, Robson JG. The contrast sensitivity of retinal ganglion cells of the cat. *J Physiol.* 1966;187:517–552. doi:10.1113/jphysiol.1966.sp008107. https://doi.org/10.1113/jphysiol.1966.sp008107 [R]
24. Hubel DH, Wiesel TN. Receptive fields, binocular interaction and functional architecture in the cat's visual cortex. *J Physiol.* 1962;160:106–154. doi:10.1113/jphysiol.1962.sp006837. https://doi.org/10.1113/jphysiol.1962.sp006837 [R]
25. Bi GQ, Poo MM. Synaptic modifications in cultured hippocampal neurons: dependence on spike timing, synaptic strength, and postsynaptic cell type. *J Neurosci.* 1998;18:10464–10472. doi:10.1523/JNEUROSCI.18-24-10464.1998. https://doi.org/10.1523/JNEUROSCI.18-24-10464.1998 [R]
26. Song S, Miller KD, Abbott LF. Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nat Neurosci.* 2000;3:919–926. doi:10.1038/78829. https://doi.org/10.1038/78829 [R]
27. Morrison A, Diesmann M, Gerstner W. Phenomenological models of synaptic plasticity based on spike timing. *Biol Cybern.* 2008;98:459–478. doi:10.1007/s00422-008-0233-1. https://doi.org/10.1007/s00422-008-0233-1 [R]
28. Carandini M, Heeger DJ. Normalization as a canonical neural computation. *Nat Rev Neurosci.* 2012;13:51–62. doi:10.1038/nrn3136. https://doi.org/10.1038/nrn3136 [R]
29. Larkum ME, Zhu JJ, Sakmann B. A new cellular mechanism for coupling inputs arriving at different cortical layers. *Nature.* 1999;398:338–341. doi:10.1038/18686. https://doi.org/10.1038/18686 [R]
30. Poirazi P, Brannon T, Mel BW. Pyramidal neuron as two-layer neural network. *Neuron.* 2003;37:989–999. doi:10.1016/S0896-6273(03)00149-1. https://doi.org/10.1016/S0896-6273(03)00149-1 [S]
31. London M, Häusser M. Dendritic computation. *Annu Rev Neurosci.* 2005;28:503–532. doi:10.1146/annurev.neuro.28.061604.135703. https://doi.org/10.1146/annurev.neuro.28.061604.135703 [R]
32. Gidon A, Zolnik TA, Fidzinski P, Bolduan F, Papoutsi A, Poirazi P, Holtkamp M, Vida I, Larkum ME. Dendritic action potentials and computation in human layer 2/3 cortical neurons. *Science.* 2020;367:83–87. doi:10.1126/science.aax6239. https://doi.org/10.1126/science.aax6239 [R]
33. Dragly SA, et al. Neuronify: an educational simulator for neural circuits. *eNeuro.* 2017;4(2):ENEURO.0022-17.2017. doi:10.1523/ENEURO.0022-17.2017. https://doi.org/10.1523/ENEURO.0022-17.2017 [R]
34. Branco T, Staras K. The probability of neurotransmitter release: variability and feedback control at single synapses. *Nat Rev Neurosci.* 2009;10:373–383. doi:10.1038/nrn2634. https://doi.org/10.1038/nrn2634 [S]
35. Tsodyks MV, Markram H. The neural code between neocortical pyramidal neurons depends on neurotransmitter release probability. *Proc Natl Acad Sci USA.* 1997;94:719–723. doi:10.1073/pnas.94.2.719. https://doi.org/10.1073/pnas.94.2.719 [R]
36. Debanne D. Information processing in the axon. *Nat Rev Neurosci.* 2004;5:304–316. doi:10.1038/nrn1397. https://doi.org/10.1038/nrn1397 [R]
37. TypeSafe. JEV API reference. https://docs.typesafe.ai/api.md (accessed 2026-10-17) [V]
38. TypeSafe. Models and pricing. https://docs.typesafe.ai/models.md (accessed 2026-10-17) [V]
39. TypeSafe. Score primitive. https://docs.typesafe.ai/primitives/score.md (accessed 2026-10-17) [V]

---

## Appendix A — Calibration changelog

| Date | Parameter | Old | New | Reason / evidence |
|---|---|---|---|---|
| 2026-10-17 | (initial design values) | — | as Section 2.3/2.5/2.6 | spec draft S1 |
