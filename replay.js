(function () {
  const sim = window.AttentionSinkSim;

  const requiredFields = [
    "timestamp",
    "sessionId",
    "tokenId",
    "layer",
    "head",
    "sinkScore",
    "attentionWeight",
    "speculative",
    "accepted",
    "reusedPrefix",
  ];

  function validateEntry(entry) {
    return requiredFields.every((field) => Object.prototype.hasOwnProperty.call(entry, field));
  }

  sim.replay = {
    validateTrace(payload) {
      const events = Array.isArray(payload) ? payload : payload && Array.isArray(payload.events) ? payload.events : null;
      if (!events) {
        return { valid: false, message: "Trace must be an array or an object with an events array." };
      }
      const invalid = events.find((entry) => !validateEntry(entry));
      if (invalid) {
        return { valid: false, message: "Trace entries are missing required fields." };
      }
      return { valid: true, events };
    },

    importTrace(text) {
      try {
        const parsed = JSON.parse(text);
        const validation = this.validateTrace(parsed);
        if (!validation.valid) {
          return validation;
        }
        sim.memory.importedTrace = {
          events: validation.events,
          importedAt: new Date().toISOString(),
        };
        sim.persistence.saveTrace(sim.memory.importedTrace);
        return { valid: true, events: validation.events };
      } catch (error) {
        return { valid: false, message: "Trace JSON could not be parsed." };
      }
    },

    buildReplaySummary(trace) {
      const events = trace ? trace.events : [];
      const sessions = new Set(events.map((entry) => entry.sessionId));
      const averageSink = events.length ? events.reduce((sum, entry) => sum + entry.sinkScore, 0) / events.length : 0;
      return {
        eventCount: events.length,
        sessionCount: sessions.size,
        averageSink,
        speculativeRate: events.length ? events.filter((entry) => entry.speculative).length / events.length : 0,
      };
    },

    toTimeline(trace) {
      return (trace ? trace.events : []).slice(0, 120).map((event, index) => ({
        id: `TRACE-${index}`,
        timestamp: event.timestamp,
        stage: event.speculative ? (event.accepted ? "Trace speculative accept" : "Trace speculative reject") : "Trace decode",
        sessionId: event.sessionId,
        tokenRange: `${event.tokenId}-${event.tokenId}`,
        headsAffected: String(event.head),
        layerRange: `${event.layer}-${event.layer}`,
        bytesMoved: 64 + Math.round(event.attentionWeight * 96),
        sourceTier: event.reusedPrefix ? "SRAM" : "HBM",
        destinationTier: event.accepted ? "Decode engine" : "Rollback",
        estimatedLatency: 1 + event.sinkScore * 6,
      }));
    },
  };
})();
