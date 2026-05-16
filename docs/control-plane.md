# Control Plane

This document explains the control-plane layer illustrated by the simulator.

## Purpose

The control plane coordinates multiple subsystems that would otherwise make isolated decisions:

- promotion
- DMA scheduling
- residency guarantees
- decode routing
- eviction
- speculative rollback
- tenant sharing

The simulator demonstrates why these decisions are easier to reason about when treated as a centralized orchestration problem.

## What the orchestrator models

The orchestrator panel tracks:

- active sessions
- total SRAM used
- DMA utilization
- pending promotions
- decode queue depth
- rollback pressure
- residency pressure
- promotion churn
- execution stability

## Why this matters

Without orchestration, the memory system would look like a collection of local heuristics. The repo instead illustrates a control plane that can:

- coordinate different policy objectives
- react to pressure events
- enforce deterministic windows
- manage scarce fast-tier capacity across multiple tenants

This supports explanation of a runtime architecture rather than only a cache data structure.
