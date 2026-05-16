(function () {
  const sim = window.AttentionSinkSim;

  const costModeBias = {
    "throughput-optimized": 1,
    "memory-optimized": 0.88,
    "latency-premium": 1.12,
  };

  sim.economics = {
    build(snapshot) {
      const bias = costModeBias[sim.state.costMode] || 1;
      const bandwidthCost = (snapshot.fabric.utilization / 100) * sim.state.fabricBandwidth * 0.8 * bias;
      const memoryCost = snapshot.topology.summary.totalSram / (1024 * 1024) * 0.45 + snapshot.topology.summary.totalHbm / (1024 * 1024) * 0.08;
      const fabricCost = snapshot.topology.links.length * 2.6 * bias;
      const pooledMemoryEfficiency = Math.max(0.4, 1.4 - snapshot.pooling.remoteAccessAmplification * 0.18);
      const throughputPerDollar = (snapshot.routing.totalReadsAvoided + snapshot.distributedRouting.localHits * 0.4) / Math.max(1, bandwidthCost + memoryCost + fabricCost);
      return {
        bandwidthCost,
        memoryCost,
        fabricCost,
        sramEfficiencyGain: snapshot.metricsSummary.effectiveSramAmplification,
        pooledMemoryEfficiency,
        throughputPerDollar,
        scalingCurve: Array.from({ length: 5 }, (_, index) => ({
          devices: 2 + index * 2,
          throughputPerDollar: throughputPerDollar * (0.82 + index * 0.12),
          remotePenalty: snapshot.distributedRouting.remoteFetchRate * (1.08 + index * 0.07),
        })),
      };
    },
  };
})();
