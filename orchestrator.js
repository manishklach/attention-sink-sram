(function () {
  const sim = window.AttentionSinkSim;

  function activeStressMultiplier(eventName) {
    return sim.memory.stressEvents[eventName] ? sim.memory.stressEvents[eventName] : 0;
  }

  sim.orchestrator = {
    build(snapshot) {
      const appliedPolicy = sim.policies.applyPolicyToState(sim.state);
      const totalBudgetBytes = sim.computeKvBytes(snapshot.model) * sim.state.sramBudget;
      const usedBytes = snapshot.directory.entries
        .filter((entry) => entry.tier === "SRAM")
        .reduce((sum, entry) => sum + entry.bytes, 0);
      const pendingPromotions = Math.max(0, snapshot.dma.descriptors.length - snapshot.dma.completed.length);
      const decodeQueueDepth = Math.ceil(snapshot.routing.rows.length / Math.max(1, snapshot.sessions.length * 3));
      const rollbackPressure = snapshot.speculative.rollbackCount * appliedPolicy.speculativeWeight + activeStressMultiplier("speculative-collapse") * 4;
      const residencyPressure =
        (usedBytes / Math.max(1, totalBudgetBytes)) * 100 +
        snapshot.fragmentation.fragmentationPercent * 0.3 +
        activeStressMultiplier("sram-exhaustion") * 12;
      const promotionChurn = snapshot.dma.descriptors.length + snapshot.evictionComparison.find((row) => row.name === sim.state.evictionPolicy).churn;
      const executionStability = Math.max(18, 100 - rollbackPressure * 3.4 - snapshot.fragmentation.fragmentationPercent * 0.42 - activeStressMultiplier("tenant-burst") * 6);
      const residencyVolatility = Math.min(100, snapshot.fragmentation.fragmentationPercent + promotionChurn * 0.7 + activeStressMultiplier("eviction-storm") * 10);
      const deterministicDecodeHitRate = Math.max(12, snapshot.tierState.tierHitRates.SRAM - snapshot.fragmentation.fragmentationPercent * 0.18 + appliedPolicy.guaranteeWeight * 100);
      const windowSize = sim.state.executionWindowDuration;
      const windows = Array.from({ length: Math.max(3, Math.ceil(sim.state.decodeSteps / Math.max(1, windowSize / 2))) }, (_, index) => {
        const stable = index % 3 !== 2 || sim.state.executionPolicy === "latency-optimized";
        const guarantee = Math.max(0.2, 0.72 + appliedPolicy.guaranteeWeight - index * 0.06 - activeStressMultiplier("prefix-invalidation") * 0.08);
        const pinnedEntries = Math.max(1, Math.round(sim.state.pinningDuration * guarantee));
        return {
          id: `W${index + 1}`,
          start: index * windowSize,
          end: index * windowSize + windowSize - 1,
          stable,
          guarantee,
          pinnedEntries,
          risk: stable ? "low" : guarantee > 0.55 ? "medium" : "high",
        };
      });

      return {
        appliedPolicy,
        activeSessions: snapshot.sessions.length,
        totalSramUsed: usedBytes,
        totalBudgetBytes,
        dmaUtilization: snapshot.dma.utilization,
        pendingPromotions,
        decodeQueueDepth,
        rollbackPressure,
        residencyPressure,
        promotionChurn,
        executionStability,
        residencyVolatility,
        deterministicDecodeHitRate,
        latencySavings: Math.max(0, snapshot.routing.totalReadsAvoided * (sim.state.hbmLatency - sim.state.sramLatency) * 0.12),
        residencyHalfLife: Math.max(1, sim.state.executionWindowDuration + sim.state.pinningDuration - snapshot.fragmentation.compactionEvents),
        windows,
        partitionPolicy: sim.state.partitionPolicy,
        executionWindowStability: windows.filter((window) => window.stable).length / Math.max(1, windows.length),
      };
    },

    buildPartitions(snapshot) {
      const totalBudgetBytes = sim.computeKvBytes(snapshot.model) * sim.state.sramBudget;
      const sessions = snapshot.sessions;
      const sharedReserved = totalBudgetBytes * (sim.state.sharedPoolPercent / 100);

      const allocations = sessions.map((session, index) => {
        let share = totalBudgetBytes / Math.max(1, sessions.length);
        if (sim.state.partitionPolicy === "weighted-by-tenant-priority") {
          share *= 0.7 + session.priority * 0.25;
        } else if (sim.state.partitionPolicy === "weighted-by-sink-density") {
          share *= 0.72 + session.sinkDensity * 0.6;
        } else if (sim.state.partitionPolicy === "weighted-by-active-decode-rate") {
          share *= 0.72 + session.decodeRate * 0.18;
        } else if (sim.state.partitionPolicy === "shared-prefix-reserved-pool") {
          share = (totalBudgetBytes - sharedReserved) / Math.max(1, sessions.length);
        }

        const used = snapshot.directory.entries
          .filter((entry) => entry.sessionId === session.sessionId && entry.tier === "SRAM")
          .reduce((sum, entry) => sum + entry.bytes, 0);
        return {
          sessionId: session.sessionId,
          allocatedBytes: share,
          usedBytes: used,
          wastedBytes: Math.max(0, share - used),
          oversubscribed: used > share,
          starvationRisk: used < share * 0.35 && snapshot.routing.rows.filter((row) => row.sessionId === session.sessionId).some((row) => row.routingDecision === "HBM"),
        };
      });

      return {
        totalBudgetBytes,
        sharedReserved,
        allocations,
        fragmentationRisk: snapshot.fragmentation.fragmentationPercent,
      };
    },
  };
})();
