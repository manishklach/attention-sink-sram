(function () {
  const sim = window.AttentionSinkSim;

  sim.abi = {
    build(snapshot) {
      const handles = snapshot.directory.entries.slice(0, Math.min(18, snapshot.directory.entries.length)).map((entry, index) => ({
        handleId: `KVH-${index + 1}`,
        objectType: entry.shared ? "shared-prefix-kv" : entry.kind === "sink-anchor" ? "sink-anchor-kv" : "kv-slice",
        residencyTier: entry.tier,
        residencyContract: entry.pinned ? "pinned-window" : entry.shared ? "shared-refcounted" : entry.stale ? "reclaimable" : "adaptive",
        virtualAddress: `0x${(0x1000 + index * 0x200).toString(16)}`,
        physicalPlacement: entry.sessionId === "shared" ? "cluster-shared-pool" : `${entry.sessionId}:${entry.layerRange}`,
        schedulingFlags: [
          entry.shared ? "shared" : "private",
          entry.pinned ? "barrier-protected" : "migratable",
          entry.tier === "SRAM" ? "fast-tier" : "bulk-tier",
        ].join(" | "),
        replayFlags: entry.pinned ? "checkpointed" : entry.stale ? "invalidate-on-replay" : "replay-safe",
      }));

      const commands = [
        { op: "PROMOTE", barrier: "decode-window", sync: "dma-fence", count: snapshot.dma.descriptors.length },
        { op: "ATTACH_PREFIX", barrier: "tenant-join", sync: "refcount-inc", count: snapshot.sharedMetrics.refcount },
        { op: "CAPTURE_GRAPH", barrier: "graph-window", sync: "launch-barrier", count: snapshot.launch ? snapshot.launch.graphReuse : 0 },
        { op: "REPLAY_CHECKPOINT", barrier: "replay-safe", sync: "checkpoint-fence", count: snapshot.compilerPlan ? snapshot.compilerPlan.checkpoints.length : 0 },
      ];

      return {
        mode: sim.state.runtimeAbiMode,
        handles,
        commands,
      };
    },
  };
})();
