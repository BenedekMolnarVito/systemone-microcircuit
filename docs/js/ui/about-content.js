// About drawer content (SPEC 1.1-1.5, 4.2, 11). DOM-free plain data; generated from SPEC text, rendered via textContent.
import { DEFAULTS, PARAM_SPECS } from '../core/params.js';

const pitch = "**What if a neuron were three typed decisions?** SystemOne Microcircuit is an interactive browser demo of an original idea: the three typed primitives of the TypeSafe JEV System-One model — **Score**, **Noul** and **Choice** — are used as the building blocks of a spiking neuron. Score is the graded, leaky membrane potential; Noul is the probability that the neuron spikes within the next 10 ms; Choice decides which axon collateral carries the spike (a deliberate, non-biological simplification; see Section 1.4). Fifty-eight such neurons are wired into a toy circuit inspired by a visual-cortex column that \"looks at\" pixel images, and the real JEV API (or a local stand-in with identical response format) sits on top as a semantic control layer.";

const MAPPING_HEADER = [
  "Primitive",
  "Biology",
  "Demo implementation",
  "Tag"
];

const mappingRows = [
  [
    "Score",
    "Graded, leaky membrane and dendritic potential; branch-specific time constants [31]",
    "`S`, `D_b`, `D_a` per neuron with leak factors `λ = exp(−dt/τ)`; basal τ_b = 10 ms, apical τ_a = 30 ms, soma τ_m = 10 ms; heterogeneous τ motivated by dendritic SNN models [2, 3]",
    "ESTABLISHED (biology) / DEMO (values)"
  ],
  [
    "Noul",
    "Somatic firing probability under escape noise [16, 18]",
    "`Noul = σ((S − θ)/Δ)` = probability of ≥ 1 spike within `W = 10 ms`; per-step hazard `p_step = 1 − (1 − Noul)^(dt/W)`",
    "PROPOSAL (mapping) / DEMO (sigmoid form)"
  ],
  [
    "Spike",
    "All-or-none action potential, reset, refractoriness [14, 16]",
    "Bernoulli sample of `p_step`; reset to 0 mV; 2 ms refractory",
    "ESTABLISHED"
  ],
  [
    "Choice",
    "Probabilistic release [34, 35], branch-point conduction failure [36], dendritic gating of output [4]",
    "Softmax over collaterals with temperature `τ_c`; logits depend on apical potential",
    "PROPOSAL (mapping) / DEMO (formula)"
  ],
  [
    "PV inhibition",
    "Perisomatic, fast [19, 21]; divisive gain control [28]",
    "Subtractive somatic jump and/or divisive shunt trace",
    "DEMO (formula)"
  ],
  [
    "SST inhibition",
    "Dendrite-targeting [21]",
    "Negative input to apical compartment",
    "DEMO (formula)"
  ],
  [
    "VIP disinhibition",
    "VIP → SST → pyramidal [19, 20]",
    "VIP inhibits SST; driven by \"top-down attention\"",
    "DEMO (formula)"
  ],
  [
    "Plasticity",
    "STDP [25, 26, 27]; three-factor rules [10]",
    "Optional pair-based STDP; JEV novelty Noul as a simplified gain modulation inspired by three-factor rules [10], without eligibility traces",
    "DEMO (third factor is PROPOSAL)"
  ],
  [
    "JEV control",
    "—",
    "`circuit_evidence` score biases the L23E `output` logit, β ∈ [−0.5, 0.5]; novelty Noul as STDP gain",
    "PROPOSAL"
  ]
];

const mappingNote = "[DEMO] In real axons an action potential normally reaches all collaterals; transmission failures occur per synapse and independently [34, 35], and branch-point conduction failures are the exception [36]. Mutually exclusive collateral selection (hard routing) is the owner's proposal, not a biological claim; soft routing is closer to independent probabilistic release.";

