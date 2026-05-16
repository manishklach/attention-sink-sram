(function () {
  const sim = window.AttentionSinkSim;

  function normalizeEvent(event, index) {
    return {
      timestamp: event.timestamp ?? index,
      sessionId: event.sessionId ?? event.requestId ?? `S${(index % Math.max(1, sim.state.tenantCount)) + 1}`,
      tokenId: event.tokenId ?? event.token ?? index,
      layer: event.layer ?? 0,
      head: event.head ?? 0,
      sinkScore: event.sinkScore ?? event.score ?? 0.5,
      attentionWeight: event.attentionWeight ?? event.weight ?? 0.5,
      speculative: Boolean(event.speculative ?? event.isSpeculative),
      accepted: Boolean(event.accepted ?? event.isAccepted ?? true),
      reusedPrefix: Boolean(event.reusedPrefix ?? event.sharedPrefix),
      eventType: event.eventType ?? event.kind ?? "runtime",
    };
  }

  sim.traces = {
    importRuntimeTrace(text) {
      try {
        const parsed = JSON.parse(text);
        const events = Array.isArray(parsed) ? parsed : Array.isArray(parsed.events) ? parsed.events : [];
        const normalized = events.map(normalizeEvent);
        sim.memory.importedRuntimeTrace = normalized;
        return {
          valid: normalized.length > 0,
          message: normalized.length ? `Loaded ${normalized.length} runtime events.` : "Trace contained no usable events.",
          summary: this.summarize(normalized),
        };
      } catch (error) {
        return { valid: false, message: `Trace parse error: ${error.message}` };
      }
    },

    summarize(events) {
      return {
        eventCount: events.length,
        schema: sim.state.traceSchema,
        sessionCount: new Set(events.map((event) => event.sessionId)).size,
        speculativeCount: events.filter((event) => event.speculative).length,
      };
    },
  };
})();
