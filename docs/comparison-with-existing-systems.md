# Comparison With Existing Systems

The simulator includes a research comparison surface for several conceptual execution styles:

- FlashAttention-style IO-aware execution
- PagedAttention-style paging
- vAttention-style virtual remapping
- deterministic residency orchestration
- hybrid orchestration

## Intended use

This comparison view is meant to illustrate tradeoff dimensions such as:

- routing determinism
- fragmentation
- replay stability
- DMA traffic
- residency efficiency
- orchestration overhead

It is not a direct benchmark against those systems and should not be interpreted as a measured performance claim.
