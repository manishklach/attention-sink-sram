# Reproducibility

The simulator includes a deterministic replay mode intended to support repeatable architecture exploration.

## Reproducibility primitives

- seeded pseudo-random generation
- deterministic session generation
- deterministic event ordering
- stable object hashing
- snapshot checksums

## Verification flow

The `Verify Deterministic Replay` control runs the same configuration twice and compares snapshot hashes. Matching hashes indicate that the current configuration replayed consistently inside the simulator.

## Trace replay

Imported traces are validated and normalized into an internal event representation. The replay path illustrates how external token or attention traces can drive the timeline surface without requiring a production runtime.

## What determinism means here

Determinism in this repository means that the same simulator configuration should produce the same modeled orchestration result. It does not imply equivalence to real deployment behavior, scheduler jitter, or production hardware execution.
