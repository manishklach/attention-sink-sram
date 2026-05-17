# KV Memory Orchestrator

## Introduction

Modern AI systems do not only spend time doing math. They also spend a lot of time moving memory around.

LLMs store previous tokens in a KV cache. As conversations and context windows grow, this memory becomes massive. But not all tokens matter equally. Some are repeatedly referenced, while others are rarely used again.

This project explores how an AI runtime could keep important KV memory in very fast memory and move less important memory to slower tiers.

Like a librarian keeping frequently used books on the front desk instead of walking to the back shelves every time.

Release history is tracked in [CHANGELOG.md](./CHANGELOG.md).

## What does the simulator actually do?

This is a browser-based research simulator.

It shows how a future inference runtime could:

- generate attention patterns
- compute attention-sink scores
- identify important KV regions
- promote important KV into SRAM
- leave less important KV in HBM/DRAM/slower tiers
- route decode reads to the right tier
- evict memory deterministically
- replay memory decisions for analysis

## What problem it solves

Long-context inference is increasingly limited by memory movement, bandwidth, latency, and energy.

Instead of treating all KV cache entries equally, this project explores orchestrating KV memory as part of execution.

The runtime should know:

- what memory matters
- where it should live
- when it should move
- when it can be evicted
- how future reads should be routed

## Why this is invention-oriented

The idea is not simply "use a cache."

The invention direction is about combining:

- attention-derived sink scoring
- explicit KV residency decisions
- SRAM/HBM tier placement
- decode-time routing
- deterministic allocation and eviction
- DMA-style movement
- replayable orchestration traces
- runtime/compiler coordination

This repository does not claim to prove patentability or real hardware performance. It provides an executable simulator and documentation for exploring the technical architecture.

## What this is not

This is not:

- a production LLM server
- a replacement for vLLM or FlashAttention
- a real CUDA/HBM/SRAM allocator
- a hardware implementation
- a production security system
- a benchmark claiming real silicon speedups

## Simple flow

```text
User prompt / long context
        ↓
Transformer attention
        ↓
KV cache grows
        ↓
Sink score identifies frequently used KV regions
        ↓
Orchestrator decides:
  SRAM / HBM / DRAM / spill
        ↓
Decode reads from the selected tier
        ↓
Trace can be replayed and analyzed
```

## Why it matters

In simple terms, this matters because the runtime can spend less time dragging memory around and more time using the right memory at the right moment.

This can help with:

- less memory movement
- lower bandwidth pressure
- better long-context scaling
- more predictable latency
- better use of scarce fast memory
- lower potential energy cost
- more reproducible inference execution

## Example

In a long conversation, the model may repeatedly attend to:

- system prompt tokens
- instruction tokens
- important retrieved facts
- shared prefix tokens

Instead of treating every KV entry equally, this simulator shows how those high-value regions could be promoted into faster memory while less important regions remain in bulk memory.

## Performance orchestration vs isolation modeling

This repository covers two related but distinct topics.

Performance orchestration is about:

- sink score
- SRAM/HBM tiering
- DMA scheduling
- decode routing

Isolation-boundary modeling is about:

- protected reasoning or log regions
- deterministic audit traces
- separation of untrusted tool payloads
- explicit mapping and export rules

They are connected at the runtime architecture level, but they are not the same claim. One concerns performance-oriented memory placement. The other concerns how protected and untrusted memory objects could be modeled separately in a future system.

## How to read this repo

1. Start with the browser simulator.
2. Read the Core Algorithms section.
3. Review deterministic allocation and memory-tier routing.
4. Review orchestration IR and replay semantics.
5. Review `docs/` for architecture and patent-support explanation.

To run the simulator locally, open [index.html](./index.html) in a browser. The project is dependency-free and requires no build step.

## Technical architecture

Browser-native research platform exploring deterministic KV orchestration, memory-tier residency, and compiler/runtime coordination for future transformer inference systems.

This repository is built around one architectural thesis:

future transformer inference may need a stronger memory model than caching and paging alone.

The simulator therefore treats KV state as something that can be observed, classified, promoted, pinned, shared, migrated, replay-protected, compressed, and reclaimed under explicit orchestration rules. In that framing, memory movement becomes part of execution control rather than a purely reactive background mechanism.

## Core Algorithms Implemented

This repository now includes executable implementations of the core algorithmic primitives behind the simulator:

- cumulative sink score `S(t) = Σ A(l,h,i,t)` over synthetic attention tensors
- realistic synthetic attention tensor generation with sink-heavy, local, recency-biased, retrieval-biased, and diffuse heads
- sink-threshold-based SRAM promotion decisions
- split-path log-sum-exp merge for sink and bulk decode partitions
- numerical verification of merged attention against full attention

That means the project is not only an architecture shell. It also contains working proof-of-concept implementations of the algorithmic ideas used by the simulator.

## Deterministic Allocation and Isolation Boundary Modeling

The repository now also models a separate layer of deterministic allocation and isolation-boundary behavior.

That layer is meant to clarify a different concern from performance orchestration:

- deterministic allocation matters for auditability and replay
- SRAM/HBM tiering can be modeled with ring-buffer-style residency
- protected reasoning-log regions can be modeled separately from KV performance regions
- external tool payloads can be treated as untrusted memory objects
- export, DMA, and overwrite permissions can be modeled as explicit region flags

This is simulator-level modeling, not hardware enforcement. The code is intended to illustrate how a future runtime could separate performance-oriented residency decisions from isolation-oriented boundary checks without claiming production security.

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

Algorithm notes:

- [Core Algorithms](./docs/core-algorithms.md)
- [Sink Score](./docs/sink-score.md)
- [Log-Sum-Exp Merge](./docs/log-sum-exp-merge.md)

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
