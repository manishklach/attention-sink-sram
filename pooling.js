(function () {
  const sim = window.AttentionSinkSim;

  sim.pooling = {
    build(topology, directory) {
      const pooledNodes = topology.pooledNodes;
      const spillEntries = Math.max(1, Math.round(directory.entries.length * (sim.state.pooledSpillPercent / 100)));
      const spillBytes = directory.entries
        .slice(-spillEntries)
        .reduce((sum, entry) => sum + entry.bytes, 0);
      const occupancy = pooledNodes.length
        ? spillBytes / Math.max(1, pooledNodes.reduce((sum, node) => sum + node.hbmCapacity, 0))
        : 0;
      return {
        pooledNodes: pooledNodes.map((node) => node.id),
        spillEntries,
        spillBytes,
        occupancyPercent: occupancy * 100,
        remoteAccessAmplification: 1 + occupancy * 2.4,
        pooledFragmentation: Math.min(100, 12 + spillEntries * 1.7),
        sharedResidencyEfficiency: directory.summary ? directory.summary.sharedUsers * 0.82 : 0,
      };
    },
  };
})();
