# Telemetry

This document explains the dashboard and rolling metrics surfaces in the simulator.

## Metrics modeled

- SRAM hit rate
- HBM hit rate
- DMA queue occupancy
- promotion churn
- residency half-life
- rollback rate
- deterministic decode percentage
- bandwidth saved
- latency saved
- tenant sharing efficiency

## Rolling history

The dashboard keeps a short deterministic history and computes moving averages. This allows the simulator to show:

- trend direction
- instability after stress events
- differences between policy selections

## Purpose

The telemetry layer helps the repository feel like a runtime-control-plane artifact rather than only a static memory-placement diagram. It supports explanation of how operators or architects might inspect orchestration health over time.
