# Multi-Tier Memory

The repository now models a multi-tier memory system rather than a simple SRAM-versus-HBM split.

## Tiers illustrated

- `SRAM`
- `HBM`
- `compressed HBM`
- `host DRAM`
- `SSD/offload`

Each tier includes modeled latency, bandwidth, capacity, energy cost, and promotion eligibility.

## Why multi-tier matters

Once the simulator includes:

- fragmentation
- tenant bursts
- compression
- speculative rollback

it becomes natural to show fallback escalation rather than forcing every non-SRAM path into one generic HBM bucket.

## Educational role

The multi-tier panels support explanation of:

- routing decisions
- escalation paths
- compressed cold storage usage
- why bandwidth and capacity tradeoffs differ across tiers
