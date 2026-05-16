(function () {
  const sim = window.AttentionSinkSim;

  const workloads = {
    "chatbot-assistant": {
      promptLength: 18,
      decodeSteps: 14,
      tenantCount: 3,
      sharedPrefixLength: 4,
      sinkStrength: 0.66,
      draftAcceptRate: 0.76,
      notes: "Balanced prompt reuse with moderate decode pressure.",
    },
    "long-context-reasoning": {
      promptLength: 34,
      decodeSteps: 18,
      tenantCount: 2,
      sharedPrefixLength: 6,
      sinkStrength: 0.84,
      draftAcceptRate: 0.58,
      notes: "Heavy sink pressure and long retained attention context.",
    },
    "rag-heavy-retrieval": {
      promptLength: 28,
      decodeSteps: 16,
      tenantCount: 4,
      sharedPrefixLength: 7,
      sinkStrength: 0.72,
      draftAcceptRate: 0.62,
      notes: "Long retrieved prefixes and elevated retrieval-head activity.",
    },
    "code-generation": {
      promptLength: 24,
      decodeSteps: 22,
      tenantCount: 3,
      sharedPrefixLength: 5,
      sinkStrength: 0.75,
      draftAcceptRate: 0.7,
      notes: "Long decode windows and stable prefix reuse.",
    },
    "multi-agent-orchestration": {
      promptLength: 22,
      decodeSteps: 20,
      tenantCount: 6,
      sharedPrefixLength: 4,
      sinkStrength: 0.69,
      draftAcceptRate: 0.64,
      notes: "Several sessions compete for SRAM while sharing orchestration prompts.",
    },
    "speculative-decode-stress": {
      promptLength: 18,
      decodeSteps: 24,
      tenantCount: 3,
      sharedPrefixLength: 3,
      sinkStrength: 0.63,
      draftAcceptRate: 0.48,
      notes: "High draft rejection pressure and rollback traffic.",
    },
    "multi-tenant-enterprise-serving": {
      promptLength: 20,
      decodeSteps: 16,
      tenantCount: 5,
      sharedPrefixLength: 6,
      sinkStrength: 0.74,
      draftAcceptRate: 0.68,
      notes: "Shared system prompts and repeated enterprise policy prefixes.",
    },
  };

  const suites = {
    "long-context-serving": {
      workload: "long-context-reasoning",
      recommendedPolicy: "sink-stability-optimized",
      stressEvents: ["bandwidth-saturation"],
      description: "Illustrates long-prompt decode windows and sink-heavy retention pressure.",
    },
    "enterprise-multi-tenant": {
      workload: "multi-tenant-enterprise-serving",
      recommendedPolicy: "tenant-fairness-optimized",
      stressEvents: ["tenant-burst"],
      description: "Models many concurrent sessions sharing policy and system prefixes.",
    },
    "rag-heavy-inference": {
      workload: "rag-heavy-retrieval",
      recommendedPolicy: "bandwidth-optimized",
      stressEvents: ["prefix-invalidation"],
      description: "Highlights retrieval-biased heads, shared context segments, and fallback tiers.",
    },
    "agentic-orchestration": {
      workload: "multi-agent-orchestration",
      recommendedPolicy: "latency-optimized",
      stressEvents: ["dma-congestion", "tenant-burst"],
      description: "Shows many active control flows contending for deterministic decode windows.",
    },
    "high-speculative-decode": {
      workload: "speculative-decode-stress",
      recommendedPolicy: "speculative-heavy",
      stressEvents: ["speculative-collapse"],
      description: "Explores rollback pressure, wasted DMA movement, and reclaim behavior.",
    },
    "sram-constrained-edge-inference": {
      workload: "chatbot-assistant",
      recommendedPolicy: "sram-conservative",
      stressEvents: ["sram-exhaustion"],
      description: "Illustrates conservative placement when fast-tier capacity is sharply limited.",
    },
    "extreme-tenant-burst": {
      workload: "multi-agent-orchestration",
      recommendedPolicy: "tenant-fairness-optimized",
      stressEvents: ["tenant-burst", "eviction-storm"],
      description: "Stresses fairness, churn, and residency guarantees under sudden burst load.",
    },
    "prefix-sharing-hyperscale-serving": {
      workload: "multi-tenant-enterprise-serving",
      recommendedPolicy: "latency-optimized",
      stressEvents: ["dma-congestion"],
      description: "Demonstrates a shared-prefix-heavy serving environment with high reuse density.",
    },
  };

  sim.workloads = {
    definitions: workloads,
    suites,

    getActiveWorkload() {
      return workloads[sim.state.workloadPreset] || workloads["multi-tenant-enterprise-serving"];
    },

    applyPresetToState() {
      const workload = this.getActiveWorkload();
      sim.state.promptLength = workload.promptLength;
      sim.state.decodeSteps = workload.decodeSteps;
      sim.state.tenantCount = workload.tenantCount;
      sim.state.sharedPrefixLength = workload.sharedPrefixLength;
      sim.state.sinkStrength = workload.sinkStrength;
      sim.state.draftAcceptRate = workload.draftAcceptRate;
    },
  };
})();
