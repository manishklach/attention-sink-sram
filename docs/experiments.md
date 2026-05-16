# Experiments

This repository models a lightweight experiment framework for SRAM-aware KV orchestration research.

## What an experiment contains

Each experiment definition includes:

- a name
- a workload preset
- a runtime policy
- a memory-partition policy
- an eviction policy
- a promotion granularity
- a seed
- a duration
- optional parameter overrides

The simulator uses these fields to generate a deterministic snapshot of:

- sessions
- residency directory state
- DMA activity
- decode routing
- speculative behavior
- benchmark comparisons
- orchestration metrics

## Batched execution

Experiments may be queued and executed in sequence. The goal is to illustrate how a control plane could be evaluated under repeated configurations rather than only through one-off interactive tuning.

## Parameter sweeps

Sweep support models:

- one-dimensional parameter scans
- logarithmic or linear stepping
- optional two-dimensional sweep matrices

This is useful for illustrating sensitivity to SRAM budget, bandwidth, thresholds, speculative acceptance, promoted heads, and concurrency.

## Stored results

Completed experiments are persisted in browser-local storage so previous runs can be revisited, compared, and exported.

## Limitations

This experiment framework models relative trends and orchestration behavior. It does not attempt to reproduce cycle-accurate hardware timing or framework-level inference traces.
