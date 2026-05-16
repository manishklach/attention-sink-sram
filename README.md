# KV Memory Orchestrator

Browser-native research platform exploring deterministic KV orchestration, memory-tier residency, and compiler/runtime coordination for future transformer inference systems.

This repository is built around one architectural thesis:

future transformer inference may need a stronger memory model than caching and paging alone.

The simulator therefore treats KV state as something that can be observed, classified, promoted, pinned, shared, migrated, replay-protected, compressed, and reclaimed under explicit orchestration rules. In that framing, memory movement becomes part of execution control rather than a purely reactive background mechanism.

Open [index.html](./index.html) directly in a browser. The project is dependency-free and requires no build step.

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## Architectural thesis

The core argument of the project is that transformer serving increasingly depends on:

- bounded execution regions
- residency guarantees instead of best-effort placement
- deterministic replay windows
- compiler/runtime cooperation
- topology-aware placement and routing
- DMA scheduling as part of orchestration

This is why the platform is organized around orchestration semantics rather than only cache behavior. Promotion is treated as scheduling. Residency is treated as a contract. Replay is treated as a runtime constraint. Topology is treated as part of the memory model.

## Execution philosophy

The simulator models an execution style in which compiler plans and runtime control cooperate.

The compiler contributes regions, replay checkpoints, promotion windows, and legality boundaries. The runtime contributes observation, classification, DMA coordination, routing, migration, and bounded adaptation. The result is not a static placement scheme and not an unconstrained reactive runtime. It is a model of controlled dynamism.

That distinction matters because decode-time inference is often limited by memory traffic, not only by arithmetic. Stable serving therefore depends on where state lives, when it may move, and which execution windows must remain replay-safe.

## What the platform helps explain

The repository is intended to make the following ideas concrete:

- why paging alone is insufficient for deterministic serving
- why orchestration differs from caching
- why residency contracts matter
- why topology changes placement semantics
- why DMA scheduling is part of runtime design
- why compiler planning and runtime adaptation should be discussed together

The browser UI includes an `Architecture Thesis Mode` that walks through those ideas as a guided narrative rather than as a feature checklist.

## Reading path

The cleanest way to approach the project is:

1. [Start Here](./docs/start-here.md)
2. [Design Principles](./docs/design-principles.md)
3. [Execution Model](./docs/execution-model.md)
4. [Memory Lifecycle](./docs/memory-lifecycle.md)
5. [Orchestration Philosophy](./docs/orchestration-philosophy.md)
6. [Comparative Analysis](./docs/comparative-analysis.md)
7. [Architectural Invariants](./docs/architectural-invariants.md)
8. [Why This Matters](./docs/why-this-matters.md)

For a broader map of the documentation, see [docs/README.md](./docs/README.md).

## Documentation structure

The docs are organized into reading-oriented sections:

- [Concepts](./docs/concepts/README.md)
- [Architecture](./docs/architecture/README.md)
- [Execution](./docs/execution/README.md)
- [Runtime](./docs/runtime/README.md)
- [Experiments](./docs/experiments/README.md)
- [Comparisons](./docs/comparisons/README.md)
- [Exports](./docs/exports/README.md)

## Outputs and exports

The simulator can export:

- execution-model and lifecycle SVGs
- architecture, topology, and compiler-plan diagrams
- orchestration and routing traces
- runtime ABI and virtual KV map JSON
- benchmark and telemetry dumps
- publication-oriented paper figures

These exports are intended to support explanation, review, and experimentation. They are not positioned as proof of real hardware behavior.

## Scope and limitations

This repository models and illustrates systems ideas. It does not claim:

- production-runtime equivalence
- cycle-accurate hardware behavior
- measured superiority over existing inference stacks
- legal conclusions or patentability guarantees

Its value is architectural clarity: a place to reason about deterministic KV residency, topology-aware orchestration, and future compiler/runtime integration in one coherent frame.

## Maintainer

`Manish KL`