const established = [
  "The canonical cortical microcircuit routes thalamic input mainly to layer 4, then to layer 2/3, then to layer 5, with recurrent excitation and inhibition at each stage [12, 13, 15].",
  "Potjans & Diesmann built a full-scale spiking model with 8 populations (L2/3, L4, L5, L6 × excitatory/inhibitory) plus thalamus, with τ_m = 10 ms, refractory period 2 ms, threshold −50 mV, reset −65 mV, excitatory delay 1.5 ms and inhibitory delay 0.8 ms, and simulated mean excitatory rates of 0.86 Hz (L2/3), 4.45 Hz (L4), 7.59 Hz (L5) and 1.09 Hz (L6) [14].",
  "Leaky integrate-and-fire (LIF) neurons and sparse excitatory/inhibitory networks are standard abstractions [16, 17]. Escape-noise (stochastic threshold) models let the firing intensity depend on the distance of the membrane potential to threshold [16, 18].",
  "Cortical interneurons fall into classes with distinct targets: PV cells inhibit perisomatically (fast, soma-targeting), SST cells target dendrites, and VIP cells inhibit SST cells, which disinhibits pyramidal neurons [19, 20, 21].",
  "Divisive normalisation is a canonical neural computation that yields gain control and soft winner-take-all behaviour [28].",
  "Retinal ganglion cells have centre–surround receptive fields [22, 23]; simple cells in primary visual cortex are orientation selective with elongated receptive fields [24].",
  "Spike-timing-dependent plasticity (STDP): pre-before-post pairing potentiates, post-before-pre depresses, within a window of roughly ±20 ms [25]; pair-based exponential-window models are standard [27]; STDP produces competition between inputs [26]. Three-factor (neuromodulated) rules add a third gating signal [10].",
  "Dendrites are active computational units: a back-propagating action potential coinciding with distal apical input triggers a dendritic Ca²⁺ spike and burst firing in L5 pyramidal neurons [29]; pyramidal neurons can be approximated as two-layer networks of sigmoidal dendritic subunits [30]; dendritic spikes enable local nonlinear computation [31, 32]; active dendritic currents gate descending cortical outputs during perception [4].",
  "Dendritic structure benefits artificial and spiking networks: dendritic ANNs [1], heterogeneous dendritic time constants in SNNs [2], dendritic compartments in SNN frameworks [3], compartment-specific plasticity rules in vivo [7], local dendritic balance [8], dendritic prediction of somatic spiking [9]. A 2026 survey reviews dendritic learning for AI [6]. Neuromorphic computing at scale emphasises event-driven, sparse computation [5]. A general SNN review covers spikes and STDP [11].",
  "Synaptic transmission is probabilistic: release probability varies between terminals and is under feedback control [34] and shapes the neural code [35]; spikes can fail to propagate at axonal branch points, although an action potential normally reaches all collaterals [36].",
  "Educational interactive neural-circuit simulators exist (Neuronify) [33]."
];

const FR_SCI_01 = "Correction carried over from the source conversation (FR-SCI-01, MUST be stated in the About drawer verbatim): Noul is not a spike. A biological spike is an all-or-none event; Noul is a probability in [0, 1]. Noul is a probability; spike is a Bernoulli sample of the per-step hazard derived from it. Precisely: Noul is the probability of at least one spike within a 10 ms window; each 0.5 ms step the neuron spikes with probability `p_step = 1 − (1 − Noul)^(dt/10 ms)`, so the chance of ≥ 1 spike over 10 ms of constant Noul equals Noul (ignoring refractoriness).";

const STATEMENT_1_5 = "Spiking neurons, leaky graded potentials, dendritic computation, interneuron motifs and STDP are established neuroscience. What is original here is the owner's proposal to express a neuron's functions with JEV's three typed decision primitives — Score for the graded potential, Noul for the probability of a spike within a short window and Choice for collateral routing — and to use the JEV model as a semantic control layer over a fast spiking loop. This page is a didactic toy: the numbers are chosen for clarity, not fitted to data.";

