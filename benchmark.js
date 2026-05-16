(function () {
  const sim = window.AttentionSinkSim;

  sim.benchmark = {
    computeRuntimeBenchmark(context) {
      const model = context.model;
      const policy = context.policy;
      const promotedHeadCount = Math.max(1, context.promotedHeads.length);
      const totalPromotedEntries = context.directory.entries.filter((entry) => entry.tier === "SRAM").length;
      const selectedLayers = sim.getSelectedLayerCount(policy);
      const policyModes = [
        { name: "HBM only", mode: "none", heads: 0, layers: model.layers, notes: "No SRAM routing; all decode reads hit HBM." },
        { name: "Static whole-token SRAM", mode: "whole-token", heads: model.kvHeads, layers: model.layers, notes: "One-shot full-token promotion without runtime adaptation." },
        { name: "Dynamic whole-token SRAM", mode: "whole-token", heads: model.kvHeads, layers: model.layers, notes: "Dynamic promotion, but full token KV is still moved." },
        { name: "Dynamic per-head SRAM", mode: "per-head", heads: promotedHeadCount, layers: model.layers, notes: "Only selected heads are routed through SRAM." },
        { name: "Dynamic per-head + layer-range SRAM", mode: "per-head-layer", heads: promotedHeadCount, layers: selectedLayers, notes: "Selected heads within a boosted layer range consume SRAM." },
      ];

      return policyModes.map((row, index) => {
        const bytesPerEntry =
          row.mode === "none"
            ? 0
            : sim.computePromotionBytes(model, policy, Math.max(1, row.heads), row.mode);
        const promotedTokens = row.mode === "none" ? 0 : Math.max(1, totalPromotedEntries - (index > 2 ? 0 : 1));
        const coverage = row.mode === "per-head-layer" ? selectedLayers / Math.max(1, model.layers) : row.mode === "per-head" ? row.heads / Math.max(1, model.kvHeads) : row.mode === "whole-token" ? 1 : 0;
        const hbmReadsAvoided =
          row.mode === "none"
            ? 0
            : context.routing.totalReadsAvoided * (row.mode === "whole-token" ? 0.9 + index * 0.03 : row.mode === "per-head" ? 0.82 : 0.78) * Math.max(0.18, coverage);
        const latencyCost =
          row.mode === "none"
            ? context.routing.averageLatency * 1.12
            : context.routing.averageLatency * (row.mode === "whole-token" ? 0.88 : row.mode === "per-head" ? 0.79 : 0.74);
        const speedup = row.mode === "none" ? 1 : (context.routing.averageLatency * 1.12) / Math.max(1, latencyCost);
        const budgetPercent =
          row.mode === "none"
            ? 0
            : ((bytesPerEntry * promotedTokens) / Math.max(1, sim.computeKvBytes(model) * sim.state.sramBudget)) * 100;

        return {
          name: row.name,
          granularity: row.mode === "none" ? "hbm-only" : row.mode,
          promotedTokens,
          promotedHeads: row.heads,
          promotedLayers: row.layers,
          sramBytesUsed: bytesPerEntry * promotedTokens,
          sramBudgetPercent: Math.min(999, budgetPercent),
          hbmReadsAvoided,
          latencyCost,
          relativeSpeedup: speedup,
          notes: row.notes,
        };
      });
    },
  };
})();
