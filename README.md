# Attention-Sink SRAM Demo

This repo is a small, dependency-free simulator and visual explainer for the patent concept around `attention-sink-aware placement of transformer KV state into a high-speed memory tier`.

It is designed to answer one question clearly:

`What happens if we detect sink tokens, promote their KV state into SRAM, and service decode-time reads from that fast tier instead of always reading from HBM/DRAM?`

## Overview

This project is a systems-architecture demo for the patented idea that a transformer inference runtime can:

- detect high-reuse `attention-sink` tokens,
- promote their KV state into a high-speed memory tier such as `SRAM`,
- route decode-time reads through a fast-path bypass, and
- improve token-latency economics without requiring the entire KV cache to fit in SRAM.

The simulator is intentionally lightweight and browser-native. It is designed to help explain the invention to:

- patent counsel
- systems architects
- accelerator teams
- investors and technical reviewers
- collaborators exploring heterogeneous inference

## Patent reference

- Indian patent application number: `202641062302`
- Title: `Methods and Systems for Attention-Sink-Aware SRAM Placement of Key-Value State in Transformer Inference`

## What this demo shows

- A toy prompt with prefix tokens and later content tokens
- Synthetic multi-head attention behavior with sink-heavy, local, and retrieval-biased heads
- Dynamic sink-score computation using an EMA-based controller
- Promotion and eviction of selected token KV entries into and out of an SRAM tier
- Multi-tenant shared-prefix behavior showing why repeated system prompts are natural SRAM candidates
- Decode-time routing of reads between `SRAM` and `HBM`
- Benchmark comparison between HBM-only, static one-shot placement, and dynamic controller policies
- Exportable JSON traces for figure generation, patent exhibits, or later analysis
- Estimated reduction in HBM reads and latency cost

## Repo contents

- `index.html` - the interactive demo UI
- `styles.css` - styling for the explainer and charts
- `app.js` - simulation logic and rendering

## Maintainer

- `Manish KL`

## How to use

Open [index.html](./index.html) directly in a browser.

No build step or package manager is required.

## Demo model

This is not a full transformer implementation. It is a deterministic systems simulator that focuses on:

1. identifying sink tokens from attention reuse,
2. modeling multiple attention-head profiles,
3. migrating their KV state into a fast memory tier,
4. dynamically evicting cooled entries when SRAM is full, and
5. routing future reads through an SRAM bypass path, and
6. showing how shared prefixes across concurrent tenants amplify the value of fast-tier placement.

That makes it useful for:

- patent explanation
- architecture discussions
- investor or attorney walkthroughs
- early product thinking

## Main controls

- `Prompt length`
- `Decode steps`
- `Head count`
- `Concurrent tenants`
- `Shared prefix length`
- `Promotion threshold`
- `Eviction threshold`
- `EMA alpha`
- `Dwell steps`
- `SRAM budget`
- `Sink strength`
- `HBM latency` and `SRAM latency`

## Suggested next extensions

- add speculative decoding overlays
- add per-head slice promotion instead of whole-token promotion
- add trace replay for side-by-side controller comparisons
- add a patent-figure export mode
