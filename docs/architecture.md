# Architecture Flow

This document explains the repo as a systems-and-patent support artifact for `attention-sink-aware SRAM placement of transformer KV state`.

## Core flow

The simulator models a four-stage flow:

1. `Observe`
The runtime observes repeated attention into prompt tokens, shared prefixes, and other candidate sink positions.

2. `Classify`
Per-token sink scores are updated using deterministic synthetic attention plus an EMA-style controller. Per-head profile information and optional layer-range weighting influence how much a given token contributes to the fast-tier case.

3. `Migrate`
When a token crosses the promotion threshold and fits the current SRAM budget, its KV state is promoted into the fast tier. The simulator also tracks eviction when a token cools below threshold and exceeds the dwell window.

4. `Route`
During decode, tokens resident in the fast tier are modeled as being served through the SRAM path, while all others continue to use HBM.

## Memory hierarchy

The architecture is intentionally simple:

- `HBM / DRAM bulk tier`
Stores the full KV working set and acts as the default backing store.

- `SRAM fast tier`
Stores promoted hot entries or slices that are expected to have disproportionately high reuse during decode.

The key correctness point is that the simulator does not change KV values. It only changes `where` selected KV state is read from.

## Per-head and per-layer placement

The main upgrade in this pass is promotion granularity.

### Whole-token KV

The full token KV footprint is treated as promoted. This is the easiest mode to reason about, but it is also the least SRAM-efficient.

Formula:

`2 * layers * kvHeads * headDim * bytesPerElement`

### Per-head KV slices

Only selected heads are promoted for a token. This is useful when some heads are sink-heavy or retrieval-biased while others are local, recency-biased, or diffuse.

Formula:

`2 * layers * promotedHeads * headDim * bytesPerElement`

### Per-head + layer-range KV slices

Only selected heads within a chosen layer range are promoted. This supports the idea that not every layer contributes equally to the sink-value of a token.

Formula:

`2 * selectedLayerCount * promotedHeads * headDim * bytesPerElement`

## Head profiles

Each KV head is given a synthetic profile:

- `sink-heavy`
- `local`
- `retrieval-biased`
- `recency-biased`
- `diffuse`

By default:

- `sink-heavy` and `retrieval-biased` heads are eligible for SRAM promotion
- the others are not

The user can override eligibility interactively by clicking head cards or heatmap columns.

## Layer weighting

The selected layer range can receive a boost multiplier. This supports explanation of a policy where:

- slices inside the chosen range contribute more strongly to sink scoring
- slices outside the range either contribute normally or are excluded from the promoted footprint, depending on the chosen granularity mode

## Decode-time routing

The simulator treats decode requests as follows:

- if the token is promoted, the estimated access is served from SRAM
- otherwise, the estimated access is served from HBM

The model then aggregates:

- estimated HBM reads avoided
- latency cost under the current policy
- relative speedup versus HBM-only

## Correctness preservation

This repo is careful about the architectural claim it supports:

- KV content is not modified
- token semantics are not changed
- model output quality is not asserted

Instead, the simulator supports explanation of `memory-tier placement and routing` as the inventive systems-level behavior.
