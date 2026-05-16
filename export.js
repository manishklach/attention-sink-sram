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
      const run = sim.memory.lastRun;
      const snapshot = {
        currentConfig: { ...sim.state },
        policies: {
          executionPolicy: sim.state.executionPolicy,
          partitionPolicy: sim.state.partitionPolicy,
          evictionPolicy: sim.state.evictionPolicy,
          compressionMode: sim.state.compressionMode,
          workloadPreset: sim.state.workloadPreset,
        },
        benchmarkComparison: run.benchmarkComparison,
        residencyTable: run.directory.entries,
        eventTrace: run.timeline,
        orchestrationState: run.orchestrator,
        dmaTrace: run.dma.descriptors,
        routingTable: run.routing.rows,
        fragmentation: run.fragmentation,
        tierState: run.tierState,
        telemetry: run.telemetry,
        screenshotsMetadata: [
          { panel: "architecture", suggestedName: "architecture-overview.png" },
          { panel: "microarchitecture", suggestedName: "microarchitecture-overview.png" },
          { panel: "timeline", suggestedName: "execution-timeline.png" },
          { panel: "telemetry", suggestedName: "telemetry-dashboard.png" },
          { panel: "benchmark", suggestedName: "benchmark-comparison.png" },
        ],
      };

      const timelineJson = JSON.stringify(run.timeline, null, 2);
      const dmaJson = JSON.stringify(run.dma.descriptors, null, 2);
      const residencyJson = JSON.stringify(run.directory.entries, null, 2);
      const telemetryJson = JSON.stringify(run.telemetry, null, 2);
      const fragmentationJson = JSON.stringify(run.fragmentation, null, 2);
      const benchmarkJson = JSON.stringify(run.benchmarkComparison, null, 2);
      const snapshotJson = JSON.stringify(snapshot, null, 2);
      const csvRows = [
        ["sessionId", "step", "decision", "sramHits", "hbmFallback", "latency"],
        ...run.routing.rows.map((row) => [
          row.sessionId,
          row.step,
          row.routingDecision,
          row.sramHits,
          row.fallbackHbmReads,
          row.estimatedLatency,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      downloadText("research-artifact.json", snapshotJson, "application/json");
      downloadText("orchestration-trace.json", timelineJson, "application/json");
      downloadText("dma-trace.json", dmaJson, "application/json");
      downloadText("tier-residency-snapshot.json", residencyJson, "application/json");
      downloadText("fragmentation-map.json", fragmentationJson, "application/json");
      downloadText("routing-statistics.csv", csvRows, "text/csv");
      downloadText("telemetry-dump.json", telemetryJson, "application/json");
      downloadText("benchmark-report.json", benchmarkJson, "application/json");
      downloadText("architecture-view.svg", document.getElementById("architectureSvg").outerHTML, "image/svg+xml");
      downloadText("microarchitecture-view.svg", document.getElementById("microarchitectureSvg").outerHTML, "image/svg+xml");
    },
  };
})();
