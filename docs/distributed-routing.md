# Distributed Routing

Distributed routing models how decode fetches may resolve across a cluster.

## Possible lookup targets

- local SRAM
- remote SRAM
- remote HBM
- pooled memory
- storage offload

## Tracked properties

- hop count
- remote latency
- route congestion
- fallback frequency
- escalation frequency

## Interpretation

The routing model approximates orchestration pressure and cross-device traffic patterns. It should be treated as an architectural illustration rather than a hardware-accurate network simulator.
