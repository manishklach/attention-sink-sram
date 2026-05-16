# Comparative Analysis

This repository is not presented as a benchmark winner. It is positioned as a different architectural frame.

## Traditional cache hierarchies

Traditional cache hierarchies optimize for locality through reactive placement and replacement. They are powerful, but they typically do not expose replay-aware residency contracts, deterministic execution windows, or topology-aware orchestration semantics.

## Virtual-memory paging

Paging provides abstraction and address translation. It does not, by itself, define how inference runtimes should preserve deterministic decode windows, schedule promotion waves, or coordinate DMA against topology and replay boundaries.

## PagedAttention-style systems

PagedAttention-style designs improve KV memory efficiency through paging and indirection. The simulator extends beyond paging by modeling:

- explicit residency contracts
- replay checkpoints
- compiler/runtime coordination
- DMA scheduling as an execution primitive

## vAttention-style virtual remapping

Virtual remapping improves placement flexibility and fragmentation behavior. The architecture here treats virtual remapping as one mechanism inside a broader control plane rather than the whole execution model.

## FlashAttention-style IO-aware execution

IO-aware attention focuses on kernel-level movement and locality efficiency. This project instead focuses on system-level orchestration: what stays resident, when it may move, and how those decisions are coordinated across decode regions and memory tiers.

## Reactive memory management

Reactive memory management responds to pressure after it appears. This project emphasizes bounded planning and legal adaptation windows before or alongside that pressure.

## NUMA and disaggregated memory systems

NUMA and disaggregated systems already teach that topology matters. The simulator borrows that intuition and applies it to distributed KV placement, pooled memory, and topology-aware decode routing.

## Summary distinction

The repository’s key claim is not “paging is wrong” or “caching is obsolete.”  
It is that future transformer inference may require a stronger abstraction:

`memory movement coordinated as part of execution, under replay- and topology-aware orchestration semantics.`
