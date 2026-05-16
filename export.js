(function () {
  const sim = window.AttentionSinkSim;

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  sim.exporter = {
    exportSnapshot() {
      if (!sim.memory.lastRun) {
        return;
      }
      const snapshot = {
        currentConfig: { ...sim.state },
        benchmarkComparison: sim.memory.lastRun.benchmarkComparison,
        residencyTable: sim.memory.lastRun.directory.entries,
        eventTrace: sim.memory.lastRun.timeline,
        dmaTrace: sim.memory.lastRun.dma.descriptors,
        routingTable: sim.memory.lastRun.routing.rows,
        screenshotsMetadata: [
          { panel: "architecture", suggestedName: "architecture-overview.png" },
          { panel: "timeline", suggestedName: "execution-timeline.png" },
          { panel: "benchmark", suggestedName: "benchmark-comparison.png" },
        ],
      };

      const timelineJson = JSON.stringify(sim.memory.lastRun.timeline, null, 2);
      const dmaJson = JSON.stringify(sim.memory.lastRun.dma.descriptors, null, 2);
      const residencyJson = JSON.stringify(sim.memory.lastRun.directory.entries, null, 2);
      const snapshotJson = JSON.stringify(snapshot, null, 2);
      const csvRows = [
        ["mode", "promotedTokens", "promotedHeads", "promotedLayers", "sramBytesUsed", "sramBudgetPercent", "hbmReadsAvoided", "latencyCost", "relativeSpeedup"],
        ...sim.memory.lastRun.benchmarkComparison.map((row) => [
          row.name,
          row.promotedTokens,
          row.promotedHeads,
          row.promotedLayers,
          row.sramBytesUsed,
          row.sramBudgetPercent,
          row.hbmReadsAvoided,
          row.latencyCost,
          row.relativeSpeedup,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      downloadText("research-snapshot.json", snapshotJson, "application/json");
      downloadText("timeline-trace.json", timelineJson, "application/json");
      downloadText("dma-trace.json", dmaJson, "application/json");
      downloadText("residency-snapshot.json", residencyJson, "application/json");
      downloadText("benchmark-comparison.csv", csvRows, "text/csv");
      downloadText("architecture-view.svg", document.getElementById("architectureSvg").outerHTML, "image/svg+xml");
    },
  };
})();
