# Policy Comparison

The simulator supports side-by-side comparison of runtime policies that change how the control plane behaves.

## Example policies

- latency optimized
- bandwidth optimized
- SRAM conservative
- aggressive promotion
- speculative-heavy
- tenant-fairness optimized
- sink-stability optimized
- deterministic-residency optimized

## What changes between policies

Policies may alter:

- promotion threshold bias
- DMA concurrency
- residency guarantee weighting
- speculative aggressiveness
- fairness weighting

## What comparison is meant to show

The comparison engine illustrates how policy choices can shift:

- execution stability
- deterministic decode hit rate
- DMA traffic
- routing mix
- fragmentation pressure
- reuse efficiency
- speculative waste

This is useful for architectural explanation and early-stage exploration of control-plane tradeoffs.
