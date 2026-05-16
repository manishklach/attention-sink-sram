# Glossary

## residency contract
A runtime-visible promise or policy describing where a KV object should reside and for how long.

## execution region
A bounded section of work with stable orchestration assumptions.

## promotion wave
A coordinated set of residency promotions, often implemented through scheduled DMA activity.

## orchestration epoch
A time-bounded period during which orchestration decisions are evaluated under a stable policy context.

## replay-safe window
A decode or execution interval in which state transitions are restricted so replay remains valid.

## deterministic residency
Residency behavior whose stability is intentionally preserved for a bounded execution window.

## topology-aware orchestration
Placement and movement decisions that explicitly account for device and fabric structure.

## residency volatility
The rate at which objects change residency tiers or placements.

## orchestration IR
A planning representation describing regions, barriers, promotion windows, or residency intent.

## replay barrier
A boundary after which execution may safely replay or adapt.

## DMA wavefront
A coordinated burst or sequence of DMA operations serving one orchestration decision.

## orchestration DAG
A directed graph describing dependencies among placement, promotion, routing, and execution actions.
