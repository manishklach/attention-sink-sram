# DMA Engine

This simulator includes a simplified DMA orchestration model to support explanation of how promotion traffic could be scheduled between a bulk memory tier and an SRAM fast tier.

## Descriptor model

Each promotion operation is represented as a transfer descriptor containing:

- descriptor id
- session id
- token range
- heads
- layers
- bytes
- source tier
- destination tier
- enqueue time
- completion time

## Queue behavior

The DMA model illustrates:

- a queue of waiting promotions
- a limited number of outstanding transfer slots
- finite bandwidth
- active transfers and completed transfers

Transfers are deterministic and scheduled using the configured queue and slot budget. The simulator does not claim to be cycle-accurate; it is intended to support explanation of orchestration logic.

## Why DMA matters in this artifact

The runtime story is stronger when promotion is shown as an explicit movement step rather than an abstract placement decision. The DMA panel demonstrates:

- that promotions consume a resource
- that promotions can queue behind other promotions
- that the runtime must reason about bytes moved, not only cache hits
- that speculative or churn-heavy policies can increase DMA traffic materially

## Relationship to routing

The simulator illustrates a simple pipeline:

1. sink or shared-prefix state is identified
2. a descriptor is issued
3. the descriptor completes
4. the promoted state becomes available to the decode router

This supports explanation of how decode routing and memory promotion can be connected through an explicit scheduling layer.
