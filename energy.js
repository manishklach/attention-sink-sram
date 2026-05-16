(function () {
  const sim = window.AttentionSinkSim;

  const modeBias = {
    balanced: 1,
    conservative: 0.86,
    performance: 1.18,
  };

  sim.energy = {
    build(snapshot) {
      const bias = modeBias[sim.state.energyMode] || 1;
      const sramAccessEnergy = snapshot.routing.rows.reduce((sum, row) => sum + row.sramHits * 0.45, 0) * bias;
      const hbmEnergy = snapshot.routing.rows.reduce((sum, row) => sum + row.fallbackHbmReads * 0.92, 0) * bias;
      const remoteFetchEnergy = snapshot.distributedRouting.remoteFetches * 1.35 * bias;
      const dmaEnergy = (snapshot.dma.totalBytes + snapshot.migration.totalBytes) / (1024 * 1024) * 0.38 * bias;
      const compressionEnergy = snapshot.compression.decompressionEvents * 0.62 * bias;
      const migrationEnergy = snapshot.migration.waves.length * 0.54 * bias;
      const total = sramAccessEnergy + hbmEnergy + remoteFetchEnergy + dmaEnergy + compressionEnergy + migrationEnergy;
      return {
        sramAccessEnergy,
        hbmEnergy,
        remoteFetchEnergy,
        dmaEnergy,
        compressionEnergy,
        migrationEnergy,
        total,
        energyPerDecodeToken: total / Math.max(1, snapshot.sessions.length * sim.state.decodeSteps),
        energyPerTenant: total / Math.max(1, snapshot.sessions.length),
        hotspots: [
          { label: "Remote fetch", value: remoteFetchEnergy },
          { label: "HBM", value: hbmEnergy },
          { label: "DMA", value: dmaEnergy },
        ].sort((a, b) => b.value - a.value),
      };
    },
  };
})();
