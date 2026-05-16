(function () {
  const sim = window.AttentionSinkSim;

  const policies = {
    "latency-optimized": {
      thresholdBias: -0.06,
      dmaConcurrencyBias: 1,
      guaranteeBias: 0.16,
      promotionBias: 1.1,
      speculativeBias: 1.0,
      fairnessBias: 0.8,
      description: "Favors aggressive hot-path promotion and stronger residency guarantees.",
    },
    "bandwidth-optimized": {
      thresholdBias: 0.02,
      dmaConcurrencyBias: 0,
      guaranteeBias: 0.08,
      promotionBias: 0.94,
      speculativeBias: 0.86,
      fairnessBias: 0.92,
      description: "Reduces promotion traffic and favors compressed or colder tiers when possible.",
    },
    "sram-conservative": {
      thresholdBias: 0.08,
      dmaConcurrencyBias: -1,
      guaranteeBias: -0.06,
      promotionBias: 0.78,
      speculativeBias: 0.8,
      fairnessBias: 1.0,
      description: "Protects SRAM budget and accepts more HBM or compressed-tier routing.",
    },
    "aggressive-promotion": {
      thresholdBias: -0.1,
      dmaConcurrencyBias: 2,
      guaranteeBias: 0.1,
      promotionBias: 1.22,
      speculativeBias: 1.06,
      fairnessBias: 0.74,
      description: "Promotes early and often, trading bandwidth and churn for hit rate.",
    },
    "speculative-heavy": {
      thresholdBias: -0.02,
      dmaConcurrencyBias: 1,
      guaranteeBias: 0.02,
      promotionBias: 1.0,
      speculativeBias: 1.24,
      fairnessBias: 0.82,
      description: "Allocates more room to draft-path activity and rollback tolerance.",
    },
    "tenant-fairness-optimized": {
      thresholdBias: 0.02,
      dmaConcurrencyBias: 0,
      guaranteeBias: 0.04,
      promotionBias: 0.92,
      speculativeBias: 0.9,
      fairnessBias: 1.22,
      description: "Balances residency so no single tenant dominates the fast tier.",
    },
  };

  sim.policies = {
    definitions: policies,

    getActivePolicy() {
      return policies[sim.state.executionPolicy] || policies["latency-optimized"];
    },

    applyPolicyToState(baseState) {
      const profile = this.getActivePolicy();
      return {
        promotionThreshold: sim.utils.clamp(baseState.sinkThreshold + profile.thresholdBias, 0.18, 0.95),
        dmaSlots: Math.max(1, baseState.dmaSlots + profile.dmaConcurrencyBias),
        guaranteeWeight: profile.guaranteeBias,
        promotionWeight: profile.promotionBias,
        speculativeWeight: profile.speculativeBias,
        fairnessWeight: profile.fairnessBias,
        description: profile.description,
      };
    },
  };
})();
