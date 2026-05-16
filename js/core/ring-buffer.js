(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.core = sim.core || {};

  function align(value, alignment = 256) {
    return Math.ceil(value / alignment) * alignment;
  }

  function create(capacityBytes) {
    return {
      capacityBytes,
      head: 0,
      tail: 0,
      wrapCount: 0,
      entries: [],
      replayTrace: [],
    };
  }

  function canPlaceAt(buffer, offset, sizeBytes) {
    const start = offset;
    const end = offset + sizeBytes;
    return buffer.entries.every((entry) => {
      const entryStart = entry.offset;
      const entryEnd = entry.offset + entry.sizeBytes;
      const overlap = !(end <= entryStart || start >= entryEnd);
      if (!overlap) {
        return true;
      }
      return false;
    });
  }

  function findPlacement(buffer, request) {
    const sizeBytes = align(request.sizeBytes);
    const tries = [buffer.head, 0];
    for (const candidate of tries) {
      if (candidate + sizeBytes <= buffer.capacityBytes && canPlaceAt(buffer, candidate, sizeBytes)) {
        return { offset: candidate, wrapped: candidate < buffer.head };
      }
    }
    return null;
  }

  function place(buffer, request) {
    const placement = findPlacement(buffer, request);
    if (!placement) {
      return {
        placed: false,
        reason: "no contiguous reclaimable region",
      };
    }
    const sizeBytes = align(request.sizeBytes);
    if (placement.wrapped) {
      buffer.wrapCount += 1;
    }
    const entry = {
      objectId: request.objectId,
      sessionId: request.sessionId,
      regionType: request.regionType,
      offset: placement.offset,
      sizeBytes,
      pinned: !!request.pinned,
      shared: !!request.shared,
      protected: !!request.protected,
      generation: request.generation,
      replayProtected: !!request.replayProtected,
      tier: "SRAM",
    };
    buffer.entries.push(entry);
    buffer.entries.sort((a, b) => a.offset - b.offset || a.objectId.localeCompare(b.objectId));
    buffer.head = placement.offset + sizeBytes;
    if (buffer.head >= buffer.capacityBytes) {
      buffer.head = 0;
      buffer.wrapCount += 1;
    }
    buffer.replayTrace.push({
      action: "allocate",
      objectId: entry.objectId,
      offset: entry.offset,
      sizeBytes: entry.sizeBytes,
      protected: entry.protected,
    });
    return { placed: true, entry };
  }

  function evictableEntries(buffer) {
    return buffer.entries
      .filter((entry) => !entry.pinned && !entry.protected && !entry.replayProtected)
      .sort((a, b) => a.generation - b.generation || a.offset - b.offset || a.objectId.localeCompare(b.objectId));
  }

  function evict(buffer, bytesNeeded) {
    let reclaimed = 0;
    const evicted = [];
    evictableEntries(buffer).forEach((entry) => {
      if (reclaimed >= bytesNeeded) {
        return;
      }
      reclaimed += entry.sizeBytes;
      evicted.push(entry);
    });
    buffer.entries = buffer.entries.filter((entry) => !evicted.includes(entry));
    evicted.forEach((entry) => {
      buffer.replayTrace.push({
        action: "evict",
        objectId: entry.objectId,
        offset: entry.offset,
        sizeBytes: entry.sizeBytes,
      });
    });
    return {
      evicted,
      reclaimed,
      failed: reclaimed < bytesNeeded,
    };
  }

  function compact(buffer) {
    let nextOffset = 0;
    let movedBytes = 0;
    buffer.entries.sort((a, b) => a.offset - b.offset || a.objectId.localeCompare(b.objectId));
    buffer.entries = buffer.entries.map((entry) => {
      const target = align(nextOffset);
      movedBytes += Math.abs(entry.offset - target);
      const next = { ...entry, offset: target };
      nextOffset = target + next.sizeBytes;
      return next;
    });
    buffer.head = nextOffset >= buffer.capacityBytes ? 0 : nextOffset;
    buffer.replayTrace.push({
      action: "compact",
      movedBytes,
      entries: buffer.entries.length,
    });
    return { movedBytes };
  }

  function metrics(buffer) {
    const usedBytes = buffer.entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const pinnedBytes = buffer.entries.filter((entry) => entry.pinned).reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const protectedBytes = buffer.entries.filter((entry) => entry.protected).reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const reclaimableBytes = buffer.entries.filter((entry) => !entry.pinned && !entry.protected && !entry.replayProtected).reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const fragmentedBytes = Math.max(0, buffer.capacityBytes - usedBytes - (buffer.capacityBytes - buffer.head));
    return {
      usedBytes,
      pinnedBytes,
      protectedBytes,
      reclaimableBytes,
      fragmentationPercent: (fragmentedBytes / Math.max(1, buffer.capacityBytes)) * 100,
      wrapCount: buffer.wrapCount,
      head: buffer.head,
      tail: buffer.tail,
    };
  }

  sim.core.ringBuffer = {
    create,
    place,
    evict,
    compact,
    metrics,
  };
})();
