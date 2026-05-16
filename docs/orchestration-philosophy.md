# Orchestration Philosophy

This repository makes a philosophical distinction between memory orchestration and ordinary caching.

## Why orchestration is different from caching

Caching is usually reactive. The system observes demand and attempts to keep useful state nearby. Orchestration is stronger: it introduces explicit planning, legality, ordering, and contracts around how state is allowed to move.

In this project:

- promotion is scheduled
- residency can be guaranteed
- execution windows constrain movement
- replay boundaries constrain adaptation
- topology influences legality and cost

## Why runtime scheduling matters

A runtime that can see decode concurrency, multi-tenant sharing, topology cost, and replay requirements can treat memory movement as part of execution control. That gives it a broader job than a conventional page cache or eviction policy.

## Why deterministic residency matters

When decode regions are replayed, graph-captured, or latency-sensitive, unpredictable churn is harmful even if average locality is good. Deterministic residency lets the system trade some flexibility for stability.

## Static vs dynamic orchestration

The simulator deliberately models both:

- static planning from compiler structure
- dynamic adaptation from runtime signals

The intended balance is not full static placement and not unconstrained runtime behavior. The architectural stance is `bounded dynamism`: dynamic response inside explicit legal windows.

## Controlled adaptation

The project assumes that adaptation should happen:

- at known boundaries
- under explicit invariants
- with replay awareness
- with visibility into DMA and topology cost

This is the main difference between “memory management” and “memory orchestration” in the thesis.
