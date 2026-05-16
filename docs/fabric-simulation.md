# Fabric Simulation

The fabric layer models inter-device transfers and remote fetch behavior.

## Fabric modes

The simulator includes simplified profiles for:

- PCIe-like fabrics
- NVLink-like fabrics
- CXL-like fabrics
- Ethernet/RDMA-like fabrics

## Modeled properties

- bandwidth
- link latency
- utilization
- congestion
- saturation
- multicast efficiency

## What the fabric view illustrates

The fabric surfaces are meant to show how remote KV movement may become a first-order systems constraint once decode routing spans multiple devices.
