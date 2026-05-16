# Ring-Buffer Tiering

The repository now models SRAM residency with a circular ring-buffer abstraction.

## Why use a ring-buffer model

A ring-buffer model makes it easier to illustrate:

- head-pointer movement
- wraparound
- pinned entries
- protected entries
- shared-prefix persistence
- deterministic eviction barriers

This is especially useful for showing how performance-oriented KV regions and protected reasoning regions can coexist without pretending the simulator is a general-purpose allocator.

## What is modeled

The simulator tracks:

- head and tail movement
- wrap count
- reclaimable bytes
- protected-region pressure
- pinned bytes
- fragmentation-like gaps
- failed placements and spillover to HBM

## Why this matters for the thesis

Ring-buffer-style tiering illustrates that:

- residency can be managed as an explicit control problem
- deterministic eviction improves replay and auditability
- protected regions can create barriers that influence performance placement
- SRAM/HBM tiering is not only about speed, but also about legality and stability
