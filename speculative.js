(function () {
  const sim = window.AttentionSinkSim;

  sim.speculative = {
    buildTrace(sessions) {
      const runtimePolicy = sim.memory.policyRuntime || {};
      const effectiveAcceptRate = sim.utils.clamp(
        sim.state.draftAcceptRate * (runtimePolicy.speculativeWeight || 1),
        0.1,
        0.98
      );
      const rows = [];
      let wastedBytes = 0;
      let rollbackCount = 0;
      let reclaimedBytes = 0;
      let stableRetention = 0;
      const bytesPerDraft = Math.max(
        1,
        sim.computePromotionBytes(
          {
            layers: sim.state.layers,
            kvHeads: sim.state.kvHeads,
            headDim: sim.state.headDim,
            bytesPerElement: sim.state.bytesPerElement,
          },
          sim.state,
          Math.max(1, sim.state.promotedHeads)
        ) / 2
      );

      sessions.forEach((session, sessionIndex) => {
        for (let step = 0; step < sim.state.decodeSteps; step += 1) {
          const accepted = Math.round(sim.state.draftTokens * effectiveAcceptRate + ((sessionIndex + step) % 2 ? 0 : 1));
          const clampedAccepted = Math.min(sim.state.draftTokens, Math.max(0, accepted));
          const rejected = Math.max(0, sim.state.draftTokens - clampedAccepted);
          const reclaim = rejected * bytesPerDraft;
          const wasted = rejected * bytesPerDraft;
          const retained = clampedAccepted * bytesPerDraft * 0.55;

          if (rejected > 0) {
            rollbackCount += 1;
          }
          wastedBytes += wasted;
          reclaimedBytes += reclaim;
          stableRetention += retained;

          rows.push({
            sessionId: session.sessionId,
            step,
            draftTokens: sim.state.draftTokens,
            accepted: clampedAccepted,
            rejected,
            reclaimedBytes: reclaim,
            wastedBytes: wasted,
            stableRetention: retained,
          });
        }
      });

      return {
        rows,
        wastedBytes,
        rollbackCount,
        reclaimedBytes,
        stableRetention,
        effectiveAcceptRate,
      };
    },
  };
})();
