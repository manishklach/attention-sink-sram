# Design Principles

This project is organized around a specific set of systems-design principles.

## 1. Deterministic execution over opportunistic caching

Traditional cache thinking assumes that useful locality will be discovered reactively. This repository instead models an execution regime in which critical KV residency is shaped ahead of time or inside bounded adaptation windows, so decode behavior remains stable across replay and repeated serving.

## 2. Orchestration over reactive paging

Paging is a useful mechanism, but it is not the full control plane. The simulator treats promotion, migration, and replay protection as explicit orchestration actions. This makes memory movement part of execution planning rather than a side effect of pressure alone.

## 3. Residency guarantees over best-effort placement

Hot KV regions, shared prefixes, and replay-sensitive decode windows benefit from explicit guarantees. The project uses residency contracts, pinned windows, and orchestration epochs to illustrate how fast-memory availability can become part of runtime correctness and predictability.

## 4. Compiler/runtime cooperation

The compiler is responsible for producing bounded execution structure: regions, checkpoints, promotion windows, and legality boundaries. The runtime is responsible for adapting within those boundaries. Neither side is sufficient alone.

## 5. Bounded execution regions

Adaptation should not be unconstrained. The simulator therefore uses execution regions and replay checkpoints to illustrate where orchestration may evolve and where state must remain stable.

## 6. Topology-aware orchestration

Once KV state can live across devices, pooled memory, or remote tiers, placement is no longer a local cache problem. Fabric topology, hop count, pooled-memory occupancy, and DMA wavefronts become part of the placement semantics.

## 7. Replay-safe execution windows

Graph-captured or replayable decode windows require stable assumptions. The architecture therefore treats replay as a first-class constraint on migration timing, promotion timing, and eviction legality.

## 8. Promotion as scheduling, not caching

Promotion is modeled as a scheduled operation with bandwidth cost, legality constraints, and downstream consequences. This is a stronger statement than saying “a hot page should be cached.”

## 9. Memory as orchestrated infrastructure

The long-term thesis is that memory in future transformer inference systems will behave more like infrastructure under policy control than like a passive substrate behind kernels.
