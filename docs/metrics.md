# Metrics

The simulator exposes several systems-style metrics to help explain KV orchestration behavior.

## Primary metrics

- `Execution stability`
  Approximate stability of the current execution window after considering churn, rollback pressure, and fragmentation.

- `Residency half-life`
  Approximate number of decode steps that promoted entries remain valuable before demotion pressure rises.

- `Effective SRAM amplification`
  Logical KV coverage divided by promoted SRAM bytes, illustrating how selective promotion extends fast-tier reach.

- `Promotion entropy`
  Entropy of promoted slice scores, used as a concentration proxy for promotion decisions.

- `Routing determinism`
  How consistently decode requests stay within expected routing windows.

- `DMA efficiency`
  Approximate HBM reads avoided per DMA byte moved.

- `Speculative waste factor`
  Wasted speculative DMA movement as a share of total speculative bytes touched.

- `Residency volatility`
  Instability driven by fragmentation, churn, and evictions.

- `Decode stall probability`
  Approximate probability of decode slowdown due to misses, queueing, or rollback pressure.

- `Multi-tenant reuse efficiency`
  Degree to which shared-prefix reuse reduces duplicate promotions.

- `Compaction overhead`
  Relocation and compaction cost proxy.

## Interpretation

These metrics are modeled quantities. They are most useful for comparing policies and workloads within the simulator rather than claiming hardware-accurate performance.
