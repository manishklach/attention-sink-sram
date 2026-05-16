# Runtime Policies

The simulator includes a policy engine that changes how the control plane behaves.

## Policies

- latency optimized
- bandwidth optimized
- SRAM conservative
- aggressive promotion
- speculative-heavy
- tenant-fairness optimized

## What policies influence

The repo models policy effects on:

- promotion thresholding
- DMA concurrency
- speculative aggressiveness
- fairness weight
- benchmark outcomes

## Why this is useful

The policy engine supports explanation of a key systems point:

there is no single best runtime behavior. Different deployment goals can rationally produce different control-plane choices, even over the same underlying hardware.
