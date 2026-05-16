# Changelog

All notable changes to this project will be documented in this file.

The format is intentionally lightweight and oriented toward architectural milestones rather than package-management semantics.

## [v1.0.0] - 2026-05-16

First formal release of the repository as a coherent systems architecture platform.

### Positioning

- reframed the project from an SRAM-placement simulator into a browser-native research platform for deterministic KV orchestration
- established the core thesis that future transformer inference may require memory orchestration as an execution model, not only paging or caching
- aligned the repository around compiler/runtime coordination, residency guarantees, replay-safe execution, DMA scheduling, and topology-aware placement

### Architecture thesis layer

- added `Architecture Thesis Mode` to the browser UI
- introduced guided architectural progression across:
  - memory-bound inference pressure
  - orchestration over caching
  - compiler/runtime cooperation
  - deterministic decode windows
  - topology-aware placement
  - explicit lifecycle management
- added formal execution-model and memory-lifecycle export surfaces

### Documentation and research readability

- rewrote `README.md` around architectural storytelling instead of a feature dump
- added a guided documentation spine beginning with `docs/start-here.md`
- added formal documents for:
  - design principles
  - execution model
  - memory lifecycle
  - orchestration philosophy
  - comparative analysis
  - glossary
  - architectural invariants
  - research roadmap
  - why this matters
- organized docs into reading-oriented sections:
  - concepts
  - architecture
  - execution
  - runtime
  - experiments
  - comparisons
  - exports

### Runtime and compiler integration model

- modeled orchestration IR, runtime ABI concepts, virtualized KV placement, paged and remapped layouts, compiler execution planning, replayable graph windows, and kernel launch orchestration
- added disaggregated prefill/decode views and lifetime analysis to make the execution model more concrete

### Distributed memory-fabric platform

- expanded the simulator from single-node placement into cluster-level orchestration
- included:
  - multi-device topology simulation
  - remote KV fetch routing
  - pooled memory concepts
  - topology-aware scheduler decisions
  - distributed DMA orchestration
  - fabric congestion and degraded-mode modeling
  - energy and economic views

### Research and evaluation support

- added workload replay, deterministic reproducibility checks, parameter sweeps, policy comparison, notebook mode, local result persistence, publication-style graph export, and bundled research artifact export

### Patent reference

- repository references Indian patent application `202641062302`
- filing title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`

### Notes

- this project remains an educational and architectural simulator
- it does not claim cycle-accurate hardware equivalence, production-runtime parity, or legal conclusions
