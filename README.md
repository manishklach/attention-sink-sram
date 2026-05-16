# Attention-Sink SRAM

Browser-native research and architecture simulator for `SRAM-aware transformer KV orchestration`, with deterministic experiments, trace replay, policy comparison, and exportable patent-support artifacts.

Open [index.html](./index.html) directly in a browser. No build step, package manager, or framework is required.

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## Positioning

This repository is no longer just an interactive placement demo. It is designed to illustrate how a future inference runtime could coordinate:

- per-head and per-layer KV promotion
- deterministic SRAM residency windows
- decode-time routing across multiple memory tiers
- shared-prefix reuse across tenants
- DMA scheduling and promotion traffic
- speculative rollback and reclamation
- fragmentation, compaction, and relocation
- runtime policy comparison
- trace-driven, reproducible experimentation

## Key features

- `Control-plane orchestrator`
  Models global scheduling, promotion coordination, SRAM budgeting, decode routing, eviction coordination, and speculative rollback pressure.

- `Trace-driven experimentation`
  Queue named experiments, run batched configurations, sweep parameters, compare policies, and persist results locally.

- `Deterministic reproducibility`
  Seeded runs, fixed scheduling mode, replay verification, snapshot hashing, and experiment checksums.

- `Multi-tier routing`
  Simulates `SRAM`, `HBM`, `compressed HBM`, `host DRAM`, and `SSD/offload` routing behavior.

- `Per-head promotion`
  Whole-token KV movement is not the only option. The simulator can model `per-head` and `per-head + layer-range` slice promotion.

- `Shared-prefix reuse`
  Refcounted shared entries are promoted once and reused across attached sessions while they remain resident.

- `Publication-style figures`
  Research graphs, architecture figures, telemetry plots, and SVG exports are built in.

- `Notebook mode`
  Save experiment observations and export them as Markdown or HTML summaries.

## Why per-head promotion matters

The repo explicitly models why selective slice placement is more SRAM-efficient than full-token KV movement.

Example:

- whole-token KV promotion with `8` KV heads stores all heads for a token
- per-head promotion with `3` promoted heads stores only `3/8` of the head slices
- this reduces per-token SRAM footprint by about `62.5%`
- the saved footprint can be reinvested into more sink tokens, longer residency windows, or higher tenant concurrency

This is one of the core architecture ideas the simulator is meant to explain.

## Experiment framework

The UI now supports:

- queueing experiments
- running named experiments
- batched execution
- seeded replay
- deterministic replay verification
- parameter sweeps
- side-by-side policy comparison
- local result persistence

Each experiment captures:

- workload
- runtime policy
- memory policy
- eviction policy
- promotion policy
- seed
- duration
- parameter overrides

## Reproducibility

Reproducibility mode includes:

- seeded RNG
- deterministic event ordering
- snapshot hashing
- experiment checksums
- replay consistency verification

This is a `deterministic simulator`, so repeated runs with the same configuration should produce the same trace and checksum unless the config changes.

## Workload replay and suites

Built-in workload presets include:

- chatbot assistant
- long-context reasoning
- RAG-heavy retrieval
- code generation
- multi-agent orchestration
- speculative decode stress
- multi-tenant enterprise serving

Research scenario suites described in the docs include:

- long-context serving
- enterprise multi-tenant
- RAG-heavy inference
- agentic orchestration
- high speculative decode
- SRAM constrained edge inference
- extreme tenant burst
- prefix-sharing hyperscale serving

## Parameter sweeps

Sweepable parameters include:

- SRAM size
- DMA bandwidth
- promotion threshold
- speculative acceptance rate
- residency window size
- promoted heads
- tenant count
- decode concurrency

The sweep engine supports:

- linear sweeps
- logarithmic sweeps
- optional two-dimensional sweeps

## Policy comparison

The simulator can compare multiple runtime policies side by side, including:

- latency optimized
- bandwidth optimized
- SRAM conservative
- aggressive promotion
- speculative-heavy
- tenant-fairness optimized
- sink-stability optimized
- deterministic-residency optimized

