# Core Algorithms

This repository is not only an architecture simulator. It also includes executable implementations of the two algorithmic primitives that motivate the memory-orchestration story:

1. cumulative sink score computation
2. numerically stable split-path decode merge

## Cumulative sink score

For each token `t`, the simulator computes:

`S(t) = Σ_l Σ_h Σ_i A(l,h,i,t)`

where `A(l,h,i,t)` is the attention mass assigned from query position `i` to key/token `t` at layer `l` and head `h`.

This models the idea that sink tokens are not merely locally hot, but persistently targeted across many queries, heads, and layers.

## Promotion thresholding

The simulator uses the computed sink scores to classify sink tokens relative to a threshold. Those classifications are then used to build a sink partition and a bulk partition for the proof-of-concept decode merge.

This is intended to demonstrate the control logic behind attention-sink-aware promotion, not to claim an exact production serving policy.

## Split-path merge

When attention is evaluated over two disjoint partitions, such as:

- sink partition
- bulk partition

the partial outputs cannot simply be averaged. They must be merged using log-sum-exp semantics so the result matches full attention numerically.

The simulator therefore implements a split-path merge using partition outputs and partition log-sum-exp values, then verifies the result against full attention in simulation.

## Scope

These implementations are intended to:

- model the core algorithmic ideas behind the simulator
- demonstrate numerical correctness in a browser-native proof of concept
- support explanation of the broader residency-orchestration thesis

They are not presented as production kernels or hardware implementations.
