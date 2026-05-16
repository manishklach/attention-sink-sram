(function () {
  const sim = window.AttentionSinkSim;

  sim.eviction = {
    scoreEntry(entry, policy) {
      if (policy === "lru") {
        return entry.age;
      }
      if (policy === "sink-score-aware") {
        return (1 - entry.sinkScore) * 100 + entry.age;
      }
      if (policy === "ema-based") {
        return (1 - entry.sinkScore * sim.state.emaAlpha) * 100 + entry.age * 0.5;
      }
      if (policy === "refcount-protected") {
        return entry.refcount > 1 ? 1000 + entry.age : (1 - entry.sinkScore) * 80 + entry.age;
      }
      if (policy === "pinned-shared-prefix") {
        if (entry.shared || entry.pinned) {
          return 2000 + entry.age;
        }
        return (1 - entry.sinkScore) * 80 + entry.age;
      }
      return entry.age;
    },

    chooseEvictions(entries, capacity, policy) {
      const promotable = entries.filter((entry) => entry.tier === "SRAM");
      if (promotable.length <= capacity) {
        return [];
      }

      return promotable
        .slice()
        .sort((a, b) => this.scoreEntry(a, policy) - this.scoreEntry(b, policy))
        .slice(0, promotable.length - capacity)
        .map((entry) => entry.entryId);
    },

    computeComparison(entries, baseMetrics) {
      const policies = [
        "lru",
        "sink-score-aware",
        "ema-based",
        "refcount-protected",
        "pinned-shared-prefix",
      ];

      return policies.map((policy, index) => {
        const protectedWeight =
          policy === "pinned-shared-prefix"
            ? 1.18
            : policy === "refcount-protected"
              ? 1.12
              : policy === "ema-based"
                ? 1.08
                : policy === "sink-score-aware"
                  ? 1.04
                  : 1;
        const churn = Math.max(1, Math.round(baseMetrics.promotions * (1.32 - protectedWeight)));
        const thrashRate = Math.max(2, (baseMetrics.misses * (1.22 - protectedWeight)) / Math.max(1, entries.length));
        const latency = baseMetrics.latency * (policy === "lru" ? 1.1 : policy === "sink-score-aware" ? 0.98 : policy === "ema-based" ? 0.96 : policy === "refcount-protected" ? 0.93 : 0.91);
        const dmaTraffic = baseMetrics.dmaBytes * (policy === "lru" ? 1.16 : policy === "sink-score-aware" ? 1.02 : policy === "ema-based" ? 0.97 : policy === "refcount-protected" ? 0.94 : 0.88);
        const stability = Math.max(0.1, protectedWeight - churn * 0.015);

        return {
          name: policy,
          churn,
          thrashRate,
          latency,
          dmaTraffic,
          stability,
          notes:
            policy === "pinned-shared-prefix"
              ? "Shared anchors stay pinned while other entries churn."
              : policy === "refcount-protected"
                ? "Shared residency is protected by reference count."
                : policy === "ema-based"
                  ? "Prefers stable entries with sustained reuse."
                  : policy === "sink-score-aware"
                    ? "Balances reuse score against churn."
                    : "Evicts by age only, highest oscillation risk.",
        };
      });
    },
  };
})();
