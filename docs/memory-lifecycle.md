# Memory Lifecycle

The simulator models KV objects as moving through an explicit lifecycle.

## Lifecycle phases

1. `creation`  
   A KV object, page, or slice is materialized by prefill, decode, or imported trace activity.

2. `observation`  
   The runtime observes sink score, reuse, tenant sharing, and topology cost.

3. `classification`  
   The object is classified for promotion eligibility, replay sensitivity, and sharing or migration priority.

4. `promotion`  
   The object is moved into a higher-priority tier through scheduled DMA or other placement activity.

5. `residency`  
   The object becomes resident under a contract, best-effort placement, or replay-safe window guarantee.

6. `replay protection`  
   The object is protected against illegal movement or eviction while a deterministic region is active.

7. `sharing`  
   Multi-tenant or shared-prefix references raise refcount, pinning, or placement priority.

8. `migration`  
   The object may move across devices, fabrics, or tiers to preserve policy goals.

9. `compression`  
   Cold or spillable state may transition to a compressed representation.

10. `eviction`  
   The runtime removes residency when policy allows and pressure requires.

11. `reclamation`  
   The object becomes reclaimable once replay, rollback, and sharing constraints are satisfied.

## State-machine view

`creation -> observation -> classification -> promotion -> residency -> replay protection -> sharing/migration/compression -> eviction -> reclamation`

The simulator intentionally models these as named states rather than implicit cache side effects.

## Residency timeline

The lifecycle diagram in the UI corresponds to a timeline of legal residency transitions. A KV object may revisit migration, compression, or sharing states multiple times, but replay protection and deterministic execution windows restrict when those transitions are legal.
