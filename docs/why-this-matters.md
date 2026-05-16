# Why This Matters

Transformer inference is increasingly limited by memory behavior:

- fast-memory scarcity
- repeated KV reads during decode
- bandwidth contention
- DMA overlap limits
- distributed placement overhead
- multi-tenant serving pressure

In that environment, the main runtime question shifts from:

`where did the data happen to stay?`

to:

`what state must remain stable, where, and under what execution guarantees?`

## Why bandwidth becomes central

Once decode becomes long-lived and context windows grow, the performance bottleneck often shifts from arithmetic to movement. Memory orchestration becomes a systems problem involving tiers, routing, scheduling, and topology.

## Why determinism changes runtime design

Replay, graph capture, and stable serving windows all benefit from bounded movement and bounded adaptation. A runtime that cares about determinism must reason about memory movement differently from a best-effort cache.

## Why orchestration becomes infrastructure

The broader argument in this repository is that future inference systems may treat memory orchestration as shared infrastructure:

- part scheduler
- part residency manager
- part routing controller
- part replay coordinator
- part DMA planner

That is why the project is framed as a systems architecture thesis rather than only a simulator.
