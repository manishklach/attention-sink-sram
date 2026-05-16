(function () {
  const sim = window.AttentionSinkSim;

  sim.lifetimes = {
    build(snapshot) {
      const rows = snapshot.directory.entries.slice(0, 14).map((entry, index) => ({
        entryId: entry.entryId,
        createdAt: index,
        activeUntil: index + sim.state.executionWindowDuration,
        replaySafeUntil: index + sim.state.pinningDuration,
        reclaimEligibleAt: index + sim.state.dwellSteps + 2,
        speculativeInvalidation: entry.stale,
        migrationEligible: !entry.pinned,
      }));
      return {
        rows,
        reclaimHazards: rows.filter((row) => row.speculativeInvalidation).length,
        replaySafeRows: rows.filter((row) => row.replaySafeUntil >= row.activeUntil - 2).length,
      };
    },
  };
})();
