# Execution Model

The simulator models transformer inference as a sequence of bounded orchestration phases rather than a monolithic stream of memory accesses.

## Core execution concepts

- `execution region`: a bounded slice of work with stable orchestration assumptions
- `replay checkpoint`: a barrier at which replay, adaptation, or recovery may legally occur
- `residency epoch`: a period during which a residency contract remains valid
- `promotion wave`: a coordinated movement of KV state into a faster tier
- `deterministic decode window`: a region in which routing and residency are intended to remain stable
- `adaptation boundary`: a legal point at which the runtime may revise placement or scheduling

## Phase structure

1. Observation  
   Runtime telemetry, trace input, or compiler hints expose hotness, sink behavior, and sharing potential.

2. Classification  
   KV objects are classified according to sink density, replay sensitivity, tenant sharing, and topology cost.

3. Planning  
   Compile-time plans and runtime policy decide residency targets, DMA sequencing, and bounded execution regions.

4. Promotion  
   One or more promotion waves move selected KV objects or slices into target tiers.

5. Stable execution  
   Decode runs inside a replay-safe or deterministic window with constrained routing behavior.

6. Adaptation  
   At allowed boundaries, the runtime may adjust residency, scheduling, or routing.

7. Reclamation  
   KV objects may be compressed, evicted, migrated, or reclaimed when legality and replay safety allow it.

## Compile-time vs runtime responsibilities

The compiler provides:

- orchestration IR
- execution regions
- replay checkpoints
- static or adaptive promotion windows
- legality boundaries for runtime adaptation

The runtime provides:

- telemetry-driven coordination
- residency enforcement
- DMA scheduling
- decode routing decisions
- rollback and replay handling
- topology-aware adjustments

## Why this model matters

This execution model makes two arguments:

- memory movement should be coordinated as part of execution, not discovered only through miss-driven feedback
- deterministic serving depends on bounded dynamism rather than unconstrained adaptation
