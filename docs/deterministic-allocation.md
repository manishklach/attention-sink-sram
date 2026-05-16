# Deterministic Allocation

This repository models deterministic allocation as an architectural property rather than an implementation detail.

## Why deterministic allocation matters

If residency, replay, and protected-region behavior are part of the execution model, then allocation order cannot be treated as arbitrary runtime noise.

Deterministic allocation improves:

- replay reproducibility
- auditability
- stable tie-breaking
- predictable eviction behavior
- clarity of residency decisions

## What the simulator implements

The allocator is modeled with:

- fixed ordering from stable object attributes
- deterministic tie-breaking
- deterministic eviction order
- replayable allocation traces
- reproducible offsets for repeated runs

It explicitly avoids wall-clock timing and random asynchronous effects.

## Modes

The simulator models several allocation modes:

- ring buffer
- fixed partitions
- priority partitions
- residency-contract protected
- shared-prefix protected

These are architecture modes, not claims about a finished allocator product.
