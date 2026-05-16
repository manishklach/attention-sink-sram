(function () {
  const sim = window.AttentionSinkSim;

  sim.compiler = {
    build(snapshot) {
      const regions = [
        { id: "R1", name: "Prefill ingest", type: "prefill", start: 0, end: Math.max(2, sim.state.graphWindowSize - 2), residency: "HBM-heavy" },
        { id: "R2", name: "Sink promotion", type: "promotion", start: 2, end: 4 + sim.state.compilerFeedbackDepth, residency: "SRAM promotion window" },
        { id: "R3", name: "Decode graph", type: "decode", start: 5, end: 5 + sim.state.graphWindowSize, residency: "deterministic fast tier" },
        { id: "R4", name: "Replay-safe reclaim", type: "reclaim", start: 8, end: 8 + sim.state.compilerFeedbackDepth, residency: "adaptive reclaim" },
      ];

      const dmaSchedule = snapshot.dma.descriptors.slice(0, 8).map((descriptor, index) => ({
        id: descriptor.id,
        wave: 1 + Math.floor(index / 2),
        start: descriptor.startTime,
        end: descriptor.completionTime,
        mode: index % 3 === 0 ? "multicast" : "direct",
      }));

      const checkpoints = regions.map((region, index) => ({
        id: `CP-${index + 1}`,
        regionId: region.id,
        replaySafe: region.type !== "promotion",
        barrier: region.type === "decode" ? "launch-barrier" : "dma-fence",
      }));

      const planNodes = regions.map((region, index) => ({
        ...region,
        deps: index === 0 ? [] : [`R${index}`],
      }));

      return {
        mode: sim.state.compilerPlanningMode,
        regions,
        dmaSchedule,
        checkpoints,
        planNodes,
        executionIR: [
          "capture_prefill_region",
          "score_sink_candidates",
          "emit_promotion_wave",
          "capture_decode_graph",
          "materialize_replay_checkpoint",
          "release_reclaimable_pages",
        ],
      };
    },
  };
})();
