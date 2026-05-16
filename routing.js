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

    buildDistributedRouting(topology, fabric, directory, sessions) {
      const pooledNodes = topology.pooledNodes.map((node) => node.id);
      const remoteSpike = sim.memory.stressEvents["remote-latency-spike"] || 0;
      const pooledExhaustion = sim.memory.stressEvents["pooled-memory-exhaustion"] || 0;
      const deviceLoss = sim.memory.stressEvents["device-loss"] || 0;
      const rows = [];
      let remoteFetches = 0;
      let localHits = 0;
      let pooledAccesses = 0;
      let escalations = 0;

      sessions.forEach((session, sessionIndex) => {
        const localNode = topology.nodes.find((node) => node.assignedSessions.includes(session.sessionId)) || topology.nodes[sessionIndex % topology.nodes.length];
        for (let step = 0; step < sim.state.decodeSteps; step += 1) {
          const modeSelector = (step + sessionIndex + sim.state.seed) % 5;
          let target = "local-SRAM";
          let hops = 0;
          let latency = sim.state.sramLatency + localNode.latency;
          if (modeSelector === 1 || modeSelector === 2) {
            target = "remote-SRAM";
            hops = sim.state.topologyType === "star" ? 2 : 1;
            latency = sim.state.sramLatency + sim.state.fabricLinkLatency * hops + remoteSpike * 3;
            remoteFetches += 1;
          } else if (modeSelector === 3) {
            target = "remote-HBM";
            hops = sim.state.topologyType === "mesh" ? 2 : 3;
            latency = sim.state.hbmLatency + sim.state.fabricLinkLatency * hops + remoteSpike * 4;
            remoteFetches += 1;
          } else if (modeSelector === 4 && pooledNodes.length && pooledExhaustion === 0) {
            target = "pooled-memory";
            hops = 2;
            latency = sim.state.hbmLatency * 0.8 + sim.state.fabricLinkLatency * 2 + 5;
            pooledAccesses += 1;
            remoteFetches += 1;
          } else if (pooledExhaustion > 0 || deviceLoss > 0) {
            target = "storage-offload";
            hops = 4;
            latency = sim.state.hbmLatency * 1.8 + sim.state.fabricLinkLatency * 4 + 12;
            escalations += 1;
            remoteFetches += 1;
          } else {
            localHits += 1;
          }

          const congested = fabric.links.some((link) => link.saturated || link.failed);
          latency += congested ? 3 : 0;
          rows.push({
            stepId: `DIST-${session.sessionId}-${step}`,
            sessionId: session.sessionId,
            step,
            localDevice: localNode.id,
            targetTier: target,
            hops,
            latency,
            congested,
            decision: target === "local-SRAM" ? "Local" : target === "pooled-memory" ? "Pooled" : target === "storage-offload" ? "Escalated" : "Remote",
          });
        }
      });

      return {
        rows,
        remoteFetches,
        localHits,
        pooledAccesses,
        escalations,
        remoteFetchRate: (remoteFetches / Math.max(1, rows.length)) * 100,
        averageRemoteLatency: remoteFetches ? sim.utils.average(rows.filter((row) => row.targetTier !== "local-SRAM").map((row) => row.latency)) : 0,
      };
    },
  };
})();
