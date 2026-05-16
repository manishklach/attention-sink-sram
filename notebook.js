(function () {
  const sim = window.AttentionSinkSim;

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  sim.notebook = {
    save(note) {
      if (!sim.memory.lastRun) {
        return;
      }
      const entry = {
        createdAt: new Date().toISOString(),
        note,
        config: sim.utils.cloneState(),
        metrics: sim.memory.lastRun.metricsSummary,
        workload: sim.memory.lastRun.workload,
      };
      sim.persistence.saveNote(entry);
      return entry;
    },

    exportMarkdown(note) {
      if (!sim.memory.lastRun) {
        return;
      }
      const run = sim.memory.lastRun;
      const markdown = `# Research Note\n\n## Observation\n${note}\n\n## Config\n\`\`\`json\n${JSON.stringify(sim.state, null, 2)}\n\`\`\`\n\n## Metrics\n- Execution stability: ${run.orchestrator.executionStability.toFixed(2)}%\n- Deterministic decode hit rate: ${run.orchestrator.deterministicDecodeHitRate.toFixed(2)}%\n- Effective bandwidth saved: ${run.metricsSummary.effectiveBandwidthSaved}\n- Tenant sharing efficiency: ${run.metricsSummary.tenantSharingEfficiency.toFixed(3)}\n`;
      download("research-note.md", markdown, "text/markdown");
    },

    exportHtml(note) {
      if (!sim.memory.lastRun) {
        return;
      }
      const run = sim.memory.lastRun;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Research Note</title></head><body><h1>Research Note</h1><h2>Observation</h2><p>${note}</p><h2>Config</h2><pre>${JSON.stringify(sim.state, null, 2)}</pre><h2>Metrics</h2><ul><li>Execution stability: ${run.orchestrator.executionStability.toFixed(2)}%</li><li>Deterministic decode hit rate: ${run.orchestrator.deterministicDecodeHitRate.toFixed(2)}%</li><li>Bandwidth saved: ${run.metricsSummary.effectiveBandwidthSaved}</li></ul></body></html>`;
      download("research-note.html", html, "text/html");
    },
  };
})();
