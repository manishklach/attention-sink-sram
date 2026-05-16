(function () {
  const sim = window.AttentionSinkSim;

  const compressionProfiles = {
    "uncompressed-sram": {
      ratio: 1,
      decompressionLatency: 0,
      dmaSavings: 0,
      effectiveCapacityGain: 1,
    },
    "quantized-hbm": {
      ratio: 0.42,
      decompressionLatency: 3.4,
      dmaSavings: 0.38,
      effectiveCapacityGain: 2.1,
    },
    "compressed-cold-storage": {
      ratio: 0.2,
      decompressionLatency: 7.2,
      dmaSavings: 0.62,
      effectiveCapacityGain: 3.4,
    },
  };

  sim.compression = {
    definitions: compressionProfiles,

    build(directory, dmaState) {
      const profile = compressionProfiles[sim.state.compressionMode] || compressionProfiles["quantized-hbm"];
      const coldEntries = directory.entries.filter((entry) => entry.tier !== "SRAM");
      const compressedBytes = coldEntries.reduce((sum, entry) => sum + entry.bytes * profile.ratio, 0);
      const rawBytes = coldEntries.reduce((sum, entry) => sum + entry.bytes, 0);

      return {
        mode: sim.state.compressionMode,
        ratio: profile.ratio,
        decompressionLatency: profile.decompressionLatency,
        dmaSavings: profile.dmaSavings,
        effectiveCapacityGain: profile.effectiveCapacityGain,
        rawBytes,
        compressedBytes,
        bandwidthSavings: dmaState.totalBytes * profile.dmaSavings,
        decompressionEvents: Math.max(0, Math.round(coldEntries.length * (profile.decompressionLatency > 0 ? 0.7 : 0))),
      };
    },
  };
})();