const proposal = [
  "Treat JEV's Noul, Choice and Score as a minimal, composable typed instruction set for a neuron-like unit.",
  "Make Choice an explicit, probabilistic axon-collateral router.",
  "Use JEV as a semantic decision layer above a fast spiking loop: spikes handle timing; JEV answers higher-level typed questions (\"which orientation is present?\", \"is this input novel?\", \"how strong is the evidence?\") and returns control signals.",
  "Probabilistic release and branch-point failures [34–36] are the closest biological analogues of Choice-like routing; this demo differs from existing simulators [33] by mapping neuron functions onto JEV's typed primitives."
];

const FR_SCI_08 = "Scaling statement (FR-SCI-08): Population sizes are scaled down from Potjans & Diesmann [14] by roughly 1:270 to 1:1370 per population (overall ≈ 1:1030 for the three modelled layers). Arithmetic (source count / demo count): L4E 21 915 / 16 ≈ 1370; L4I 5 479 / 4 ≈ 1370; L2/3E 20 683 / 16 ≈ 1290; L2/3I 5 834 / 10 ≈ 580; L5E 4 850 / 8 ≈ 610; L5I 1 065 / 4 ≈ 270; layers 2/3 + 4 + 5 total 59 826 / 58 ≈ 1030. The L4 E:I ratio (16:4 = 4:1) matches the source (21 915 : 5 479 ≈ 4:1). The L2/3 (16:10 vs ≈ 3.5:1 in the source) and L5 (8:4 = 2:1 vs 4 850 : 1 065 ≈ 4.6:1) inhibitory populations are deliberately inflated so every interneuron class is visible [DEMO]; Potjans & Diesmann do not subdivide interneurons. Connection probabilities in Section 2.6 preserve the *ordering of dominant pathways* of the canonical circuit (L4 → L2/3 → L5, local E ↔ PV loops), not the absolute values, because with tens of neurons the source probabilities would leave most neurons without inputs. Synaptic weights are larger than biological PSPs (0.15 mV mean in [14]) for the same reason [DEMO].";

const FR_SCI_09 = "In SIMULATED mode the JEV answers are computed by a simple local formula from L4 firing rates, not by the JEV model. Agreement in this mode shows the plumbing, not JEV's judgement. REPLAY and LIVE show genuine JEV answers.";

// Added for scanning (educative UI): restates Sections 1.2–1.4, 2.4–2.8, 3.4 and README with the existing refs only (FR-SCI-03).
const summary = [
  "[DEMO] A teaching toy: 58 spiking neurons in a scaled-down layer 4 → 2/3 → 5 visual-cortex column that looks at 16 × 16 pixel images [12–14].",
  "[PROPOSAL] Each neuron is built from three typed JEV primitives: Score (graded, leaky potential), Noul (probability of a spike within 10 ms) and Choice (which axon collateral carries the spike).",
  "[ESTABLISHED] The biology underneath — leaky integrate-and-fire neurons, the canonical microcircuit, PV/SST/VIP interneurons, STDP and active dendrites — is established and cited below [12–14, 16, 19–21, 25, 29].",
  "[PROPOSAL] Expressing a neuron with JEV primitives is the owner's proposal; routing each spike to exactly one collateral is a deliberate, non-biological simplification.",
  "Every control's tooltip names the section of this page that explains it; numbers in brackets point to the References.",
];

