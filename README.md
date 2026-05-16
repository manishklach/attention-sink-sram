# Attention-Sink SRAM

Browser-native simulator for `attention-sink-aware SRAM placement of transformer KV cache`, now extended into a deterministic `memory orchestration + execution control plane` simulator for transformer inference.

Open [index.html](./index.html) directly in a browser. No build step, package manager, or framework is required.

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## What this repository now simulates

This project illustrates how a future inference runtime could coordinate:

- KV placement and slice promotion
- DMA scheduling and transfer descriptors
- SRAM budget partitioning
- deterministic execution windows
- decode-time multi-tier routing
- shared-prefix reuse across tenants
- speculative rollback and SRAM reclamation
- fragmentation, compaction, and relocation traffic
- runtime policies and stress-event adaptation
- control-plane telemetry and exportable research artifacts

## Orchestration control plane

The simulator includes a visible orchestrator that models:

- active sessions
- total SRAM used
- DMA utilization
- pending promotions
- decode queue depth
- speculative rollback pressure
- residency pressure
- promotion churn
- execution window stability

This is the main conceptual shift from earlier versions: the repo is no longer only a cache-placement explainer. It is now a deterministic `runtime orchestration prototype`.

## Deterministic execution windows

Execution windows model periods where selected sink KV regions remain pinned or contractually resident. The simulator surfaces:

- stable windows
- unstable windows
- eviction risk
- deterministic decode hit rate
- residency volatility

These windows help explain how an orchestration layer could provide more predictable decode behavior even when the full KV working set does not fit in SRAM.

## Multi-tier memory routing

The memory system now expands beyond `SRAM` and `HBM` to include:

- `SRAM`
- `HBM`
- `compressed HBM`
- `host DRAM`
- `SSD/offload`

Each tier has a modeled:

- latency
- bandwidth
- capacity
- energy cost
- promotion eligibility

The routing panels show tier hit rates, traffic, and fallback escalation.

## SRAM fragmentation handling

The simulator includes a simple fragmentation model with:

- free and allocated regions
- shared and pinned blocks
- failed placements
- optional compaction
- relocation DMA traffic

This helps illustrate why residency management is also an address-space and fragmentation problem, not just a ranking problem.

## Compressed KV handling

The runtime can model:

- uncompressed SRAM
- quantized HBM
- compressed cold storage

The compression panel shows:

- compression ratio
- decompression latency
- bandwidth savings
- effective capacity gain

## Runtime policy engine

Policies available in the UI:

- `latency optimized`
- `bandwidth optimized`
- `SRAM conservative`
- `aggressive promotion`
- `speculative-heavy`
- `tenant-fairness optimized`

These policies affect runtime behavior including promotion thresholds, DMA concurrency, speculative aggressiveness, and benchmark outcomes.

## Stress-event simulation

Buttons in the control panel let you inject runtime pressure:

- SRAM exhaustion
- DMA congestion
- speculative collapse
- eviction storm
- tenant burst
- prefix invalidation
- bandwidth saturation

The orchestrator and telemetry surfaces then reflect the resulting pressure, churn, or degradation.

## Telemetry dashboards

The repository includes systems-style telemetry surfaces for:

- SRAM hit rate
- HBM hit rate
- multi-tier routing mix
- DMA queue occupancy
- promotion churn
- residency half-life
- speculative rollback rate
- deterministic decode percentage
- effective bandwidth saved
- estimated latency saved
- tenant sharing efficiency

## Workload presets

Preset workloads help replay different serving conditions:

- chatbot assistant
- long-context reasoning
- RAG-heavy retrieval
- code generation
- multi-agent orchestration
- speculative decode stress
- multi-tenant enterprise serving

## Architecture screenshots

Suggested captures for the repo page or a write-up:

- orchestrator state panel
- deterministic execution windows panel
- runtime architecture view
- microarchitecture view

## Telemetry screenshots

Suggested captures:

- telemetry dashboard graph
- fragmentation map
- multi-tier memory panel
- DMA queue with active and completed descriptors

## Orchestration screenshots

Suggested captures:

- execution timeline with an active DMA promotion event
- shared-prefix panel with refcounted reuse
- partition panel under a tenant-priority policy
- speculative decode panel during rollback-heavy stress

## Export examples

Use `Generate Research Artifact` to export:

- `research-artifact.json`
- `orchestration-trace.json`
- `dma-trace.json`
- `tier-residency-snapshot.json`
- `fragmentation-map.json`
- `routing-statistics.csv`
- `telemetry-dump.json`
- `benchmark-report.json`
- `architecture-view.svg`
- `microarchitecture-view.svg`

## Repository structure

- `index.html` - browser-native UI shell
- `styles.css` - layout, panels, heatmaps, dashboards, and diagrams
- `runtime-core.js` - shared state, model geometry, sessions, head profiles
- `orchestrator.js` - centralized control-plane state and partitioning
- `tiers.js` - multi-tier memory model
- `compression.js` - compressed KV behavior
- `fragmentation.js` - SRAM fragmentation and compaction
- `telemetry.js` - rolling metrics and event counters
- `metrics.js` - high-level metric summaries
- `policies.js` - runtime policy definitions
- `workloads.js` - replayable workload presets
- `residency.js` - SRAM directory and shared-prefix metrics
- `dma.js` - deterministic DMA scheduling
- `routing.js` - decode routing decisions
- `eviction.js` - eviction-policy scoring and comparison
- `speculative.js` - speculative rollback behavior
- `timeline.js` - event sequencing and playback
- `benchmark.js` - runtime comparisons
- `export.js` - research artifact generation
- `app.js` - UI binding and render orchestration

## Documentation

Core docs:

- [Architecture](./docs/architecture.md)
- [Benchmark methodology](./docs/benchmark-methodology.md)
- [Claim-support map](./docs/claim-map.md)

Runtime docs:

- [Runtime orchestration](./docs/runtime-orchestration.md)
- [DMA engine](./docs/dma-engine.md)
- [Shared prefix reuse](./docs/shared-prefix-reuse.md)
- [Speculative decode](./docs/speculative-decode.md)

Control-plane docs:

- [Control plane](./docs/control-plane.md)
- [Deterministic execution](./docs/deterministic-execution.md)
- [Multi-tier memory](./docs/multi-tier-memory.md)
- [Fragmentation](./docs/fragmentation.md)
- [Runtime policies](./docs/runtime-policies.md)
- [Telemetry](./docs/telemetry.md)

## Disclaimer

This repository is a `deterministic educational systems simulator`, not a production inference runtime, hardware simulator, or full transformer benchmark.

It is intended to:

- illustrate orchestration concepts
- model residency and routing tradeoffs
- demonstrate control-plane behavior
- support explanation of possible patent-relevant architecture themes

It does `not` claim cycle-accurate timing, production-quality model fidelity, legal conclusions, or patentability guarantees.

## Maintainer

- `Manish KL`
