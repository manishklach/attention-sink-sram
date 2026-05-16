(function () {
  const sim = window.AttentionSinkSim;

  function parseHeadRange(value) {
    return String(value)
      .split(",")
      .filter((item) => item !== "" && item !== "none")
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  sim.timeline = {
    buildEvents(sessions, directory, dmaState, routingState, speculativeState, promotedHeads) {
      const events = [];
      let time = 0;

      sessions.forEach((session, sessionIndex) => {
        events.push(this.makeEvent(time, "Prefill", session.sessionId, `0-${session.promptLength - 1}`, promotedHeads, "0-" + (sim.state.layers - 1), 0, "Tokenizer", "Prefill engine", 2));
        time += 2;
        events.push(this.makeEvent(time, "Sink detection", session.sessionId, `0-${session.sharedPrefixLength + 2}`, promotedHeads, `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`, 0, "Prefill engine", "Sink detector", 1));
        time += 1;
        if (session.attachedSharedPrefix) {
          events.push(this.makeEvent(time, "Shared-prefix attach", session.sessionId, `0-${session.sharedPrefixLength - 1}`, promotedHeads, `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`, 0, "Directory", "SRAM cache", 1));
        } else {
          events.push(this.makeEvent(time, "Shared-prefix detach", session.sessionId, `0-${session.sharedPrefixLength - 1}`, promotedHeads, `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`, 0, "Directory", "HBM cache", 1));
        }
        time += 1;
      });

      dmaState.descriptors.forEach((descriptor, index) => {
        events.push(
          this.makeEvent(
            descriptor.enqueueTime + index,
            "DMA promotion",
            descriptor.sessionId,
            descriptor.tokenRange,
            parseHeadRange(descriptor.heads),
            descriptor.layers,
            descriptor.bytes,
            descriptor.source,
            descriptor.destination,
            descriptor.latency
          )
        );
      });

      directory.entries.forEach((entry, index) => {
        events.push(
          this.makeEvent(
            12 + index,
            "SRAM residency",
            entry.sessionId,
            entry.tokenRange,
            parseHeadRange(entry.headRange),
            entry.layerRange,
            entry.bytes,
            "DMA",
            entry.tier,
            1
          )
        );
        if (entry.evicting) {
          events.push(this.makeEvent(20 + index, "Eviction", entry.sessionId, entry.tokenRange, entry.headRange, entry.layerRange, entry.bytes, "SRAM", "HBM", 2));
        }
      });

      routingState.rows.slice(0, 18).forEach((row, index) => {
        events.push(
          this.makeEvent(
            24 + index,
            "Decode routing",
            row.sessionId,
            `${row.step}-${row.step}`,
            row.requestedHeads.split(",").map((head) => Number(head)),
            row.layers,
            row.sramHits * 64,
            row.routingDecision === "HBM" ? "HBM" : "Mixed",
            row.routingDecision,
            row.estimatedLatency
          )
        );
      });

      speculativeState.rows.slice(0, 10).forEach((row, index) => {
        if (row.rejected > 0) {
          events.push(this.makeEvent(44 + index, "Re-promotion", row.sessionId, `${row.step}-${row.step}`, promotedHeads, `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`, row.reclaimedBytes, "HBM", "SRAM", 2));
          events.push(this.makeEvent(45 + index, "Eviction", row.sessionId, `${row.step}-${row.step}`, promotedHeads, `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`, row.wastedBytes, "SRAM", "Reclaimed", 1));
        }
      });

      return events.sort((a, b) => a.timestamp - b.timestamp).map((event, index) => ({
        ...event,
        id: `EVT-${index}`,
      }));
    },

    makeEvent(timestamp, stage, sessionId, tokenRange, heads, layerRange, bytesMoved, sourceTier, destinationTier, estimatedLatency) {
      return {
        timestamp,
        stage,
        sessionId,
        tokenRange,
        headsAffected: Array.isArray(heads) ? heads.join(",") : heads,
        layerRange,
        bytesMoved,
        sourceTier,
        destinationTier,
        estimatedLatency,
      };
    },

    stop() {
      if (sim.memory.playbackTimer) {
        window.clearInterval(sim.memory.playbackTimer);
        sim.memory.playbackTimer = null;
      }
    },

    play(onTick) {
      this.stop();
      const interval = Math.max(120, 720 / Number(sim.state.timelineSpeed));
      sim.memory.playbackTimer = window.setInterval(() => {
        if (!sim.memory.lastRun) {
          return;
        }
        if (sim.memory.timelineCursor >= sim.memory.lastRun.timeline.length - 1) {
          this.stop();
          return;
        }
        sim.memory.timelineCursor += 1;
        onTick();
      }, interval);
    },

    pause() {
      this.stop();
    },

    step(onTick) {
      if (!sim.memory.lastRun) {
        return;
      }
      sim.memory.timelineCursor = Math.min(sim.memory.lastRun.timeline.length - 1, sim.memory.timelineCursor + 1);
      onTick();
    },
  };
})();
