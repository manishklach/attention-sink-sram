# Speculative Decode

This document explains the speculative decode portion of the simulator.

## What is modeled

The simulator illustrates a simplified speculative workflow:

- draft tokens are proposed
- some are accepted
- some are rejected
- rejected draft-associated residency can be reclaimed
- stable sink-related residency can persist across speculative noise

## Why it matters

A runtime may temporarily promote speculative state that later proves unnecessary. That means the orchestration problem is not just:

- what should be promoted

but also:

- what should be reclaimed quickly
- what should be retained despite speculative churn
- how much DMA traffic is wasted when drafts are rolled back

## Metrics shown

The speculative panel illustrates:

- rollback frequency
- wasted DMA bytes
- reclaimed SRAM bytes
- stable sink retention

## Relationship to the main invention story

This simulator uses speculative decode to support explanation of a broader runtime-management point:

- stable sink KV has long-lived value
- speculative KV may have short-lived and uncertain value
- a runtime can treat these categories differently without changing the semantic content of the underlying KV values

## Caution

The speculative model here is intentionally simplified. It illustrates orchestration tradeoffs rather than a full verifier/draft implementation or production-quality latency model.
