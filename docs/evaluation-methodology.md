# Evaluation Methodology

This repository models a deterministic evaluation workflow for SRAM-aware transformer KV orchestration.

## Methodology goals

The simulator is designed to illustrate:

- how a central orchestrator may allocate SRAM
- how DMA and routing decisions shift across workloads
- how shared-prefix reuse changes fast-tier economics
- how policy settings affect churn, volatility, and stability

## Benchmark style

The benchmark surfaces compare relative orchestration strategies such as:

- HBM only
- static whole-token SRAM
- dynamic whole-token SRAM
- dynamic per-head SRAM
- dynamic per-head plus layer-range SRAM

The benchmark is not a measured throughput benchmark. It approximates relative latency and bandwidth behavior from modeled routing and residency effects.

## Trace assumptions

Imported traces are treated as deterministic event streams. Synthetic workloads are generated from configurable workload presets and seeded behavior.

## Simulator limitations

- not cycle accurate
- not framework accurate
- not bound to a real model architecture
- not a substitute for hardware measurement

The value of this platform is in structured comparison and architectural explanation.
