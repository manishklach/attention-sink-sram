(function () {
  const sim = window.AttentionSinkSim;

  function entropy(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!total) {
      return 0;
    }
    return values.reduce((sum, value) => {
      if (!value) {
        return sum;
      }
      const p = value / total;
      return sum - p * Math.log2(p);
    }, 0);
  }

  sim.metrics = {
    definitions: {
      executionStability: "Approximate stability of the current execution window after accounting for churn, rollback pressure, and fragmentation.",
      residencyHalfLife: "Estimated number of decode steps that promoted entries remain useful before demotion or compaction pressure dominates.",
      effectiveSramAmplification: "Logical KV coverage divided by SRAM budgeted entries, approximating how much fast-tier reach is gained from selective placement.",
      promotionEntropy: "Entropy of promoted slice scores, used as a proxy for how concentrated promotion decisions are across heads and layers.",
      routingDeterminism: "Share of decode routing that remains stable across current deterministic windows.",
      dmaEfficiency: "HBM reads avoided per byte of DMA movement, modeled as a control-plane efficiency proxy.",
      speculativeWasteFactor: "Wasted speculative DMA bytes divided by total speculative bytes touched.",
      residencyVolatility: "Volatility of tier placement driven by fragmentation, evictions, and promotion churn.",
      decodeStallProbability: "Approximate probability that decode stalls due to mixed-tier misses, DMA queueing, or rollback pressure.",
      multiTenantReuseEfficiency: "Avoided duplicate promotions normalized by attached sessions and shared-prefix participation.",
      compactionOverhead: "Compaction cost proxy combining relocation traffic and compaction event count.",
      deterministicDecodeHitRate: "Fraction of decode lookups expected to hit deterministic fast-tier residency windows.",
      effectiveBandwidthSaved: "Approximate bandwidth saved through fast-tier hits and compressed-tier routing.",
      estimatedLatencySaved: "Approximate latency savings relative to HBM-only decode routing.",
      tenantSharingEfficiency: "Current run's sharing efficiency derived from shared-prefix reuse.",
    },

    summarize(snapshot) {
      const promotedEntries = snapshot.directory.entries.filter((entry) => entry.tier === "SRAM");
      const promotedScores = promotedEntries.map((entry) => Math.max(0.001, entry.sinkScore));
      const totalPromotedBytes = promotedEntries.reduce((sum, entry) => sum + entry.bytes, 0);
      const totalLogicalBytes = snapshot.directory.entries.reduce((sum, entry) => sum + entry.bytes, 0);
      const totalSpeculativeBytes = snapshot.speculative.rows.reduce((sum, row) => sum + row.draftTokens * snapshot.model.headDim * snapshot.model.bytesPerElement * 2, 0);
      const mixedRoutes = snapshot.routing.rows.filter((row) => row.routingDecision === "Mixed").length;
      const hbmRoutes = snapshot.routing.rows.filter((row) => row.routingDecision === "HBM").length;
      const attachedSessions = snapshot.sessions.filter((session) => session.attachedSharedPrefix).length;

      return {
        executionStability: snapshot.orchestrator.executionStability,
        residencyHalfLife: snapshot.orchestrator.residencyHalfLife,
        effectiveSramAmplification: totalPromotedBytes ? totalLogicalBytes / totalPromotedBytes : 0,
        promotionEntropy: entropy(promotedScores),
        routingDeterminism: Math.max(0, snapshot.orchestrator.executionWindowStability * 100 - mixedRoutes * 0.35),
        dmaEfficiency: snapshot.dma.totalBytes ? snapshot.routing.totalReadsAvoided / snapshot.dma.totalBytes : 0,
        speculativeWasteFactor: totalSpeculativeBytes ? snapshot.speculative.wastedBytes / totalSpeculativeBytes : 0,
        residencyVolatility: snapshot.orchestrator.residencyVolatility,
        decodeStallProbability: Math.min(100, hbmRoutes * 2.2 + snapshot.dma.queued.length * 4 + snapshot.speculative.rollbackCount * 3.5),
        multiTenantReuseEfficiency: attachedSessions ? snapshot.sharedMetrics.duplicatePromotionsAvoided / attachedSessions : 0,
        compactionOverhead: snapshot.fragmentation.compactionOverhead,
        deterministicDecodeHitRate: snapshot.orchestrator.deterministicDecodeHitRate,
        effectiveBandwidthSaved: snapshot.compression.bandwidthSavings + snapshot.routing.totalReadsAvoided * snapshot.model.headDim * snapshot.model.bytesPerElement,
        estimatedLatencySaved: snapshot.orchestrator.latencySavings,
        tenantSharingEfficiency: snapshot.telemetry.current.sharingEfficiency,
      };
    },
  };
})();
