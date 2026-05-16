# Virtualized KV

The simulator now includes a virtualized KV mapping layer.

## Modeled concepts

- logical KV pages
- virtual addresses
- physical placement
- remapping
- migration eligibility

## Compared layouts

- contiguous KV
- PagedAttention-style paging
- vAttention-style virtual remapping
- sink-aware deterministic residency
- hybrid orchestration models

The goal is to illustrate how deterministic residency differs from pure paging or remapping schemes.
