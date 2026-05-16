(function () {
  const sim = window.AttentionSinkSim;

  sim.launch = {
    build(snapshot) {
      const graphReuse = Math.max(1, Math.round(sim.state.decodeSteps / Math.max(1, sim.state.graphWindowSize)));
      const launches = Array.from({ length: Math.min(10, sim.state.decodeSteps) }, (_, index) => ({
        wave: index + 1,
        attentionKernel: `attn_${index + 1}`,
        decodeKernel: `decode_${index + 1}`,
        dmaOverlap: index % 2 === 0,
        barrier: index % 3 === 0 ? "graph-fence" : "stream-sync",
        bubbleCost: Math.max(0, sim.state.orchestrationBarrierCost - (index % 2)),
      }));
      const invalidations = launches.filter((launch) => launch.bubbleCost > 1).length + (sim.memory.stressEvents["prefix-invalidation"] || 0);
      return {
        mode: sim.state.graphExecutionMode,
        launches,
        graphReuse,
        graphInvalidations: invalidations,
        replayDivergence: Math.max(0, invalidations - 1),
        dynamicFallbacks: snapshot.speculative.rollbackCount > 0 ? Math.min(launches.length, snapshot.speculative.rollbackCount) : 0,
      };
    },
  };
})();
