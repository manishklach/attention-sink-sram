(function () {
  const sim = window.AttentionSinkSim;

  sim.tiers = {
    build(directory, routingState, compressionState) {
      const tiers = [
        {
          id: "SRAM",
          latency: sim.state.sramLatency,
          bandwidth: sim.state.dmaBandwidth * 1.35,
          capacity: sim.computeKvBytes({
            layers: sim.state.layers,
            kvHeads: sim.state.kvHeads,
            headDim: sim.state.headDim,
            bytesPerElement: sim.state.bytesPerElement,
          }) * sim.state.sramBudget,
          energyCost: 1.0,
          promotionEligible: true,
        },
        {
          id: "HBM",
          latency: sim.state.hbmLatency,
          bandwidth: sim.state.dmaBandwidth,
          capacity: sim.state.sramBudget * 16 * 1024 * 1024,
          energyCost: 1.4,
          promotionEligible: true,
        },
        {
          id: "compressed-HBM",
          latency: sim.state.hbmLatency + compressionState.decompressionLatency,
          bandwidth: sim.state.dmaBandwidth * (1 + compressionState.dmaSavings),
          capacity: sim.state.sramBudget * 32 * 1024 * 1024 * compressionState.effectiveCapacityGain,
          energyCost: 1.6,
          promotionEligible: true,
        },
        {
          id: "host-DRAM",
          latency: sim.state.hbmLatency * 2.4,
          bandwidth: sim.state.dmaBandwidth * 0.45,
          capacity: sim.state.sramBudget * 128 * 1024 * 1024,
          energyCost: 2.2,
          promotionEligible: false,
        },
        {
          id: "SSD-offload",
          latency: sim.state.hbmLatency * 5.8,
          bandwidth: sim.state.dmaBandwidth * 0.12,
          capacity: sim.state.sramBudget * 1024 * 1024 * 1024,
          energyCost: 3.4,
          promotionEligible: false,
        },
      ];

      const sramEntries = directory.entries.filter((entry) => entry.tier === "SRAM").length;
      const hbmEntries = directory.entries.filter((entry) => entry.tier !== "SRAM" && !entry.stale).length;
      const coldEntries = directory.entries.filter((entry) => entry.stale).length;
      const tierHitRates = {
        SRAM: routingState.rows.length ? (routingState.rows.reduce((sum, row) => sum + row.sramHits, 0) / (routingState.rows.length * sim.state.kvHeads)) * 100 : 0,
        HBM: routingState.rows.length ? (routingState.rows.reduce((sum, row) => sum + row.fallbackHbmReads, 0) / (routingState.rows.length * sim.state.kvHeads)) * 100 : 0,
        "compressed-HBM": coldEntries ? 8 + coldEntries * 0.6 : 0,
        "host-DRAM": Math.max(0, coldEntries * 0.35),
        "SSD-offload": Math.max(0, coldEntries * 0.12),
      };

      const traffic = {
        SRAM: sramEntries * 96,
        HBM: hbmEntries * 144,
        "compressed-HBM": compressionState.compressedBytes,
        "host-DRAM": coldEntries * 64,
        "SSD-offload": Math.max(0, coldEntries - 1) * 48,
      };

      return {
        tiers,
        tierHitRates,
        traffic,
        fallbackEscalation: ["SRAM", "HBM", "compressed-HBM", "host-DRAM", "SSD-offload"],
      };
    },
  };
})();
