(function () {
  const sim = window.AttentionSinkSim;

  sim.integration = {
    build(snapshot) {
      const prefillNodes = Math.min(sim.state.prefillNodes, snapshot.topology.nodes.length);
      const decodeNodes = Math.min(sim.state.decodeNodes, snapshot.topology.nodes.length);
      const prefillDeviceIds = snapshot.topology.nodes.slice(0, prefillNodes).map((node) => node.id);
      const decodeDeviceIds = snapshot.topology.nodes.slice(prefillNodes, prefillNodes + decodeNodes).map((node) => node.id);
      return {
        prefillNodes: prefillDeviceIds,
        decodeNodes: decodeDeviceIds,
        kvTransferCost: snapshot.distributedRouting.remoteFetchRate * sim.state.remoteLatencyMultiplier,
        migrationAmplification: snapshot.migration.congestionAmplification,
        replayStability: Math.max(30, snapshot.metricsSummary.routingDeterminism - snapshot.distributedRouting.remoteFetchRate * 0.2),
        stackLayers: [
          "compiler",
          "orchestration-runtime",
          "scheduler",
          "dma-engine",
          "residency-manager",
          "topology-manager",
          "fabric",
          "memory-tiers",
          "kernels",
        ],
      };
    },
  };
})();
