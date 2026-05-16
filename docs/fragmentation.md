# Fragmentation

This document explains the SRAM fragmentation model used in the simulator.

## What is modeled

The simulator tracks:

- free regions
- allocated regions
- shared and pinned blocks
- failed placements
- compaction events
- relocation traffic

## Why fragmentation is included

A runtime may identify the right entry to promote and still fail to place it cleanly if the available fast-tier address space is fragmented. The fragmentation panel helps explain that:

- residency is spatial, not only logical
- compaction may require additional DMA traffic
- oversubscription and fragmentation can coexist

## Compaction

The simulator includes a simple compaction toggle. When enabled, the model can illustrate:

- extra relocation traffic
- compaction overhead
- reduced failed placements in some scenarios

This is a conceptual aid rather than a low-level allocator benchmark.
