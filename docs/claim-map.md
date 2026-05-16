# Claim-Support Map

This document maps repository features to patent concepts that the simulator helps explain. It does not make legal conclusions, and it should not be read as a claim chart or infringement analysis.

## Purpose

The repo supports explanation of how a transformer-aware controller could:

- compute sink scores
- classify tokens for promotion
- move selected KV state into a fast tier
- route decode-time reads based on tier residency
- reduce SRAM footprint through per-head and per-layer selectivity

## Feature-to-concept mapping

### Sink score computation

Repo support:

- synthetic per-token attention aggregation
- head-specific contribution weighting
- EMA-style score updates

Patent concept supported:

- attention-derived identification of high-reuse or sink-like tokens

### Threshold classification

Repo support:

- promotion threshold
- eviction threshold
- dwell-step retention behavior

Patent concept supported:

- controller-driven classification of tokens as candidates for fast-tier residency

### DMA promotion

Repo support:

- promotion state transitions
- explicit promoted entry export
- active resident tracking under SRAM budget limits

Patent concept supported:

- movement of KV state from a bulk memory tier into a fast memory tier

### SRAM tag / tier mapping

Repo support:

- explicit token tier state
- policy summary and token table outputs
- promoted versus non-promoted routing logic

Patent concept supported:

- mapping of requested KV state to a fast-tier residency decision

### Decode read routing

Repo support:

- estimated HBM reads avoided
- active-mode latency estimate
- whole-token versus slice-mode comparison

Patent concept supported:

- servicing decode-time requests differently based on fast-tier placement

### Dynamic EMA promotion / eviction

Repo support:

- EMA alpha control
- promotion threshold
- eviction threshold
- dwell-step policy

Patent concept supported:

- runtime update of promotion status based on continuing access behavior

### Per-head / per-layer granularity

Repo support:

- whole-token mode
- per-head mode
- per-head + layer-range mode
- head eligibility toggles
- layer boost multiplier
- heatmap of head/layer slice intensity

Patent concept supported:

- selective placement of only part of a token's KV footprint in SRAM

### Multi-tenant shared-prefix reuse

Repo support:

- concurrent tenant control
- shared prefix length
- repeated prefix amplification in sink scoring

Patent concept supported:

- stronger value proposition for promoting shared prompt or reusable prefix state

## How to use this document

This file is useful for:

- inventor review
- patent counsel onboarding
- aligning the repository with a specification draft
- explaining which repo behaviors correspond to which invention themes

It should not be used to assert that the simulator proves patentability, claim scope, or legal enforceability.