Comparisons include:

- SRAM hit rate
- latency proxy
- DMA traffic
- fragmentation
- promotion churn
- rollback pressure
- fairness and reuse proxies

## Publication-quality figures

Use `Generate Paper Figures` to export:

- research graphs
- telemetry figures
- architecture diagrams
- microarchitecture diagrams

Use `Generate Research Artifact` to export:

- experiment config
- benchmark summaries
- residency tables
- orchestration trace
- DMA trace
- fragmentation map
- routing CSV
- telemetry dump
- local result history

## Notebook mode

Notebook mode lets you:

- annotate runs
- save research notes locally
- export Markdown summaries
- export HTML summaries

## Screenshot placeholders

Suggested screenshots for a paper, memo, or repo page:

- orchestrator state
- execution timeline
- multi-tier memory panel
- telemetry dashboard
- experiment framework
- parameter sweep graph
- residency directory
- fragmentation map

## Repository structure

- `index.html` - browser-native UI shell
- `styles.css` - layout, panels, dashboards, and SVG styling
- `runtime-core.js` - shared state, model geometry, sessions, and head profiles
- `orchestrator.js` - control-plane scheduling and residency pressure
- `experiments.js` - experiment queue and batched execution
- `sweeps.js` - parameter sweep generation
- `reproducibility.js` - seeded replay, hashing, and deterministic verification
- `replay.js` - trace validation and replay conversion
- `persistence.js` - browser-local result storage
- `notebook.js` - local notes and report export
- `graphs.js` - reusable research graph rendering and export
- `metrics.js` - research metrics and definitions
- `policies.js` - runtime policy profiles
- `workloads.js` - workload presets and scenario suites
- `telemetry.js` - rolling metrics and event counters
- `compression.js` - compressed KV behavior
- `tiers.js` - multi-tier routing model
- `fragmentation.js` - fragmentation, compaction, and relocation
- `residency.js` - SRAM residency directory and shared-prefix reuse
- `dma.js` - deterministic DMA scheduling
- `routing.js` - decode routing decisions
- `eviction.js` - eviction policy comparison
- `speculative.js` - speculative decode and rollback behavior
- `timeline.js` - event sequencing and playback
- `benchmark.js` - benchmark comparison surfaces
- `export.js` - research artifact export
- `app.js` - UI binding and rendering orchestration

## Documentation

Architecture and methodology:

- [Architecture](./docs/architecture.md)
- [Benchmark methodology](./docs/benchmark-methodology.md)
- [Evaluation methodology](./docs/evaluation-methodology.md)
- [Metrics](./docs/metrics.md)

Runtime and control-plane:

- [Runtime orchestration](./docs/runtime-orchestration.md)
- [Control plane](./docs/control-plane.md)
- [DMA engine](./docs/dma-engine.md)
- [Deterministic execution](./docs/deterministic-execution.md)
- [Multi-tier memory](./docs/multi-tier-memory.md)
- [Fragmentation](./docs/fragmentation.md)
- [Runtime policies](./docs/runtime-policies.md)
- [Telemetry](./docs/telemetry.md)

Workloads and experiments:

- [Experiments](./docs/experiments.md)
- [Reproducibility](./docs/reproducibility.md)
- [Workloads](./docs/workloads.md)
- [Policy comparison](./docs/policy-comparison.md)

Patent-support mapping:

- [Claim-support map](./docs/claim-map.md)
- [Shared prefix reuse](./docs/shared-prefix-reuse.md)
- [Speculative decode](./docs/speculative-decode.md)

## Disclaimer

This repository is a `deterministic educational systems simulator`, not a production inference runtime, hardware simulator, or full transformer benchmark.

It is intended to:

- model orchestration concepts
- illustrate tradeoffs between memory tiers
- support explanation of architectural and patent-adjacent ideas
- provide a reproducible experimentation surface for discussion

It does `not` claim:

- cycle-accurate hardware equivalence
- production model fidelity
- measured production throughput
- legal conclusions or patentability guarantees

## Maintainer

- `Manish KL`
