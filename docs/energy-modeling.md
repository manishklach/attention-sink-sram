# Energy Modeling

The simulator includes a lightweight cluster-energy model to support discussion of memory-tier tradeoffs.

## Modeled categories

- SRAM access energy
- HBM energy
- remote fetch energy
- DMA energy
- compression energy
- migration energy

## Useful derived metrics

- energy per decode token
- energy per tenant
- energy hotspots

These quantities are intended to illustrate directional behavior and possible tradeoffs between local hits, remote traffic, and migration waves.
