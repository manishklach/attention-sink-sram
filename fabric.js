(function () {
  const sim = window.AttentionSinkSim;

  const fabricProfiles = {
    "pcie-like": { bandwidthFactor: 0.72, latencyBias: 5, multicast: 0.74 },
    "nvlink-like": { bandwidthFactor: 1.0, latencyBias: 1, multicast: 0.96 },
    "cxl-like": { bandwidthFactor: 0.82, latencyBias: 3, multicast: 0.84 },
    "ethernet-rdma-like": { bandwidthFactor: 0.66, latencyBias: 6, multicast: 0.78 },
  };

  sim.fabric = {
    build(topology, sessions) {
      const profile = fabricProfiles[sim.state.fabricType] || fabricProfiles["nvlink-like"];
      const congestionEvent = sim.memory.stressEvents["bandwidth-saturation"] || 0;
      const deviceLoss = sim.memory.stressEvents["device-loss"] || 0;
      const linkScale = Math.max(0.35, profile.bandwidthFactor - congestionEvent * 0.06);
      const links = topology.links.map((link, index) => {
        const utilization = Math.min(
          100,
          24 +
            (index % 4) * 13 +
            sessions.length * 4 +
            sim.state.decodeConcurrency * 3 +
            congestionEvent * 12
        );
        return {
          ...link,
          bandwidth: sim.state.fabricBandwidth * linkScale,
          latency: sim.state.fabricLinkLatency + profile.latencyBias + Math.floor(utilization / 28),
          utilization,
          saturated: utilization > 84,
          failed: deviceLoss > 0 && index === topology.links.length - 1,
          multicastEfficiency: profile.multicast * (1 - Math.min(0.3, utilization / 240)),
        };
      });
      const hotspotCount = links.filter((link) => link.saturated || link.failed).length;
      return {
        type: sim.state.fabricType,
        links,
        utilization: sim.utils.average(links.map((link) => link.utilization)),
        hotspots: hotspotCount,
        multicastEfficiency: sim.utils.average(links.map((link) => link.multicastEfficiency)),
      };
    },
  };
})();
