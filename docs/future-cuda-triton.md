# Future CUDA / Triton Directions

This document is intentionally forward-looking only. No CUDA or Triton kernels are implemented in this repository in the current pass.

Potential future work could include:

- custom CUDA allocator for deterministic KV residency
- Triton attention-head tile loader
- quantized K/V tile loading
- low-rank K/V projection during SRAM load
- hardware-tagged memory regions
- MMU/IOMMU-aware region permissions
- CUDA graph replay integration

These directions are included to clarify possible implementation paths, not to imply that the current browser simulator already performs them.
