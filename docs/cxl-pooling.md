# CXL Pooling

The repository includes a pooled-memory abstraction inspired by future shared-memory fabrics.

## Modeled behaviors

- shared spillover capacity
- pooled prefix sharing
- pooled occupancy
- pooled fragmentation
- remote access amplification

## Why this matters

Pooled memory can improve capacity efficiency, but it can also increase remote access cost and reduce deterministic decode behavior if used too aggressively. The simulator is meant to illustrate that tradeoff.
