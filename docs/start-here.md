# Start Here

This repository explores a simple thesis:

Transformer inference is becoming a memory-orchestration problem, not only a compute problem.

The simulator models a future execution stack in which KV state is not treated as a passive cache artifact. Instead, it is observed, classified, promoted, pinned, shared, migrated, replay-protected, and reclaimed under explicit orchestration rules.

## What problem is being addressed

Long-context transformer inference is increasingly shaped by:

- repeated decode-time access to hot KV state
- tight fast-memory budgets
- DMA and fabric contention
- multi-tenant prefix sharing
- speculative rollback
- distributed placement across devices and pooled memory

Paging and caching help, but they do not by themselves explain how an inference runtime can preserve stable execution under these pressures.

## The core idea

This project models an execution style built around:

- deterministic execution regions
- bounded adaptation windows
- residency contracts rather than best-effort placement
- compiler/runtime coordination
- topology-aware placement and migration
- promotion as scheduling rather than caching

## Suggested reading path

1. Read [Design Principles](./design-principles.md) for the architectural posture.
2. Read [Execution Model](./execution-model.md) for the formal runtime flow.
3. Read [Memory Lifecycle](./memory-lifecycle.md) for how KV objects move through the system.
4. Read [Orchestration Philosophy](./orchestration-philosophy.md) for the conceptual distinction from caching and paging.
5. Read [Comparative Analysis](./comparative-analysis.md) for positioning against existing approaches.
6. Read [Architectural Invariants](./architectural-invariants.md) for the rules the simulator preserves.
7. Use the browser UI in `Architecture Thesis Mode` to walk through the same ideas visually.

## What the simulator is and is not

The simulator is:

- a browser-native research platform
- an architectural evaluation surface
- an educational model for memory orchestration
- a way to export formal diagrams and traces

The simulator is not:

- a production inference runtime
- a cycle-accurate hardware model
- a benchmark substitute
- a claim of direct hardware or software equivalence
