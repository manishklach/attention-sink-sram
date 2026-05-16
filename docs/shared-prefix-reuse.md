# Shared Prefix Reuse

This document explains the multi-tenant shared-prefix portion of the simulator.

## Motivation

In many inference-serving environments, several sessions may share:

- a system prompt
- a long instruction preamble
- a RAG-derived context prefix

If that shared prefix is promoted independently for every session, SRAM and DMA traffic are both wasted.

## What the simulator demonstrates

The repo illustrates a simple reuse strategy:

- a shared prefix is promoted once
- the shared entry carries a refcount
- multiple sessions can attach to that same resident state
- the entry remains resident while it is referenced
- detaching sessions lowers the refcount and can make the entry evictable depending on policy

## Visualization surfaces

Shared-prefix behavior appears in several places:

- execution timeline
- SRAM residency directory
- shared-prefix metrics panel
- architecture diagram

## Metrics illustrated

The simulator surfaces:

- SRAM bytes saved
- duplicate promotions avoided
- avoided HBM reads
- live refcount

These metrics are not intended as production measurements. They are intended to support explanation of why shared residency can materially improve system efficiency.

## Interaction with eviction policy

Shared entries can be treated differently from private entries. The simulator includes policies that illustrate:

- refcount protection
- pinned shared-prefix residency
- more aggressive churn under simple LRU-like behavior

This helps explain why shared residency and eviction policy are coupled concerns rather than separate optimizations.
