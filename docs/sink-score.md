# Sink Score

## Definition

The simulator computes cumulative sink score for token `t` as:

`S(t) = Σ_l Σ_h Σ_i A(l,h,i,t)`

This score captures how persistently a token attracts attention across:

- layers
- heads
- query positions

## Why this helps identify sink tokens

Tokens that repeatedly receive attention across many queries are stronger candidates for special residency treatment than tokens that are only briefly local. In that sense, sink score models persistent importance rather than transient locality.

## Implemented variants

The simulator includes:

- raw cumulative score
- per-layer normalized score
- per-head normalized score
- EMA-smoothed score

These variants are useful for comparing how strongly sink ranking depends on absolute mass versus normalized persistence.

## Threshold classification

After scores are computed, the simulator classifies tokens relative to a threshold. That thresholding step is then used to form a candidate sink partition for SRAM promotion in the proof-of-concept flow.

## Limitations

This score is computed over synthetic attention tensors, not model-derived production traces. It is therefore best understood as a controlled simulation of the sink-identification idea.
