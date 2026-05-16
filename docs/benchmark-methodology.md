# Benchmark Methodology

This repository includes a deterministic comparative benchmark table. The table is intended to support architecture discussion, not to stand in for a full transformer benchmark.

## What the benchmark is

The benchmark comparison panel estimates the effect of different memory-placement policies on:

- promoted token count
- promoted head count
- promoted layer count
- SRAM bytes used
- SRAM budget utilization
- estimated HBM reads avoided
- estimated latency cost
- relative speedup

The comparison rows are:

- `HBM only`
- `Static whole-token SRAM`
- `Dynamic whole-token SRAM`
- `Dynamic per-head SRAM`
- `Dynamic per-head + layer-range SRAM`

## Deterministic assumptions

The simulator is deterministic in the sense that:

- head profiles follow fixed synthetic categories
- token reuse is derived from repeatable scoring logic
- tenant and shared-prefix effects are modeled using fixed formulas
- the latency estimate is computed from current control values rather than measured hardware execution

This makes the artifact stable enough for design explanation and patent-support walkthroughs.

## Latency model

The repo exposes:

- `HBM latency`
- `SRAM latency`

The benchmark uses those values to estimate a relative access cost under each policy. The active comparison row is then normalized against the HBM-only row to produce a `relative speedup` estimate.

This is an architecture-level proxy, not cycle-accurate timing.

## HBM read avoidance estimate

The simulator estimates avoided HBM reads based on:

- which tokens are currently promoted
- which heads are eligible and selected
- whether the policy is whole-token, per-head, or per-head-plus-layer-range
- the layer-range coverage ratio
- shared-prefix amplification across concurrent tenants

This means the same promoted token can have different value depending on the selected head subset and layer range.

## SRAM footprint calculation

The main SRAM byte formulas are:

### Whole token KV

`2 * layers * kvHeads * headDim * bytesPerElement`

### Per-head KV slices

`2 * layers * promotedHeads * headDim * bytesPerElement`

### Per-head + layer-range KV slices

`2 * selectedLayerCount * promotedHeads * headDim * bytesPerElement`

These formulas are recomputed dynamically as the user changes model geometry and policy controls.

## Why this is not a full model benchmark

The repo does not:

- run a real model
- execute an attention kernel
- measure wall-clock throughput
- simulate exact numerical precision or output quality
- replace a hardware simulator

It is better understood as a `policy-level inference architecture simulator` focused on memory-tier placement and decode-time routing.
