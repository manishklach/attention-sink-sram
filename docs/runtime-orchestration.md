# Runtime Orchestration

This document explains the runtime-oriented portion of the simulator. It is intended to support explanation of a system that dynamically orchestrates SRAM-resident KV state during live decode execution.

## Flow illustrated by the simulator

The repo models a repeated orchestration loop:

1. `Prefill`
The session prompt is ingested and a candidate working set is established.

2. `Sink detection`
The runtime identifies prompt or prefix regions that are disproportionately reused or likely to be reused.

3. `DMA promotion`
Selected KV entries or slices are promoted from the bulk tier into the SRAM tier.

4. `SRAM residency`
Entries remain resident while their reuse remains valuable and while the current policy permits them to stay.

5. `Decode routing`
Decode-time lookups are routed to SRAM, HBM, or mixed mode depending on the residency state and the slice granularity.

6. `Eviction or re-promotion`
Entries may cool, be evicted, or be re-promoted later if the runtime decides they are again worth the SRAM cost.

7. `Shared-prefix attach/detach`
Sessions can share one prefix-resident entry, and the simulator shows how residency evolves as references are attached or removed.

## What is dynamic

The runtime is not modeled as a one-time placement choice. It is modeled as an orchestrator that updates:

- which sessions are sharing a prefix
- which entries are resident
- which transfers are in flight
- which decode requests hit SRAM
- which policy is controlling eviction behavior

## Correctness framing

The simulator is careful to illustrate a placement and routing concept, not a numerical-modification concept:

- KV values themselves are not altered
- the model illustrates `where` state is served from
- correctness preservation is expressed as memory-tier relocation rather than semantic mutation

## Educational value

The execution timeline, routing table, architecture panel, and residency directory together help explain how a runtime could coordinate:

- observation
- classification
- migration
- residency management
- decode-time routing

without requiring the entire KV cache to fit in SRAM.
