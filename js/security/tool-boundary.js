(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.security = sim.security || {};

  const PAYLOAD_TYPES = [
    "web result",
    "file result",
    "agent output",
    "code execution result",
    "user-provided data",
    "untrusted external blob",
  ];

  function createPayload(index, sessionId, seed) {
    const type = PAYLOAD_TYPES[index % PAYLOAD_TYPES.length];
    return {
      objectId: `tool-payload-${seed}-${index + 1}`,
      sessionId,
      payloadType: type,
      regionType: "TOOL_PAYLOAD_UNTRUSTED",
      writeIntent: true,
      viaDma: false,
      sizeBytes: 2048 + index * 512,
      references: [`reasoning-ref-${sessionId}`],
    };
  }

  function buildState(sessions, count, seed) {
    const payloads = Array.from({ length: count }, (_, index) => createPayload(index, sessions[index % sessions.length].sessionId, seed));
    return {
      payloads,
      trustedZoneLabel: "Protected reasoning + deterministic KV zones",
      untrustedZoneLabel: "External tool payload zone",
      allowedReferences: payloads.map((payload) => ({
        payloadId: payload.objectId,
        reasoningReference: payload.references[0],
      })),
    };
  }

  function attemptForbiddenMapping(payload, targetRegion) {
    const result = sim.security.isolationBoundary.checkMappingAllowed(payload, targetRegion);
    return {
      sourceId: payload.objectId,
      targetId: targetRegion.objectId,
      allowed: result.allowed,
      reason: result.reason,
    };
  }

  sim.security.toolBoundary = {
    PAYLOAD_TYPES,
    buildState,
    attemptForbiddenMapping,
  };
})();
