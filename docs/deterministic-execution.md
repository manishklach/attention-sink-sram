# Deterministic Execution

This simulator models deterministic execution windows as bounded intervals during which selected KV state remains more predictably available.

## Window concept

An execution window is a period in which:

- selected entries are pinned or contractually resident
- decode routing is more stable
- eviction risk is temporarily reduced

The UI distinguishes between stable and unstable windows and surfaces risk explicitly.

## Why this is helpful

Deterministic windows support explanation of how a runtime might provide:

- more consistent latency
- fewer surprise fallback reads
- reduced oscillation in critical decode regions

even if the entire KV working set cannot remain in SRAM at once.

## Metrics surfaced

- execution stability percentage
- residency volatility
- deterministic decode hit rate

These values are simulated, not measured from hardware. They exist to illustrate the concept of residency guarantees and execution-window contracts.
