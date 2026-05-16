(function () {
  const sim = window.AttentionSinkSim;

  function modeFactors(mode) {
    switch (mode) {
      case "contiguous-kv":
        return { fragmentation: 1.15, dma: 0.92, determinism: 0.9, complexity: 0.74, stability: 0.82 };
      case "pagedattention":
        return { fragmentation: 0.68, dma: 1.12, determinism: 0.76, complexity: 1.08, stability: 0.74 };
      case "vattention":
        return { fragmentation: 0.62, dma: 1.06, determinism: 0.8, complexity: 1.16, stability: 0.79 };
      case "sink-aware-residency":
        return { fragmentation: 0.88, dma: 0.94, determinism: 1.08, complexity: 0.96, stability: 0.96 };
      default:
        return { fragmentation: 0.72, dma: 0.98, determinism: 1.1, complexity: 1.02, stability: 1.04 };
    }
  }

  sim.paging = {
    build(model, directory, fragmentation, distributedRouting) {
      const pageBytes = sim.computeVirtualPageBytes(model);
      const totalVirtualPages = sim.state.virtualPageCount;
      const activeEntries = directory.entries.slice(0, totalVirtualPages);
      const factors = modeFactors(sim.state.kvLayoutMode);
      const pageTable = activeEntries.map((entry, index) => ({
        pageId: `VP-${index}`,
        logicalRange: `${index * sim.state.pageSizeTokens}-${(index + 1) * sim.state.pageSizeTokens - 1}`,
        virtualAddress: `0x${(0x4000 + index * 0x100).toString(16)}`,
        physicalPlacement: entry.sessionId === "shared" ? `shared:${entry.tier}` : `${entry.sessionId}:${entry.tier}`,
        residency: entry.tier,
        migratable: !entry.pinned,
      }));

      const comparison = [
        { name: "FlashAttention-style IO-aware execution", routingDeterminism: 72, fragmentation: fragmentation.fragmentationPercent * 1.1, replayStability: 68, dmaTraffic: distributedRouting.remoteFetchRate * 0.88, residencyEfficiency: 64, orchestrationOverhead: 46 },
        { name: "PagedAttention-style paging", routingDeterminism: 70 * factors.determinism, fragmentation: fragmentation.fragmentationPercent * 0.7, replayStability: 66, dmaTraffic: distributedRouting.remoteFetchRate * 1.08, residencyEfficiency: 72, orchestrationOverhead: 58 },
        { name: "vAttention-style virtual remapping", routingDeterminism: 75 * factors.determinism, fragmentation: fragmentation.fragmentationPercent * 0.64, replayStability: 74, dmaTraffic: distributedRouting.remoteFetchRate * 1.02, residencyEfficiency: 76, orchestrationOverhead: 61 },
        { name: "Deterministic residency orchestration", routingDeterminism: 88 * factors.determinism, fragmentation: fragmentation.fragmentationPercent * 0.82, replayStability: 91, dmaTraffic: distributedRouting.remoteFetchRate * 0.94, residencyEfficiency: 84, orchestrationOverhead: 69 },
        { name: "Hybrid orchestration model", routingDeterminism: 92 * factors.determinism, fragmentation: fragmentation.fragmentationPercent * factors.fragmentation, replayStability: 93 * factors.stability, dmaTraffic: distributedRouting.remoteFetchRate * factors.dma, residencyEfficiency: 89, orchestrationOverhead: 63 * factors.complexity },
      ];

      return {
        mode: sim.state.kvLayoutMode,
        pageBytes,
        totalVirtualPages,
        pageTable,
        remapCount: pageTable.filter((page, index) => index % 3 === 1).length,
        contiguousVirtualLayout: true,
        comparison,
      };
    },
  };
})();
