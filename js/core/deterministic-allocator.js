(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.core = sim.core || {};

  function stableHash(text) {
    return String(text).split("").reduce((hash, char) => ((hash * 33) + char.charCodeAt(0)) >>> 0, 5381);
  }

  function tieBreak(a, b) {
    return a.objectId.localeCompare(b.objectId) ||
      a.sessionId.localeCompare(b.sessionId) ||
      stableHash(a.regionType) - stableHash(b.regionType);
  }

  function buildModeReason(mode, object) {
    if (object.regionType === "REASONING_LOG_PROTECTED") {
      return "protected reasoning log requires deterministic residency";
    }
    if (object.regionType === "SHARED_PREFIX") {
      return "shared prefix protected from opportunistic churn";
    }
    return `allocator mode ${mode} selected stable placement`;
  }

  function sortObjects(objects, mode) {
    return objects.slice().sort((a, b) => {
      const protectedBias = Number(!!b.protected) - Number(!!a.protected);
      if (protectedBias) {
        return protectedBias;
      }
      const sharedBias = Number(!!b.shared) - Number(!!a.shared);
      if (sharedBias) {
        return sharedBias;
      }
      if (mode === "priority partitions" || mode === "residency-contract protected") {
        const priorityBias = (b.priority || 0) - (a.priority || 0);
        if (priorityBias) {
          return priorityBias;
        }
      }
      return tieBreak(a, b);
    });
  }

  function replayAllocations(trace) {
    return trace
      .filter((step) => step.offset !== null && step.tier === "SRAM")
      .map((step) => ({
        objectId: step.objectId,
        offset: step.offset,
        sizeBytes: step.sizeBytes,
        allocationStep: step.allocationStep,
      }));
  }

  function verifyDeterministicReplay(traceA, traceB) {
    const left = JSON.stringify(replayAllocations(traceA));
    const right = JSON.stringify(replayAllocations(traceB));
    return {
      passed: left === right,
      left,
      right,
    };
  }

  function allocateObjects(objects, options = {}) {
    const mode = options.mode || "ring buffer";
    const sramCapacityBytes = options.sramCapacityBytes || (4 * 1024 * 1024);
    const hbmCapacityBytes = options.hbmCapacityBytes || (64 * 1024 * 1024);
    const buffer = sim.core.ringBuffer.create(sramCapacityBytes);
    const trace = [];
    const hbmAllocations = [];
    let hbmOffset = 0;
    let generation = 0;

    sortObjects(objects, mode).forEach((object, index) => {
      generation += 1;
      const baseRecord = {
        allocationId: `alloc-${index + 1}`,
        objectId: object.objectId,
        sessionId: object.sessionId,
        regionType: object.regionType,
        sizeBytes: object.sizeBytes,
        generation,
        allocationStep: index + 1,
        evictionStep: null,
        deterministicReason: buildModeReason(mode, object),
      };

      const sramPreferred = object.regionType !== "TOOL_PAYLOAD_UNTRUSTED" && object.regionType !== "EXPORT_TRACE";
      let placed = null;
      let evicted = [];
      if (sramPreferred) {
        placed = sim.core.ringBuffer.place(buffer, {
          ...object,
          generation,
        });
        if (!placed.placed) {
          const eviction = sim.core.ringBuffer.evict(buffer, object.sizeBytes);
          evicted = eviction.evicted;
          if (!eviction.failed) {
            placed = sim.core.ringBuffer.place(buffer, {
              ...object,
              generation,
            });
          }
          if ((!placed || !placed.placed) && options.compactionEnabled) {
            sim.core.ringBuffer.compact(buffer);
            placed = sim.core.ringBuffer.place(buffer, {
              ...object,
              generation,
            });
          }
        }
      }

      if (placed && placed.placed) {
        trace.push({
          ...baseRecord,
          tier: "SRAM",
          offset: placed.entry.offset,
          evictedObjectIds: evicted.map((entry) => entry.objectId),
        });
      } else {
        const tier = "HBM";
        const offset = hbmOffset;
        hbmOffset += object.sizeBytes;
        hbmAllocations.push({
          objectId: object.objectId,
          offset,
          sizeBytes: object.sizeBytes,
          regionType: object.regionType,
        });
        trace.push({
          ...baseRecord,
          tier,
          offset: offset < hbmCapacityBytes ? offset : null,
          deterministicReason: `${baseRecord.deterministicReason}; spilled to HBM`,
          evictedObjectIds: evicted.map((entry) => entry.objectId),
        });
      }
    });

    return {
      mode,
      sram: {
        entries: buffer.entries.slice().sort((a, b) => a.offset - b.offset || a.objectId.localeCompare(b.objectId)),
        replayTrace: buffer.replayTrace.slice(),
        metrics: sim.core.ringBuffer.metrics(buffer),
      },
      hbm: {
        entries: hbmAllocations,
        usedBytes: hbmAllocations.reduce((sum, entry) => sum + entry.sizeBytes, 0),
        capacityBytes: hbmCapacityBytes,
      },
      trace,
      replay: replayAllocations(trace),
    };
  }

  sim.core.deterministicAllocator = {
    allocate(objects, options) {
      return allocateObjects(objects, options);
    },
    free(trace, objectId) {
      return trace.filter((entry) => entry.objectId !== objectId);
    },
    evict(trace, objectId) {
      return trace.map((entry) => entry.objectId === objectId ? { ...entry, evictionStep: entry.allocationStep + 1000 } : entry);
    },
    compact(trace) {
      return trace.map((entry, index) => entry.tier === "SRAM" ? { ...entry, offset: index * 4096 } : entry);
    },
    replayAllocations,
    verifyDeterministicReplay,
  };
})();