const primitives = [
  {
    title: "Score — graded potential",
    text: "[DEMO] soma, basal and apical compartments are leaky integrators, `λ = exp(−dt/τ)` with τ_m = 10 ms (Potjans & Diesmann [14]), τ_b = 10 ms and τ_a = 30 ms [DEMO]. [ESTABLISHED] leaky integrate-and-fire neurons are the standard abstraction [16, 17]; dendrites are compartmentalised computational units [29–31]; heterogeneous dendritic time constants help spiking networks learn multi-timescale dynamics [2].",
  },
  {
    title: "Noul — spike probability",
    text: "[DEMO] `Noul = σ((S − θ)/Δ)` is the probability of at least one spike within W = 10 ms; every 0.5 ms step samples a spike from the derived hazard, then the soma resets to rest with 2 ms refractoriness. θ = 15 mV above rest follows the −50 mV threshold and −65 mV reset of [14]; σ_V adds membrane noise [DEMO]. [ESTABLISHED] escape-noise models make the firing intensity depend on the distance of the membrane potential to threshold [16, 18]; the sigmoid is one simple member of that family.",
  },
  {
    title: "Choice — collateral routing",
    text: "[DEMO] a softmax with temperature τ_c over each excitatory neuron's collaterals, with logits shifted by apical potential. Hard routing delivers the spike on one sampled collateral; soft routing delivers every collateral scaled by its probability, with the same expected input. [ESTABLISHED] an action potential normally reaches all collaterals; release is probabilistic per synapse [34, 35], branch-point conduction failures are the exception [36], and active dendritic currents can gate cortical output [4]. [PROPOSAL] Hard routing is the owner's proposal, not a biological claim.",
  },
  {
    title: "Inhibition — PV, SST, VIP",
    text: "[DEMO] PV cells inhibit the soma (subtractive, divisive or both, per PV mode); SST cells inhibit the apical dendrite; VIP cells inhibit SST, so top-down attention A disinhibits pyramidal dendrites; g scales all inhibitory weights and is named after g in [14]. [ESTABLISHED] interneuron classes and their targets [19–21]; divisive normalisation as gain control [28]; excitation–inhibition balance in sparse networks [17]; recurrent excitation and inhibition at each stage of the canonical circuit [12, 13, 15].",
  },
  {
    title: "Plasticity — STDP",
    text: "Demo (optional, off by default): pair-based STDP on excitatory collateral synapses with exponential windows τ₊ = τ₋ = 20 ms; when JEV control is on, the JEV novelty Noul ν sets a gain M = 0.5 + ν. [ESTABLISHED] the ±20 ms timing window [25], competition between inputs [26], pair-based models [27] and three-factor rules [10]; here without eligibility traces.",
  },
  {
    title: "Input and circuit",
    text: "[DEMO] pixel intensities set Poisson-like input rates between r_base and r_max; each L4 cell has an elongated, zero-mean receptive field with antagonistic flanks for one of four orientations, and L4 → L2/3 → L5 carries the signal to the readout. [ESTABLISHED] orientation-selective simple cells in primary visual cortex [24]; centre–surround receptive fields [22, 23] (not modelled separately); the canonical layer 4 → 2/3 → 5 pathway [12–15], scaled down as stated under Simplifications.",
  },
  {
    title: "JEV control — semantic layer",
    text: "[DEMO] Every JEV interval the app sends a numeric circuit summary and asks three typed questions: a Choice (which orientation is present?), a Noul (is this input novel?) and a Score (how strong is the evidence?) [37–39]. With JEV control on, the evidence Score biases the L23E output logit (β ∈ [−0.5, 0.5]) and the novelty Noul scales the STDP gain. [PROPOSAL] This control layer is the owner's proposal; it has no direct biological counterpart.",
  },
];

const modes = [
  "[DEMO] SIM (SIMULATED JEV): a deterministic local stand-in with the same response format as JEV, computed by a simple formula from layer-4 firing rates. No key, no network calls to JEV, no cost; same seed and settings give the same run.",
  "[DEMO] REPLAY (REPLAY JEV): plays back genuine JEV answers recorded earlier with the local proxy; available only when the build ships a recording. No key, no cost.",
  "[DEMO] LIVE (LIVE JEV): real JEV calls through the local proxy (`node tools/jev-proxy.mjs`, then open http://127.0.0.1:8787). Needs a key in the proxy's environment or pasted via the Key button (the `--mock-upstream` proxy needs none); each call is billed (about $0.00002) and capped by the per-session LIVE budget.",
];

