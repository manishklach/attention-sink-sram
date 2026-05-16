# KV Memory Orchestrator

Browser-native research platform exploring deterministic KV orchestration, memory-tier residency, and compiler/runtime coordination for future transformer inference systems.

Open [index.html](./index.html) directly in a browser. No build step, framework, or package manager is required.

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## Positioning

This repository now explores the gap between:

- orchestration ideas
- plausible inference runtime integration

It models a future stack where compiler planning, runtime ABI objects, virtualized KV placement, graph-captured execution, distributed topology, and deterministic replay all interact.

## What it now covers

- deterministic KV residency
- SRAM/HBM tiering
- distributed memory-fabric routing
- runtime ABI object handles
- virtualized KV page tables
- PagedAttention-style and vAttention-style layout ideas
- compiler execution planning
- CUDA-graph-like replay windows
- kernel launch orchestration
- disaggregated prefill/decode coordination
- lifetime analysis and reclaim safety
- telemetry, experiment sweeps, and research exports

## Runtime ABI

The simulator now includes modeled:

- KV object handles
- residency descriptors
- scheduling flags
- replay flags
- orchestration commands
- replay checkpoints

This is intended to illustrate what a future orchestration-aware runtime interface might look like.

## Compiler execution plans

The compiler planning layer generates modeled:

- orchestration IR
- execution regions
- DMA schedules
- replay checkpoints
- promotion windows

Modes include:

- static planning
- adaptive planning
- feedback-driven planning

## Paged KV layouts and virtualized residency

Selectable layout modes:

- contiguous KV
- PagedAttention-style paging
- vAttention-style virtual remapping
- sink-aware deterministic residency
- hybrid paging + deterministic residency

The virtualized KV panel shows logical-to-physical mapping, remap counts, and migration eligibility.

## Graph replay execution

The launch model explores:

- captured decode regions
- replayable graph windows
- graph invalidation
- orchestration bubbles
- dynamic fallback

This is meant to illustrate how deterministic execution windows could interact with graph-captured inference.

## Runtime integration concepts

The integration view models a future stack with:

- compiler
- orchestration runtime
- scheduler
- DMA engine
- residency manager
- topology manager
- fabric
- memory tiers
- kernels

It also includes a simple disaggregated prefill/decode view with prefill nodes, decode nodes, and remote KV transfer cost.

## Research comparison mode

The simulator includes a comparison surface for:

- FlashAttention-style IO-aware execution
- PagedAttention-style paging
- vAttention-style remapping
- deterministic residency orchestration
- hybrid orchestration models

This comparison is a modeled research surface, not a production benchmark.

## Exports

`Generate Research Artifact` exports:

- runtime ABI JSON
- virtual KV maps
- compiler plans
- launch orchestration traces
- lifetime analysis
- topology snapshots
- fabric traces
- migration traces
- energy reports
- cost/performance reports

`Generate Paper Figures` exports:

- research graph SVGs
- telemetry SVGs
- runtime architecture SVGs
- distributed topology SVGs
- compiler-plan SVGs

## Documentation

- [Runtime ABI](./docs/runtime-abi.md)
- [Virtualized KV](./docs/virtualized-kv.md)
- [Compiler planning](./docs/compiler-planning.md)
- [Graph execution](./docs/graph-execution.md)
- [Disaggregated prefill/decode](./docs/disaggregated-prefill-decode.md)
- [Runtime integration](./docs/runtime-integration.md)
- [Comparison with existing systems](./docs/comparison-with-existing-systems.md)

Additional architecture docs:

- [Distributed topology](./docs/distributed-topology.md)
- [Fabric simulation](./docs/fabric-simulation.md)
- [CXL pooling](./docs/cxl-pooling.md)
- [Energy modeling](./docs/energy-modeling.md)
- [Economic modeling](./docs/economic-modeling.md)
- [Experiments](./docs/experiments.md)
- [Metrics](./docs/metrics.md)

## Disclaimer

This repository is a deterministic educational systems simulator.

It is intended to:

- model orchestration concepts
- illustrate compiler/runtime coordination ideas
- explore future memory-fabric inference architectures
- support explanation of patent-adjacent architecture themes

It does not claim:

- production-runtime equivalence
- cycle-accurate execution
- direct benchmark superiority
- legal conclusions or patentability guarantees

## Maintainer

- `Manish KL`
