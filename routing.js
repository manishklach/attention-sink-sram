(function () {
  const sim = window.AttentionSinkSim;

  sim.routing = {
    buildRoutingTable(directory, promotedHeads, sessions) {
      const promotedHeadIds = promotedHeads.map((head) => head.id);
      const exhaustion = sim.memory.stressEvents["sram-exhaustion"] || 0;
      const burst = sim.memory.stressEvents["tenant-burst"] || 0;
      const invalidation = sim.memory.stressEvents["prefix-invalidation"] || 0;
      const rows = [];
      let totalReadsAvoided = 0;
      let totalLatency = 0;
      let totalMisses = 0;

      sessions.forEach((session, sessionIndex) => {
        for (let step = 0; step < sim.state.decodeSteps; step += 1) {
          const requestedHeads = Array.from({ length: sim.state.kvHeads }, (_, index) => index);
          const activeEntries = directory.entries.filter(
            (entry) =>
              entry.tier === "SRAM" &&
              (entry.sessionId === session.sessionId || (entry.shared && session.attachedSharedPrefix))
          );
          const sharedHit = activeEntries.some((entry) => entry.shared);
          const rawHits = promotedHeadIds.filter((headId) => (sharedHit ? true : headId % 2 === step % 2)).length;
          const sramHits = Math.max(0, rawHits - exhaustion - Math.floor((burst + invalidation) / 2));
          const misses = Math.max(0, requestedHeads.length - sramHits);
          const layersInRange = sim.getSelectedLayerCount(sim.state);
          const mode = sramHits === 0 ? "HBM" : misses === 0 ? "SRAM" : "Mixed";
          const estimatedLatency =
            sramHits * sim.state.sramLatency +
            misses * sim.state.hbmLatency +
            (mode === "Mixed" ? Math.max(1, layersInRange / 12) : 0);
          const readsAvoided = sramHits * (session.attachedSharedPrefix ? 1.25 : 1);

          totalReadsAvoided += readsAvoided;
          totalLatency += estimatedLatency;
          totalMisses += misses;

          rows.push({
            stepId: `${session.sessionId}-${step}`,
            sessionId: session.sessionId,
            step,
            requestedHeads: requestedHeads.join(","),
            sramHits,
            sramMisses: misses,
            fallbackHbmReads: misses,
            estimatedLatency,
            routingDecision: mode,
            layers: sim.state.promotionGranularity === "per-head-layer" ? `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}` : `0-${sim.state.layers - 1}`,
          });
        }
      });

      return {
        rows,
        totalReadsAvoided,
        averageLatency: rows.length ? totalLatency / rows.length : 0,
        totalMisses,
      };
    },
  };
})();
