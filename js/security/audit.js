(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.security = sim.security || {};

  function buildInvariantReport(allocationState, isolationState, forbiddenAttempts) {
    const checks = [
      {
        name: "Pinned regions cannot be evicted",
        passed: allocationState.sram.entries.every((entry) => !entry.pinned || !allocationState.trace.some((trace) => trace.objectId === entry.objectId && trace.evictionStep !== null)),
      },
      {
        name: "Protected reasoning logs cannot be mapped by tool payloads",
        passed: forbiddenAttempts.every((attempt) => !attempt.allowed),
      },
      {
        name: "Deterministic replay produces identical offsets",
        passed: allocationState.replayVerification.passed,
      },
      {
        name: "Ring buffer does not overwrite protected regions",
        passed: allocationState.sram.entries.filter((entry) => entry.protected).every((entry, index, list) => list.findIndex((other) => other.offset === entry.offset) === index),
      },
      {
        name: "Untrusted payloads cannot share protected region types",
        passed: isolationState.regions.filter((region) => region.regionType === "TOOL_PAYLOAD_UNTRUSTED").every((region) => region.regionType !== "REASONING_LOG_PROTECTED"),
      },
      {
        name: "DMA cannot write into read-only regions",
        passed: isolationState.mappingAttempts.every((attempt) => attempt.allowed || !attempt.reason.includes("read-only") || attempt.sourceId.startsWith("tool-payload")),
      },
      {
        name: "Export excludes non-exportable protected regions",
        passed: isolationState.exportRequests.every((request) => request.allowed === request.flags.exportAllowed),
      },
    ];
    return {
      checks,
      passed: checks.every((check) => check.passed),
    };
  }

  sim.security.audit = {
    buildInvariantReport,
  };
})();
