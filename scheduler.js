(function () {
  const sim = window.AttentionSinkSim;

  sim.scheduler = {
    build(topology, fabric, pooling, sessions, routing) {
      const policy = sim.state.distributedPlacementPolicy;
      const decisions = sessions.map((session, index) => {
        const localDevice = topology.nodes.find((node) => node.assignedSessions.includes(session.sessionId)) || topology.nodes[index % topology.nodes.length];
        const colocateSharedPrefix = session.attachedSharedPrefix && policy !== "bandwidth-aware";
        const targetDevice =
          policy === "pooled-memory-optimized" && pooling.pooledNodes.length
            ? pooling.pooledNodes[index % pooling.pooledNodes.length]
            : localDevice.id;
        return {
          sessionId: session.sessionId,
          localDevice: localDevice.id,
          targetDevice,
          rationale:
            policy === "local-first"
              ? "Prefer local SRAM and HBM residency."
              : policy === "topology-aware"
                ? "Minimize hops across active fabric links."
                : policy === "latency-aware"
                  ? "Favor the lowest combined route latency."
                  : policy === "bandwidth-aware"
                    ? "Avoid hot links and spread DMA bursts."
                    : policy === "pooled-memory-optimized"
                      ? "Reserve local fast tier and spill colder KV to pooled memory."
                      : "Bias placement toward sessions with denser sink activity.",
          colocateSharedPrefix,
          congestionMitigation: fabric.hotspots > 0 ? "Delay non-critical promotions and prefer local reads." : "No mitigation required.",
        };
      });
      const stabilityPenalty = fabric.hotspots * 3 + pooling.occupancyPercent * 0.08;
      return {
        decisions,
        queueDepth: Math.ceil(routing.rows.length / Math.max(1, topology.nodes.length)),
        remoteFetchMitigation: Math.max(0, 88 - stabilityPenalty),
        executionWindowPreservation: Math.max(28, 94 - stabilityPenalty - (sim.memory.stressEvents["remote-latency-spike"] || 0) * 6),
      };
    },
  };
})();