const refs = [
  [
    1,
    "Chavlis S, Poirazi P. Dendrites endow artificial neural networks with accurate, robust and parameter-efficient learning. Nat Commun. 2025;16. doi:10.1038/s41467-025-56297-9.",
    "https://doi.org/10.1038/s41467-025-56297-9"
  ],
  [
    2,
    "Zheng H, Zheng Z, Hu R, Xiao B, Wu Y, Yu F, Liu X, Li G, Deng L. Temporal dendritic heterogeneity incorporated with spiking neural networks for learning multi-timescale dynamics. Nat Commun. 2024;15. doi:10.1038/s41467-023-44614-z.",
    "https://doi.org/10.1038/s41467-023-44614-z"
  ],
  [
    3,
    "Pagkalos M, Chavlis S, Poirazi P. Introducing the Dendrify framework for incorporating dendrites to spiking neural networks. Nat Commun. 2023;14. doi:10.1038/s41467-022-35747-8.",
    "https://doi.org/10.1038/s41467-022-35747-8"
  ],
  [
    4,
    "Takahashi N, Ebner C, Sigl-Glöckner J, Moberg S, Nierwetberg S, Larkum ME. Active dendritic currents gate descending cortical outputs in perception. Nat Neurosci. 2020;23. doi:10.1038/s41593-020-0677-8.",
    "https://doi.org/10.1038/s41593-020-0677-8"
  ],
  [
    5,
    "Kudithipudi D, Schuman C, Vineyard CM, Pandit T, Merkel C, et al. Neuromorphic computing at scale. Nature. 2025;637. doi:10.1038/s41586-024-08253-8.",
    "https://doi.org/10.1038/s41586-024-08253-8"
  ],
  [
    6,
    "Lei Z, Gu W, Gao S. Dendritic learning for AI: a survey of models, algorithms, applications, and future directions. J Artif Intell Autom. 2026;1. doi:10.53941/jaia.2026.100006.",
    "https://doi.org/10.53941/jaia.2026.100006"
  ],
  [
    7,
    "Wright WJ, Hedrick NG, Komiyama T. Distinct synaptic plasticity rules operate across dendritic compartments in vivo during learning. Science. 2025;388. doi:10.1126/science.ads4706.",
    "https://doi.org/10.1126/science.ads4706"
  ],
  [
    8,
    "Mikulasch FA, Rudelt L, Priesemann V. Local dendritic balance enables learning of efficient representations in networks of spiking neurons. Proc Natl Acad Sci USA. 2021;118. doi:10.1073/pnas.2021925118.",
    "https://doi.org/10.1073/pnas.2021925118"
  ],
  [
    9,
    "Urbanczik R, Senn W. Learning by the dendritic prediction of somatic spiking. Neuron. 2014;81. doi:10.1016/j.neuron.2013.11.030.",
    "https://doi.org/10.1016/j.neuron.2013.11.030"
  ],
  [
    10,
    "Frémaux N, Gerstner W. Neuromodulated spike-timing-dependent plasticity, and theory of three-factor learning rules. Front Neural Circuits. 2016;9:85. doi:10.3389/fncir.2015.00085.",
    "https://doi.org/10.3389/fncir.2015.00085"
  ],
  [
    11,
    "Yamazaki K, Vo-Ho VK, Bulsara D, Le N. Spiking neural networks and their applications: a review. Brain Sci. 2022;12(7):863. doi:10.3390/brainsci12070863.",
    "https://doi.org/10.3390/brainsci12070863"
  ],
  [
    12,
    "Douglas RJ, Martin KAC. A functional microcircuit for cat visual cortex. J Physiol. 1991;440:735–769. doi:10.1113/jphysiol.1991.sp018733.",
    "https://doi.org/10.1113/jphysiol.1991.sp018733"
  ],
  [
    13,
    "Douglas RJ, Martin KAC. Neuronal circuits of the neocortex. Annu Rev Neurosci. 2004;27:419–451. doi:10.1146/annurev.neuro.27.070203.144152.",
    "https://doi.org/10.1146/annurev.neuro.27.070203.144152"
  ],
  [
    14,
    "Potjans TC, Diesmann M. The cell-type specific cortical microcircuit: relating structure and activity in a full-scale spiking network model. Cereb Cortex. 2014;24:785–806. doi:10.1093/cercor/bhs358.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC3920768/"
  ],
  [
    15,
    "Harris KD, Shepherd GMG. The neocortical circuit: themes and variations. Nat Neurosci. 2015;18:170–181. doi:10.1038/nn.3917.",
    "https://doi.org/10.1038/nn.3917"
  ],
  [
    16,
    "Gerstner W, Kistler W. Spiking Neuron Models: Single Neurons, Populations, Plasticity. Cambridge University Press; 2002. doi:10.1017/CBO9780511815706.",
    "https://doi.org/10.1017/CBO9780511815706"
  ],
  [
    17,
    "Brunel N. Dynamics of sparsely connected networks of excitatory and inhibitory spiking neurons. J Comput Neurosci. 2000;8:183–208. doi:10.1023/A:1008925309027.",
    "https://doi.org/10.1023/A:1008925309027"
  ],
  [
    18,
    "Gerstner W. Population dynamics of spiking neurons: fast transients, asynchronous states, and locking. Neural Comput. 2000;12:43–89. doi:10.1162/089976600300015899.",
    "https://doi.org/10.1162/089976600300015899"
  ],
  [
    19,
    "Pfeffer CK, Xue M, He M, Huang ZJ, Scanziani M. Inhibition of inhibition in visual cortex: the logic of connections between molecularly distinct interneurons. Nat Neurosci. 2013;16:1068–1076. doi:10.1038/nn.3446.",
    "https://doi.org/10.1038/nn.3446"
  ],
  [
    20,
    "Pi HJ, Hangya B, Kvitsiani D, Sanders JI, Huang ZJ, Kepecs A. Cortical interneurons that specialize in disinhibitory control. Nature. 2013;503:521–524. doi:10.1038/nature12676.",
    "https://doi.org/10.1038/nature12676"
  ],
  [
    21,
    "Tremblay R, Lee S, Rudy B. GABAergic interneurons in the neocortex: from cellular properties to circuits. Neuron. 2016;91:260–292. doi:10.1016/j.neuron.2016.06.033.",
    "https://doi.org/10.1016/j.neuron.2016.06.033"
  ],
  [
    22,
    "Kuffler SW. Discharge patterns and functional organization of mammalian retina. J Neurophysiol. 1953;16:37–68. doi:10.1152/jn.1953.16.1.37.",
    "https://doi.org/10.1152/jn.1953.16.1.37"
  ],
  [
    23,
    "Enroth-Cugell C, Robson JG. The contrast sensitivity of retinal ganglion cells of the cat. J Physiol. 1966;187:517–552. doi:10.1113/jphysiol.1966.sp008107.",
    "https://doi.org/10.1113/jphysiol.1966.sp008107"
  ],
  [
    24,
    "Hubel DH, Wiesel TN. Receptive fields, binocular interaction and functional architecture in the cat's visual cortex. J Physiol. 1962;160:106–154. doi:10.1113/jphysiol.1962.sp006837.",
    "https://doi.org/10.1113/jphysiol.1962.sp006837"
  ],
  [
    25,
    "Bi GQ, Poo MM. Synaptic modifications in cultured hippocampal neurons: dependence on spike timing, synaptic strength, and postsynaptic cell type. J Neurosci. 1998;18:10464–10472. doi:10.1523/JNEUROSCI.18-24-10464.1998.",
    "https://doi.org/10.1523/JNEUROSCI.18-24-10464.1998"
  ],
  [
    26,
    "Song S, Miller KD, Abbott LF. Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. Nat Neurosci. 2000;3:919–926. doi:10.1038/78829.",
    "https://doi.org/10.1038/78829"
  ],
  [
    27,
    "Morrison A, Diesmann M, Gerstner W. Phenomenological models of synaptic plasticity based on spike timing. Biol Cybern. 2008;98:459–478. doi:10.1007/s00422-008-0233-1.",
    "https://doi.org/10.1007/s00422-008-0233-1"
  ],
  [
    28,
    "Carandini M, Heeger DJ. Normalization as a canonical neural computation. Nat Rev Neurosci. 2012;13:51–62. doi:10.1038/nrn3136.",
    "https://doi.org/10.1038/nrn3136"
  ],
  [
    29,
    "Larkum ME, Zhu JJ, Sakmann B. A new cellular mechanism for coupling inputs arriving at different cortical layers. Nature. 1999;398:338–341. doi:10.1038/18686.",
    "https://doi.org/10.1038/18686"
  ],
  [
    30,
    "Poirazi P, Brannon T, Mel BW. Pyramidal neuron as two-layer neural network. Neuron. 2003;37:989–999. doi:10.1016/S0896-6273(03)00149-1.",
    "https://doi.org/10.1016/S0896-6273(03)00149-1"
  ],
  [
    31,
    "London M, Häusser M. Dendritic computation. Annu Rev Neurosci. 2005;28:503–532. doi:10.1146/annurev.neuro.28.061604.135703.",
    "https://doi.org/10.1146/annurev.neuro.28.061604.135703"
  ],
  [
    32,
    "Gidon A, Zolnik TA, Fidzinski P, Bolduan F, Papoutsi A, Poirazi P, Holtkamp M, Vida I, Larkum ME. Dendritic action potentials and computation in human layer 2/3 cortical neurons. Science. 2020;367:83–87. doi:10.1126/science.aax6239.",
    "https://doi.org/10.1126/science.aax6239"
  ],
  [
    33,
    "Dragly SA, et al. Neuronify: an educational simulator for neural circuits. eNeuro. 2017;4(2):ENEURO.0022-17.2017. doi:10.1523/ENEURO.0022-17.2017.",
    "https://doi.org/10.1523/ENEURO.0022-17.2017"
  ],
  [
    34,
    "Branco T, Staras K. The probability of neurotransmitter release: variability and feedback control at single synapses. Nat Rev Neurosci. 2009;10:373–383. doi:10.1038/nrn2634.",
    "https://doi.org/10.1038/nrn2634"
  ],
  [
    35,
    "Tsodyks MV, Markram H. The neural code between neocortical pyramidal neurons depends on neurotransmitter release probability. Proc Natl Acad Sci USA. 1997;94:719–723. doi:10.1073/pnas.94.2.719.",
    "https://doi.org/10.1073/pnas.94.2.719"
  ],
  [
    36,
    "Debanne D. Information processing in the axon. Nat Rev Neurosci. 2004;5:304–316. doi:10.1038/nrn1397.",
    "https://doi.org/10.1038/nrn1397"
  ],
  [
    37,
    "TypeSafe. JEV API reference. (accessed 2026-10-17)",
    "https://docs.typesafe.ai/api.md"
  ],
  [
    38,
    "TypeSafe. Models and pricing. (accessed 2026-10-17)",
    "https://docs.typesafe.ai/models.md"
  ],
  [
    39,
    "TypeSafe. Score primitive. (accessed 2026-10-17)",
    "https://docs.typesafe.ai/primitives/score.md"
  ]
];

const demoParams = Object.entries(PARAM_SPECS)
  .filter(([, s]) => s.tag === 'DEMO')
  .map(([k, s]) => `${s.symbol} = ${DEFAULTS[k]} ${s.unit}: ${s.source}`);

const simplification = [
  'This page is a didactic toy: the numbers are chosen for clarity, not fitted to data.',
  FR_SCI_08,
  mappingNote,
  FR_SCI_09,
  'Noul uses a sigmoid of the distance to threshold, a simplification within the escape-noise family [16, 18].',
  'Dendritic input gating is not modelled. Layer-4 cells keep an apical compartment only for code uniformity.',
  'The STDP third factor is a simple gain on immediate weight updates, without eligibility traces [10].',
  'SIMULATED and REPLAY runs are deterministic for a given seed; LIVE runs are not reproducible.',
  ...demoParams,
];

export const ABOUT = Object.freeze({
  summary,
  pitch,
  mapping: { header: MAPPING_HEADER, rows: mappingRows, note: mappingNote },
  primitives,
  established,
  proposal: [...proposal, FR_SCI_01, STATEMENT_1_5],
  modes,
  simplification,
  refs: refs.map(([n, text, href]) => ({ n, text, href })),
});
