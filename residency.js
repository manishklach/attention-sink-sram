(function () {
  const sim = window.AttentionSinkSim;

  sim.residency = {
    buildDirectory(sessions, headProfiles, promotedHeads) {
      const runtimePolicy = sim.memory.policyRuntime || {};
      const effectiveThreshold = runtimePolicy.promotionThreshold || sim.state.sinkThreshold;
      const effectiveBudget = Math.max(1, sim.state.sramBudget - (sim.memory.stressEvents["sram-exhaustion"] || 0) * 2);
      const allEntries = [];
      const sharedUsers = sessions.filter((session) => session.attachedSharedPrefix).length;

      sessions.forEach((session) => {
        const sessionEntries = sim.computeSessionSinkEntries(session, headProfiles, promotedHeads);
        sessionEntries.forEach((entry) => {
          if (entry.shared) {
            entry.refcount = sharedUsers;
            entry.pinned = sim.state.evictionPolicy === "pinned-shared-prefix";
          }
          allEntries.push(entry);
        });
      });

      const deduped = [];
      const seen = new Map();
      allEntries.forEach((entry) => {
        if (entry.shared) {
          if (!seen.has(entry.entryId)) {
            seen.set(entry.entryId, entry);
            deduped.push(entry);
          }
        } else {
          deduped.push(entry);
        }
      });

      deduped.forEach((entry, index) => {
        if (entry.shared || entry.sinkScore >= effectiveThreshold || index < effectiveBudget) {
          entry.tier = "SRAM";
        }
      });

      const evictIds = new Set(sim.eviction.chooseEvictions(deduped, effectiveBudget, sim.state.evictionPolicy));
      deduped.forEach((entry) => {
        if (evictIds.has(entry.entryId)) {
          entry.evicting = true;
          entry.tier = "HBM";
        }
      });

      const summary = {
        sharedUsers,
        sharedEntries: deduped.filter((entry) => entry.shared).length,
        pinnedEntries: deduped.filter((entry) => entry.pinned).length,
        staleEntries: deduped.filter((entry) => entry.stale).length,
      };

      return {
        entries: deduped,
        summary,
      };
    },

    getFilteredEntries(directory, sortBy, filterBy) {
      const entries = directory.entries.filter((entry) => {
        if (filterBy === "shared") {
          return entry.shared;
        }
        if (filterBy === "evicting") {
          return entry.evicting;
        }
        if (filterBy === "pinned") {
          return entry.pinned;
        }
        if (filterBy === "stale") {
          return entry.stale;
        }
        return true;
      });

      return entries.sort((a, b) => {
        if (sortBy === "age") {
          return b.age - a.age;
        }
        if (sortBy === "refcount") {
          return b.refcount - a.refcount;
        }
        if (sortBy === "session") {
          return a.sessionId.localeCompare(b.sessionId);
        }
        return b.sinkScore - a.sinkScore;
      });
    },

    computeSharedPrefixMetrics(directory) {
      const sharedEntry = directory.entries.find((entry) => entry.shared);
      if (!sharedEntry) {
        return {
          bytesSaved: 0,
          duplicatePromotionsAvoided: 0,
          avoidedHbmReads: 0,
          refcount: 0,
        };
      }
      const duplicatePromotionsAvoided = Math.max(0, directory.summary.sharedUsers - 1);
      return {
        bytesSaved: sharedEntry.bytes * duplicatePromotionsAvoided,
        duplicatePromotionsAvoided,
        avoidedHbmReads: duplicatePromotionsAvoided * sim.state.decodeSteps * Math.max(1, sim.state.promotedHeads),
        refcount: sharedEntry.refcount,
      };
    },
  };
})();
