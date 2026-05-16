(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.security = sim.security || {};

  const REGION_FLAGS = {
    KV_PERF: { readOnly: false, noToolAccess: false, replayProtected: false, dmaAllowed: true, exportAllowed: false, scrubOnRelease: false, integrityTracked: false },
    REASONING_LOG_PROTECTED: { readOnly: false, noToolAccess: true, replayProtected: true, dmaAllowed: false, exportAllowed: false, scrubOnRelease: true, integrityTracked: true },
    TOOL_PAYLOAD_UNTRUSTED: { readOnly: false, noToolAccess: false, replayProtected: false, dmaAllowed: true, exportAllowed: false, scrubOnRelease: true, integrityTracked: true },
    SHARED_PREFIX: { readOnly: true, noToolAccess: false, replayProtected: true, dmaAllowed: true, exportAllowed: false, scrubOnRelease: false, integrityTracked: true },
    SPECULATIVE_TEMP: { readOnly: false, noToolAccess: false, replayProtected: false, dmaAllowed: true, exportAllowed: false, scrubOnRelease: true, integrityTracked: false },
    EXPORT_TRACE: { readOnly: true, noToolAccess: true, replayProtected: false, dmaAllowed: false, exportAllowed: true, scrubOnRelease: false, integrityTracked: true },
  };

  function flagsFor(regionType) {
    return { ...(REGION_FLAGS[regionType] || REGION_FLAGS.KV_PERF) };
  }

  function checkMappingAllowed(sourceRegion, targetRegion) {
    if (sourceRegion.regionType === "TOOL_PAYLOAD_UNTRUSTED" && targetRegion.regionType === "REASONING_LOG_PROTECTED") {
      return { allowed: false, reason: "tool payload cannot map into protected reasoning-log region" };
    }
    if (targetRegion.flags.readOnly && sourceRegion.writeIntent) {
      return { allowed: false, reason: "target region is read-only" };
    }
    if (!targetRegion.flags.exportAllowed && sourceRegion.regionType === "EXPORT_TRACE") {
      return { allowed: false, reason: "target region disallows export mapping" };
    }
    if (!targetRegion.flags.dmaAllowed && sourceRegion.viaDma) {
      return { allowed: false, reason: "DMA not allowed into target region" };
    }
    return { allowed: true, reason: "mapping satisfies simulator-level isolation policy" };
  }

  function validateIsolationPolicy(regions) {
    const violations = [];
    regions.forEach((region) => {
      if (region.regionType === "REASONING_LOG_PROTECTED" && region.tier !== "SRAM") {
        violations.push(`Protected reasoning region ${region.objectId} must remain deterministically placed in SRAM.`);
      }
    });
    return {
      valid: violations.length === 0,
      violations,
    };
  }

  function enforceRegionFlags(region) {
    const flags = flagsFor(region.regionType);
    return {
      ...region,
      flags,
      protected: flags.replayProtected || flags.noToolAccess,
      pinned: region.pinned || flags.replayProtected,
    };
  }

  function generateIsolationAuditLog({ regions, mappingAttempts, exportRequests }) {
    const policy = validateIsolationPolicy(regions);
    const entries = [];
    mappingAttempts.forEach((attempt, index) => {
      entries.push({
        id: `map-${index + 1}`,
        type: "mapping",
        source: attempt.sourceId,
        target: attempt.targetId,
        allowed: attempt.allowed,
        reason: attempt.reason,
      });
    });
    exportRequests.forEach((request, index) => {
      entries.push({
        id: `export-${index + 1}`,
        type: "export",
        source: request.objectId,
        allowed: request.allowed,
        reason: request.reason,
      });
    });
    return {
      policyValid: policy.valid,
      violations: policy.violations,
      entries,
    };
  }

  sim.security.isolationBoundary = {
    REGION_FLAGS,
    flagsFor,
    checkMappingAllowed,
    validateIsolationPolicy,
    enforceRegionFlags,
    generateIsolationAuditLog,
  };
})();
