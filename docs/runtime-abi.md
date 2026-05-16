# Runtime ABI

This simulator models a lightweight runtime ABI for KV orchestration.

## ABI concepts

- KV object handles
- residency descriptors
- scheduling flags
- replay flags
- barriers and checkpoints

## Why it exists in the simulator

The ABI layer illustrates how an orchestration runtime might expose memory-tier state and replay-safe object transitions to kernels, schedulers, and graph-captured execution windows.

## Scope

This is an architectural exploration of runtime-facing structures. It is not a proposal for a finalized production ABI.
