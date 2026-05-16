# Distributed Topology

This simulator models a future inference cluster where KV state may be distributed across several device classes rather than residing within one accelerator.

## Topology shapes

The topology layer currently illustrates:

- 1D chains
- meshes
- fat-tree style hierarchies
- star topologies

## Device classes

The modeled device catalog includes:

- GPU
- accelerator
- CPU-attached SRAM
- pooled memory node
- SmartNIC/DPU
- storage offload node

Each device has approximate:

- SRAM capacity
- HBM capacity
- DMA engines
- bandwidth
- latency
- compute capacity

## What it is meant to show

The topology view is intended to illustrate how memory placement and decode routing change when the hardware graph matters. It is not intended to claim exact equivalence to any production cluster or interconnect.
