# Attention-Sink SRAM

This repo is a dependency-free architecture simulator and visual explainer for `attention-sink-aware placement of transformer KV state into a high-speed memory tier`.

It is built around one practical question:

`What changes when SRAM promotion becomes selective at the head and layer level instead of promoting entire token KV state?`

## Overview

This project supports explanation of a transformer inference runtime that can:

- observe repeated attention into sink-heavy tokens and shared prefixes
- classify hot KV state using thresholded sink scores and EMA updates
- migrate selected entries into a fast memory tier such as `SRAM`
- route decode-time reads through a fast-path bypass instead of always reading from `HBM`
- compare whole-token promotion against `per-head` and `per-head + layer-range` slice promotion

The result is a stronger architecture artifact for:

- patent counsel and patent drafting support
- accelerator and systems architecture discussions
- technical investor walkthroughs
- heterogeneous inference design reviews

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## What the simulator now covers

- promotion granularity modes:
  - `Whole token KV`
  - `Per-head KV slices`
  - `Per-head + layer-range KV slices`
- deterministic SRAM byte calculations using:
  - `layers`
  - `kvHeads`
  - `headDim`
  - `bytesPerElement`
  - `promotedHeads`
  - `promotedLayerStart`
  - `promotedLayerEnd`
- synthetic per-head behavior with profiles:
  - `sink-heavy`
  - `local`
  - `retrieval-biased`
  - `recency-biased`
  - `diffuse`
- layer-range weighting through a boost multiplier
- dynamic EMA-based promotion and eviction
- comparative benchmark rows for:
  - `HBM only`
  - `Static whole-token SRAM`
  - `Dynamic whole-token SRAM`
  - `Dynamic per-head SRAM`
  - `Dynamic per-head + layer-range SRAM`
- an interactive head/layer heatmap with promotion toggles
- exportable JSON traces containing model, policy, head profile, promoted entry, and benchmark comparison data

## Why per-head promotion matters

Whole-token KV promotion is easy to explain, but it over-allocates SRAM because every head and every layer is promoted together.

Per-head promotion is closer to the real efficiency story:

- if `3` of `8` KV heads are promoted, only those hot slices consume SRAM
- that reduces per-token SRAM usage by roughly `62.5%`
- the same SRAM budget can hold about `2.67x` more promoted sink entries

With the default model geometry:

- whole-token bytes per token = `2 * 80 * 8 * 128 * 2 = 327,680 B`
- per-head bytes per token = `2 * 80 * 3 * 128 * 2 = 122,880 B`
- reduction = `62.5%`

Layer-range selection pushes this further by only promoting selected heads across a chosen subset of layers.

## Repo contents

- `index.html` - browser-native simulator UI
- `styles.css` - layout, panels, heatmap, and benchmark styling
- `app.js` - deterministic simulation logic and JSON export
- `docs/architecture.md` - architecture flow and memory-tier explanation
- `docs/benchmark-methodology.md` - assumptions and benchmark model
- `docs/claim-map.md` - feature-to-patent-concept mapping
- `LICENSE` - MIT license

## How to use

Open [index.html](./index.html) directly in a browser.

No build step, package manager, or external dependency is required.

## Main controls

- `Promotion granularity`
- `Prompt length`
- `Decode steps`
- `Concurrent tenants`
- `Shared prefix length`
- `Layers`
- `KV heads`
- `Head dimension`
- `Bytes per element`
- `Promoted heads`
- `Promoted layer start`
- `Promoted layer end`
- `Layer boost multiplier`
- `Promotion threshold`
- `Eviction threshold`
- `EMA alpha`
- `Dwell steps`
- `SRAM token budget`
- `Sink strength`
- `HBM latency`
- `SRAM latency`

## Docs

- [Architecture](./docs/architecture.md)
- [Benchmark methodology](./docs/benchmark-methodology.md)
- [Claim-support map](./docs/claim-map.md)

## Screenshot placeholder

Suggested captures for the repo home page:

- hero and control panel
- SRAM efficiency card showing whole-token vs per-head bytes
- head/layer heatmap with promoted slices highlighted
- comparative benchmark table with the active policy row highlighted

## Maintainer

- `Manish KL`

## Disclaimer

This repository is a `deterministic architecture simulator`, not a production transformer runtime or a full-model benchmark.

It is intended to support explanation of:

- sink-score-driven promotion
- SRAM vs HBM tiering
- per-head and per-layer placement tradeoffs
- decode-time routing and estimated read avoidance

It does `not` claim cycle-accurate hardware timing, exact model quality impact, or production inference throughput.
