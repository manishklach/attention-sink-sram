# Attention-Sink SRAM

This repo is a dependency-free, browser-native systems simulator for `attention-sink-aware placement of transformer KV state into a high-speed memory tier`.

It now goes beyond static placement and models a runtime orchestration story:

- multi-tenant execution flow
- DMA scheduling and promotion descriptors
- decode-time routing between `SRAM`, `HBM`, and mixed mode
- shared-prefix attach/detach and refcounted residency
- speculative decode rollback and reclaimed SRAM
- eviction-policy comparison and residency churn

Open [index.html](./index.html) directly in a browser. No build step or package manager is required.

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`
- Filed in: `India`, through the Indian Patent Office patent e-filing system

## Runtime orchestration simulator

The simulator illustrates a runtime that can:

1. observe sink-heavy prompt and prefix behavior during prefill
2. classify hot KV state using sink thresholds and EMA-style persistence
3. issue DMA promotions into an SRAM tier
4. keep shared-prefix entries resident across multiple sessions
5. route decode-time lookups to `SRAM`, `HBM`, or mixed mode
6. compare eviction policies under multi-tenant pressure
7. handle speculative draft acceptance, rejection, and reclamation

## Feature highlights

### Placement and slice selectivity

- `Whole token KV`
- `Per-head KV slices`
- `Per-head + layer-range KV slices`
- interactive head eligibility toggles
- head/layer heatmap

### Decode routing

- routing table per decode step
- SRAM hit, miss, and mixed-mode visualization
- estimated latency under active residency state

### DMA scheduling

- deterministic DMA queue
- transfer descriptors with session, token range, head range, layer range, bytes, and timing
- active, queued, and completed transfer views
- bandwidth utilization meter

### Shared-prefix reuse

- multiple sessions attach to one promoted prefix
- shared entries are promoted once and refcounted
- attach/detach actions update residency behavior
- avoided duplicate promotions and saved SRAM bytes are surfaced

### Multi-tenant SRAM residency

- residency directory with:
  - session id
  - token range
  - head range
  - layer range
  - sink score
  - age
  - refcount
  - tier
  - shared / pinned / evicting / stale flags

### Eviction policy comparison

- `LRU`
- `sink-score-aware`
- `EMA-based`
- `refcount-protected`
- `pinned shared-prefix`

### Speculative decode handling

- draft tokens, accepted tokens, rejected tokens
- rollback frequency
- wasted DMA bytes
- reclaimed SRAM
- stable sink retention

## Why per-head promotion still matters

Whole-token promotion is simple but expensive. The more realistic SRAM efficiency story is selective.

With the default model geometry:

- whole-token bytes per token = `2 * 80 * 8 * 128 * 2 = 327,680 B`
- per-head bytes per token with `3/8` promoted heads = `2 * 80 * 3 * 128 * 2 = 122,880 B`
- footprint reduction = `62.5%`
- effective sink capacity increase = about `2.67x`

Layer-range selection compresses this further by promoting only selected heads within a chosen layer interval.

## Timeline explanation

The execution timeline panel illustrates:

- `Prefill`
- `Sink detection`
- `DMA promotion`
- `SRAM residency`
- `Decode routing`
- `Eviction`
- `Re-promotion`
- `Shared-prefix attach/detach`

Playback controls:

- `Play`
- `Pause`
- `Step`
- speed multiplier

Each event includes:

- timestamp
- session id
- token range
- heads affected
- layer range
- bytes moved
- source tier
- destination tier
- estimated latency

## Export examples

Use `Generate Research Snapshot` to export:

- `research-snapshot.json`
- `timeline-trace.json`
- `dma-trace.json`
- `residency-snapshot.json`
- `benchmark-comparison.csv`
- `architecture-view.svg`

## Architecture screenshots section

Suggested captures:

- execution timeline with an active decode-routing event
- DMA panel with active and queued descriptors
- runtime architecture diagram with highlighted block
- shared-prefix reuse panel showing refcounted residency

## Benchmark screenshots section

Suggested captures:

- runtime benchmark comparison table
- eviction policy comparison table
- residency directory filtered to shared or evicting entries
- speculative decode panel with rollback rows

## Documentation

Existing docs:

- [Architecture](./docs/architecture.md)
- [Benchmark methodology](./docs/benchmark-methodology.md)
- [Claim-support map](./docs/claim-map.md)

Runtime orchestration docs:

- [Runtime orchestration](./docs/runtime-orchestration.md)
- [DMA engine](./docs/dma-engine.md)
- [Shared prefix reuse](./docs/shared-prefix-reuse.md)
- [Speculative decode](./docs/speculative-decode.md)

## Repo structure

- `index.html` - simulator shell and panels
- `styles.css` - styling and layout
- `runtime-core.js` - state, model geometry, sessions, head profiles, byte formulas
- `residency.js` - SRAM directory and shared-prefix metrics
- `dma.js` - transfer descriptors and queue scheduling
- `routing.js` - decode routing decisions
- `eviction.js` - eviction-policy scoring and comparison
- `speculative.js` - speculative decode traces
- `timeline.js` - timeline event generation and playback
- `benchmark.js` - runtime comparison tables
- `export.js` - research snapshot exports
- `app.js` - UI binding and rendering orchestration

## Disclaimer

This repository is a `deterministic educational simulator`, not a production inference runtime, hardware simulator, or full transformer benchmark.

It is intended to illustrate and support explanation of:

- runtime promotion orchestration
- SRAM vs HBM routing
- DMA-driven residency changes
- per-head and per-layer selective placement
- multi-tenant shared-prefix reuse
- speculative rollback behavior

It does `not` claim cycle-accurate hardware timing, exact model-quality impact, or legal conclusions about patentability or infringement.

## Maintainer

- `Manish KL`
