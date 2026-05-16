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
        experimentDatabase: sim.persistence.load(),
        policies: {
          executionPolicy: sim.state.executionPolicy,
          partitionPolicy: sim.state.partitionPolicy,
          evictionPolicy: sim.state.evictionPolicy,
          compressionMode: sim.state.compressionMode,
          workloadPreset: sim.state.workloadPreset,
        },
        workloadSuiteCatalog: sim.workloads.suites,
        benchmarkComparison: run.benchmarkComparison,
        latestSweep: sim.experiments.lastSweep,
        latestPolicyComparison: sim.experiments.lastComparison,
        residencyTable: run.directory.entries,
        eventTrace: run.timeline,
        orchestrationState: run.orchestrator,
        dmaTrace: run.dma.descriptors,
        routingTable: run.routing.rows,
        distributedRouting: run.distributedRouting,
        abi: run.abi,
        paging: run.paging,
        compilerPlan: run.compilerPlan,
        launch: run.launch,
        lifetimes: run.lifetimes,
        integration: run.integration,
        attentionGeneratorConfig: run.algorithmDemo.config,
        attentionTensorSummary: run.algorithmDemo.attentionSummary,
        sinkScores: run.algorithmDemo.sinkScores,
        rankedSinkTokens: run.algorithmDemo.sinkScores.rankedTokens,
        promotionDecision: run.algorithmDemo.promotionDecision,
        mergeVerificationResult: run.algorithmDemo.mergeVerification,
        topology: run.topology,
        fabric: run.fabric,
        pooling: run.pooling,
        scheduler: run.scheduler,
        migration: run.migration,
        energy: run.energy,
        economics: run.economics,
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
      const topologyJson = JSON.stringify(run.topology, null, 2);
      const fabricJson = JSON.stringify(run.fabric, null, 2);
      const migrationJson = JSON.stringify(run.migration, null, 2);
      const energyJson = JSON.stringify(run.energy, null, 2);
      const economicsJson = JSON.stringify(run.economics, null, 2);
      const benchmarkJson = JSON.stringify(run.benchmarkComparison, null, 2);
      const abiJson = JSON.stringify(run.abi, null, 2);
      const pagingJson = JSON.stringify(run.paging, null, 2);
      const compilerJson = JSON.stringify(run.compilerPlan, null, 2);
      const launchJson = JSON.stringify(run.launch, null, 2);
      const lifetimesJson = JSON.stringify(run.lifetimes, null, 2);
      const integrationJson = JSON.stringify(run.integration, null, 2);
      const algorithmJson = JSON.stringify({
        attentionGeneratorConfig: run.algorithmDemo.config,
        attentionTensorSummary: run.algorithmDemo.attentionSummary,
        sinkScores: run.algorithmDemo.sinkScores,
        rankedSinkTokens: run.algorithmDemo.sinkScores.rankedTokens,
        promotionDecision: run.algorithmDemo.promotionDecision,
        mergeVerificationResult: run.algorithmDemo.mergeVerification,
      }, null, 2);
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
      downloadText("topology-snapshot.json", topologyJson, "application/json");
      downloadText("fabric-congestion-trace.json", fabricJson, "application/json");
      downloadText("migration-trace.json", migrationJson, "application/json");
      downloadText("energy-report.json", energyJson, "application/json");
      downloadText("cost-performance-report.json", economicsJson, "application/json");
      downloadText("runtime-abi.json", abiJson, "application/json");
      downloadText("virtual-kv-map.json", pagingJson, "application/json");
      downloadText("compiler-plan.json", compilerJson, "application/json");
      downloadText("launch-orchestration.json", launchJson, "application/json");
      downloadText("lifetime-analysis.json", lifetimesJson, "application/json");
      downloadText("runtime-integration.json", integrationJson, "application/json");
      downloadText("core-algorithms.json", algorithmJson, "application/json");
      downloadText("routing-statistics.csv", csvRows, "text/csv");
      downloadText("telemetry-dump.json", telemetryJson, "application/json");
      downloadText("benchmark-report.json", benchmarkJson, "application/json");
      downloadText("architecture-view.svg", document.getElementById("architectureSvg").outerHTML, "image/svg+xml");
      downloadText("microarchitecture-view.svg", document.getElementById("microarchitectureSvg").outerHTML, "image/svg+xml");
      downloadText("compiler-plan.svg", document.getElementById("compilerPlanSvg").outerHTML, "image/svg+xml");
      downloadText("topology-view.svg", document.getElementById("topologySvg").outerHTML, "image/svg+xml");
      downloadText("execution-model.svg", document.getElementById("executionModelSvg").outerHTML, "image/svg+xml");
      downloadText("memory-lifecycle.svg", document.getElementById("lifecycleSvg").outerHTML, "image/svg+xml");
    },
  };
})();
