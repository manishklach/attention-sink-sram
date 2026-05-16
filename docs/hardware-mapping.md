# Hardware Mapping

This document explains how the simulator-level memory concepts could map to hardware mechanisms in a future implementation.

The key phrase is `could map to`. This repository models the concepts, but it does not implement or verify real hardware behavior.

## Tier mapping

The simulator uses explicit SRAM and HBM tiers.

At a conceptual level, these could map to:

- on-device SRAM or scratchpad-like regions
- HBM-backed bulk KV storage
- additional remote or pooled tiers already modeled elsewhere in the repository

## Region tags and permissions

The simulator-level region types could map to:

- hardware or firmware tags describing region type
- page-table metadata
- MMU or IOMMU permission bits
- DMA engine allow/deny rules

For example, a `REASONING_LOG_PROTECTED` region could map to a policy in which:

- only a restricted execution context can write to it
- tool payload DMA cannot target it
- replay protection prevents nondeterministic reuse or overwrite

## Auditability

Deterministic allocation and ring-buffer eviction make the system easier to audit because:

- allocation offsets can be replayed
- eviction order is stable
- protected regions have clear placement reasons
- forbidden mappings can be logged deterministically

## Limits of the mapping

The repository stops at conceptual modeling.

It does not claim:

- a deployable CUDA allocator
- a concrete SRAM controller implementation
- proven security isolation
- production-quality driver or runtime enforcement
