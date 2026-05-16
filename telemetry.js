(function () {
  const sim = window.AttentionSinkSim;

  sim.telemetry = {
    build(snapshot) {
      const point = {
        sramHitRate: snapshot.tierState.tierHitRates.SRAM,
        hbmHitRate: snapshot.tierState.tierHitRates.HBM,
        routingMix: snapshot.routing.rows.filter((row) => row.routingDecision === "Mixed").length,
        dmaQueueOccupancy: snapshot.dma.queued.length,
        promotionChurn: snapshot.orchestrator.promotionChurn,
        residencyHalfLife: snapshot.orchestrator.residencyHalfLife,
        rollbackRate: snapshot.speculative.rollbackCount / Math.max(1, snapshot.sessions.length * sim.state.decodeSteps),
        deterministicDecode: snapshot.orchestrator.deterministicDecodeHitRate,
        bandwidthSaved: snapshot.compression.bandwidthSavings,
        latencySaved: snapshot.orchestrator.latencySavings,
        sharingEfficiency: snapshot.sharedMetrics.duplicatePromotionsAvoided / Math.max(1, snapshot.sessions.length),
      };

      sim.memory.telemetryHistory.push(point);
      if (sim.memory.telemetryHistory.length > 24) {
        sim.memory.telemetryHistory.shift();
      }

      const history = sim.memory.telemetryHistory;
      return {
        current: point,
        history,
        movingAverages: {
          sramHitRate: sim.utils.average(history.map((item) => item.sramHitRate)),
          dmaQueueOccupancy: sim.utils.average(history.map((item) => item.dmaQueueOccupancy)),
          rollbackRate: sim.utils.average(history.map((item) => item.rollbackRate)),
          deterministicDecode: sim.utils.average(history.map((item) => item.deterministicDecode)),
        },
        eventCounters: { ...sim.memory.stressEvents },
      };
    },
  };
})();
