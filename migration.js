(function () {
  const sim = window.AttentionSinkSim;

  sim.migration = {
    build(topology, fabric, directory, scheduler) {
      const movedEntries = directory.entries.filter((entry, index) => index % 3 === 0).slice(0, Math.max(4, sim.state.deviceCount));
      const waves = movedEntries.map((entry, index) => {
        const fromNode = topology.nodes[index % topology.nodes.length];
        const toNode = topology.nodes[(index + 1) % topology.nodes.length];
        const hops = sim.state.topologyType === "star" ? 2 : sim.state.topologyType === "mesh" ? 1 + (index % 2) : 2;
        return {
          id: `MW${index + 1}`,
          entryId: entry.entryId,
          sessionId: entry.sessionId,
          fromNode: fromNode.id,
          toNode: toNode.id,
          bytes: entry.bytes,
          hops,
          multicast: index % Math.max(2, sim.state.multicastFanout) === 0,
          latency: hops * sim.state.fabricLinkLatency + Math.round(entry.bytes / Math.max(1, sim.state.fabricBandwidth * 1024)),
        };
      });
      return {
        waves,
        totalBytes: waves.reduce((sum, wave) => sum + wave.bytes, 0),
        multicastBytes: waves.filter((wave) => wave.multicast).reduce((sum, wave) => sum + wave.bytes, 0),
        congestionAmplification: Math.max(1, 1 + fabric.hotspots * 0.18),
        synchronizedPromotions: Math.round(waves.length * scheduler.executionWindowPreservation / 100),
      };
    },
  };
})();
