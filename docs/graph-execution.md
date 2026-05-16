# Graph Execution

The graph execution model explores CUDA-graph-like replay ideas for decode windows.

## Modeled behaviors

- captured decode regions
- replayable execution graphs
- graph reuse
- graph invalidation
- dynamic fallback

The graph layer is meant to show how orchestration windows and residency guarantees can interact with replayable kernel launch regions.
