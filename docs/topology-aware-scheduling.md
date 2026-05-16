# Topology-Aware Scheduling

The scheduler layer illustrates how a future inference runtime may make placement and migration decisions with cluster topology in mind.

## Scheduler goals

- minimize remote fetches
- maximize local residency
- reduce congestion
- preserve deterministic windows
- co-locate shared prefixes

## Visible outputs

The scheduler panel exposes:

- local device assignment
- target device selection
- placement rationale
- congestion mitigation behavior

## Scope

The current scheduler is a deterministic explanatory model. It does not attempt to solve a full multi-objective optimization problem.
