# Attention-Sink SRAM

Browser-native distributed memory-fabric simulator for `SRAM-aware transformer KV orchestration`, with deterministic experiments, cluster topology modeling, remote KV routing, pooled memory, and exportable research artifacts.

Open [index.html](./index.html) directly in a browser. No build step, framework, or package manager is required.

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## Positioning

This repository now models a future transformer inference stack where:

- KV state is distributed across devices
- SRAM is scarce and selectively promoted
- HBM is local but not always sufficient
- pooled memory absorbs colder or shared residency
- decode fetches can traverse a fabric
- scheduler decisions depend on topology, congestion, and deterministic windows

It is designed as a browser-native systems-research and architecture simulator rather than a production runtime.

## What it simulates

- control-plane orchestration
- deterministic execution windows
- per-head and per-layer KV promotion
- multi-tier local memory
- multi-device topology
- fabric congestion and route saturation
- remote KV fetch routing
- pooled memory spillover
- multicast and chained DMA waves
- topology-aware scheduler decisions
- degraded modes and rerouting
- energy and cost modeling
- trace-driven experiments and publication-style exports

## Distributed cluster features

### Multi-device topology

The simulator supports modeled devices such as:

- GPU
- accelerator
- CPU-attached SRAM
- pooled memory node
- SmartNIC/DPU
- storage offload node

Topologies currently illustrated:

- `1D`
- `mesh`
- `fat-tree`
- `star`

### Fabric simulation

Fabric modes:

- `PCIe-like`
- `NVLink-like`
- `CXL-like`
- `Ethernet/RDMA-like`

The fabric layer models:

- bandwidth
- contention
- congestion
- latency
- multicast efficiency

### Distributed KV placement

Placement policies include:

- local-first
- topology-aware
- latency-aware
- bandwidth-aware
- pooled-memory optimized
- sink-density optimized

These policies shape where KV slices land, how often remote fetches occur, and how aggressively pooled memory is used.

### Remote KV fetch routing

Decode lookups may resolve through:

- local SRAM
- remote SRAM
- remote HBM
- pooled memory
- storage offload

The simulator shows hop count, route congestion, fallback frequency, and approximate remote latency.

### CXL-like pooling

Pooled memory nodes model:

- shared spillover capacity
- shared-prefix residency
- pooled occupancy
- pooled fragmentation
- remote access amplification

### Distributed DMA orchestration

DMA is no longer only local. The simulator includes modeled:

- peer DMA
- multicast waves
- promotion waves
- synchronized migrations
- congestion amplification

### Scheduler and degraded modes

The scheduler exposes placement rationale for:

- tenant placement
- shared-prefix colocation
- congestion mitigation
- execution-window preservation

Stress-event buttons model:

- bandwidth saturation
- device loss
- pooled-memory exhaustion
- remote latency spikes
- existing local stressors such as eviction storms and DMA congestion

## Research and experimentation

The repository includes:

- experiment queueing
- batched runs
- reproducibility checks
- trace replay
- parameter sweeps
- policy comparison
- local result persistence
- notebook mode
- graph export

## Distributed workload presets

In addition to earlier single-node style workloads, the simulator now includes cluster-oriented presets such as:

- hyperscale chatbot serving
- retrieval-heavy cluster
- pooled-memory constrained deployment
- edge-cloud hybrid inference

The workload suite catalog in the docs also covers:

- enterprise multi-tenant serving
- multi-agent orchestration
- prefix-sharing hyperscale serving
- long-context serving

## Research exports

Use `Generate Research Artifact` to export:

- topology snapshots
- fabric congestion traces
- migration traces
- distributed routing traces
- energy reports
- cost/performance reports
- benchmark summaries
- telemetry dumps
- architecture SVGs

Use `Generate Paper Figures` to export:

- research graphs
- telemetry figures
- architecture diagrams
- microarchitecture diagrams

## Screenshot placeholders

Suggested screenshots for a paper, memo, or repo page:

- distributed topology panel
- fabric + remote routing panel
- scheduler panel
- pooling panel
- energy + economics panel
- telemetry dashboard
- experiment framework
- execution timeline

## Repository structure

- `index.html` - browser-native simulator UI
- `app.js` - render orchestration and snapshot pipeline
- `runtime-core.js` - base simulator state, geometry, sessions
- `topology.js` - multi-device topology modeling
- `fabric.js` - interconnect modeling and congestion
- `pooling.js` - pooled-memory simulation
- `scheduler.js` - topology-aware scheduling
- `migration.js` - distributed KV migration waves
- `energy.js` - energy accounting
- `economics.js` - infrastructure cost modeling
- `routing.js` - local and distributed decode routing
- `telemetry.js` - rolling metrics and event counters
- `experiments.js`, `sweeps.js`, `reproducibility.js`, `replay.js`, `persistence.js`, `notebook.js`, `graphs.js` - research framework

## Documentation

Core docs:

- [Architecture](./docs/architecture.md)
- [Experiments](./docs/experiments.md)
- [Evaluation methodology](./docs/evaluation-methodology.md)
- [Metrics](./docs/metrics.md)

Distributed docs:

- [Distributed topology](./docs/distributed-topology.md)
- [Fabric simulation](./docs/fabric-simulation.md)
- [CXL pooling](./docs/cxl-pooling.md)
- [Distributed routing](./docs/distributed-routing.md)
- [Topology-aware scheduling](./docs/topology-aware-scheduling.md)
- [Energy modeling](./docs/energy-modeling.md)
- [Economic modeling](./docs/economic-modeling.md)

Additional docs:

- [Control plane](./docs/control-plane.md)
- [Deterministic execution](./docs/deterministic-execution.md)
- [Multi-tier memory](./docs/multi-tier-memory.md)
- [Telemetry](./docs/telemetry.md)
- [Policy comparison](./docs/policy-comparison.md)
- [Workloads](./docs/workloads.md)

## Disclaimer

This repository is a `deterministic educational systems simulator`.

It is intended to:

- model architectural tradeoffs
- illustrate cluster-level memory orchestration behavior
- support explanation of patent-adjacent architecture ideas
- provide a reproducible experimentation surface

It does `not` claim:

- real hardware equivalence
- cycle-accurate simulation
- production inference performance
- legal conclusions or patentability guarantees

## Maintainer

- `Manish KL`
