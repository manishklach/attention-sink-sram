# Architectural Invariants

The simulator uses invariants to keep orchestration behavior conceptually coherent.

## Replay consistency invariants

- A replay-safe window should not observe illegal residency divergence.
- Checkpointed execution should preserve routing and residency assumptions defined for that window.

## Residency safety invariants

- A protected KV object should not be evicted while its residency contract is active.
- Shared-prefix objects should not be reclaimed while their effective reference count remains positive.

## Deterministic scheduling invariants

- Adaptation should occur only at modeled barriers or legal orchestration boundaries.
- Promotion and migration should not invalidate an active deterministic decode window without surfacing a fallback event.

## Orchestration legality rules

- Promotion must respect available capacity, policy, and ordering constraints.
- Migration must preserve object identity and routing legality.
- Compression and spillover must remain visible to the routing layer.

## Migration correctness assumptions

- Virtual-to-physical mappings should remain interpretable after migration.
- Remote placement must update routing state before the next dependent fetch window.

## Speculative rollback rules

- Rejected speculative state may be reclaimed only after rollback boundaries are satisfied.
- Stable sink or shared-prefix state should survive speculative collapse unless a higher-priority event overrides it.
