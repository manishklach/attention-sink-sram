(function () {
  const sim = window.AttentionSinkSim;

  sim.fragmentation = {
    build(directory, partitionState) {
      const storm = sim.memory.stressEvents["eviction-storm"] || 0;
      const totalBlocks = 40;
      const entries = directory.entries.filter((entry) => entry.tier === "SRAM");
      const blocks = Array.from({ length: totalBlocks }, (_, index) => ({
        index,
        status: "free",
        sessionId: "",
        size: 1,
      }));

      let cursor = 0;
      let failedPlacements = 0;
      entries.forEach((entry, index) => {
        const width = Math.max(1, Math.min(4, Math.ceil(entry.bytes / Math.max(1, partitionState.totalBudgetBytes / totalBlocks))));
        const gap = (index % 4 === 3 && sim.state.compactionMode === "disabled") ? 1 + storm : 0;
        cursor += gap;
        if (cursor + width > totalBlocks) {
          failedPlacements += 1;
          return;
        }
        for (let block = cursor; block < cursor + width; block += 1) {
          blocks[block].status = entry.shared ? "shared" : entry.pinned ? "pinned" : "allocated";
          blocks[block].sessionId = entry.sessionId;
        }
        cursor += width + ((index + 1) % 3 === 0 ? 1 : 0);
      });

      const freeBlocks = blocks.filter((block) => block.status === "free").length;
      const contiguousRuns = [];
      let run = 0;
      blocks.forEach((block) => {
        if (block.status === "free") {
          run += 1;
        } else if (run > 0) {
          contiguousRuns.push(run);
          run = 0;
        }
      });
      if (run > 0) {
        contiguousRuns.push(run);
      }

      const largestRun = contiguousRuns.length ? Math.max(...contiguousRuns) : 0;
      const fragmentationPercent = freeBlocks > 0 ? (1 - largestRun / freeBlocks) * 100 : 0;
      const compactionEnabled = sim.state.compactionMode === "enabled";
      const compactionEvents = compactionEnabled && fragmentationPercent > 28 ? Math.ceil(fragmentationPercent / 22) : 0;
      const relocationTraffic = compactionEvents * Math.max(1, entries.length) * 2048;

      return {
        blocks,
        freeBlocks,
        fragmentationPercent,
        compactionEvents,
        relocationTraffic,
        failedPlacements,
        compactionOverhead: compactionEvents * 2.6,
      };
    },
  };
})();
