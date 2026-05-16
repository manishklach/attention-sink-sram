(function () {
  const sim = window.AttentionSinkSim;

  sim.metrics = {
    summarize(orchestrator, tierState, telemetry) {
      return {
        executionStability: orchestrator.executionStability,
        residencyVolatility: orchestrator.residencyVolatility,
        deterministicDecodeHitRate: orchestrator.deterministicDecodeHitRate,
        effectiveBandwidthSaved: tierState.traffic["compressed-HBM"] ? telemetry.current.bandwidthSaved : 0,
        estimatedLatencySaved: orchestrator.latencySavings,
        tenantSharingEfficiency: telemetry.current.sharingEfficiency,
      };
    },
  };
})();
