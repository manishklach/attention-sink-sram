# Log-Sum-Exp Merge

## Why a split merge is needed

If attention is split into two partitions, such as:

- sink tokens handled on one fast path
- bulk tokens handled on another path

then each partition produces its own output vector and its own log-sum-exp normalization term.

Those partial results cannot be naively averaged. The global attention semantics must be reconstructed from the partition normalizers.

## Implemented merge

For two partitions with:

- `O_sink`, `lse_sink`
- `O_bulk`, `lse_bulk`

the simulator computes:

- `m = max(lse_sink, lse_bulk)`
- `denom = exp(lse_sink - m) + exp(lse_bulk - m)`
- `O = (exp(lse_sink - m) * O_sink + exp(lse_bulk - m) * O_bulk) / denom`
- `lse = m + log(denom)`

This is the numerically stable log-sum-exp merge used by the proof-of-concept panel.

## Verification approach

The simulator also computes a naive full-attention reference over the union of both partitions. It then compares:

- merged output vs reference output
- merged LSE vs reference LSE
- max absolute error
- mean absolute error

This lets the browser demo verify numerically in simulation that the split-path merge preserves full-attention semantics within floating-point tolerance.

## Scope

The implementation demonstrates the merge logic in plain JavaScript. It is not meant to represent a production kernel or hardware datapath.
