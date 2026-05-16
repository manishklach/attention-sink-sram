# Workloads

The simulator includes both workload presets and research scenario suites.

## Presets

Available presets include:

- chatbot assistant
- long-context reasoning
- RAG-heavy retrieval
- code generation
- multi-agent orchestration
- speculative decode stress
- multi-tenant enterprise serving

Each preset defines a deterministic mix of:

- prompt length
- decode steps
- tenant count
- shared-prefix length
- sink strength
- speculative acceptance rate

## Research suites

The workload suite catalog groups scenarios that emphasize specific orchestration behaviors:

- long-context serving
- enterprise multi-tenant
- RAG-heavy inference
- agentic orchestration
- high speculative decode
- SRAM constrained edge inference
- extreme tenant burst
- prefix-sharing hyperscale serving

These suites are intended to support discussion of policy choice and stress behavior, not to claim production trace fidelity.
