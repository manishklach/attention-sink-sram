# Isolation Boundaries

This repository now models isolation boundaries as a simulator-level concept.

It is important to read that carefully: the project does **not** claim real hardware enforcement. Instead, it illustrates how protected and untrusted memory regions could be described, checked, and audited within a future orchestration runtime.

## Region types

The simulator distinguishes among:

- `KV_PERF`
- `REASONING_LOG_PROTECTED`
- `TOOL_PAYLOAD_UNTRUSTED`
- `SHARED_PREFIX`
- `SPECULATIVE_TEMP`
- `EXPORT_TRACE`

Each region carries flags such as:

- `readOnly`
- `noToolAccess`
- `replayProtected`
- `dmaAllowed`
- `exportAllowed`
- `scrubOnRelease`
- `integrityTracked`

## What the model demonstrates

The isolation model demonstrates that:

- untrusted tool payloads can be modeled separately from reasoning-log memory
- protected reasoning logs can require deterministic placement
- export eligibility can be modeled explicitly instead of assumed
- DMA permissions can be expressed as region policy rather than only performance behavior

## What the model does not claim

The simulator does not claim:

- real hardware isolation
- production-grade memory protection
- formal verification
- actual MMU, IOMMU, or accelerator enforcement

It is a structured architecture model intended to support explanation of how such boundaries could map into a future system.
