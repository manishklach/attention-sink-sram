(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});

  sim.state = {
    promotionGranularity: "per-head-layer",
    evictionPolicy: "sink-score-aware",
    partitionPolicy: "shared-prefix-reserved-pool",
    executionPolicy: "latency-optimized",
    workloadPreset: "multi-tenant-enterprise-serving",
    compressionMode: "quantized-hbm",
    compactionMode: "enabled",
    seed: 202641062302,
    promptLength: 20,
    decodeSteps: 16,
    decodeConcurrency: 4,
    tenantCount: 4,
    sharedPrefixLength: 5,
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    bytesPerElement: 2,
    promotedHeads: 3,
    promotedLayerStart: 16,
    promotedLayerEnd: 32,
    layerBoostMultiplier: 1.6,
    sinkThreshold: 0.56,
    evictionThreshold: 0.28,
    emaAlpha: 0.72,
    dwellSteps: 3,
    sramBudget: 8,
    sinkStrength: 0.74,
    hbmLatency: 18,
    sramLatency: 3,
    dmaBandwidth: 96,
    dmaSlots: 3,
    draftTokens: 2,
    draftAcceptRate: 0.68,
    executionWindowDuration: 8,
    pinningDuration: 5,
    sharedPoolPercent: 24,
    topologyType: "mesh",
    fabricType: "nvlink-like",
    distributedPlacementPolicy: "topology-aware",
    deviceCount: 6,
    pooledMemoryNodes: 1,
    topologyWidth: 3,
    remoteLatencyMultiplier: 1.4,
    pooledSpillPercent: 18,
    fabricBandwidth: 220,
    fabricLinkLatency: 7,
    multicastFanout: 3,
    energyMode: "balanced",
    costMode: "throughput-optimized",
    traceReplaySpeed: 1,
    timelineSpeed: 1,
    directorySort: "score",
    directoryFilter: "all",
  };

  sim.rangeIds = [
    "promptLength",
    "decodeSteps",
    "decodeConcurrency",
    "tenantCount",
    "sharedPrefixLength",
    "layers",
    "kvHeads",
    "headDim",
    "promotedHeads",
    "promotedLayerStart",
    "promotedLayerEnd",
    "layerBoostMultiplier",
    "sinkThreshold",
    "evictionThreshold",
    "emaAlpha",
    "dwellSteps",
    "sramBudget",
    "sinkStrength",
    "hbmLatency",
    "sramLatency",
    "dmaBandwidth",
    "dmaSlots",
    "draftTokens",
    "draftAcceptRate",
    "executionWindowDuration",
    "pinningDuration",
    "sharedPoolPercent",
    "deviceCount",
    "pooledMemoryNodes",
    "topologyWidth",
    "remoteLatencyMultiplier",
    "pooledSpillPercent",
    "fabricBandwidth",
    "fabricLinkLatency",
    "multicastFanout",
    "seed",
  ];

  sim.selectIds = [
    "promotionGranularity",
    "evictionPolicy",
    "partitionPolicy",
    "executionPolicy",
    "workloadPreset",
    "compressionMode",
    "compactionMode",
    "topologyType",
    "fabricType",
    "distributedPlacementPolicy",
    "energyMode",
    "costMode",
    "bytesPerElement",
    "timelineSpeed",
    "traceReplaySpeed",
    "directorySort",
    "directoryFilter",
  ];

  sim.profileSequence = [
    "sink-heavy",
    "retrieval-biased",
    "local",
    "recency-biased",
    "diffuse",
  ];

  sim.profileConfig = {
    "sink-heavy": {
      defaultEligible: true,
      baseContribution: 1.0,
      description: "Persistent attention sinks and anchors.",
    },
    "retrieval-biased": {
      defaultEligible: true,
      baseContribution: 0.82,
      description: "Good candidates for global-context reuse.",
    },
    local: {
      defaultEligible: false,
      baseContribution: 0.54,
      description: "Focused on nearby context and usually not worth pinning.",
    },
    "recency-biased": {
      defaultEligible: false,
      baseContribution: 0.61,
      description: "Favors recent tokens more than sink-heavy anchors.",
    },
    diffuse: {
      defaultEligible: false,
      baseContribution: 0.36,
      description: "Broad access pattern with weaker promotion ROI.",
    },
  };

  sim.memory = {
    timelineCursor: 0,
    playbackTimer: null,
    headEligibilityOverrides: [],
    sessionOverrides: {},
    lastRun: null,
    telemetryHistory: [],
    stressEvents: {},
  };

  sim.deviceProfiles = {
    GPU: { sram: 4, hbm: 96, dma: 3, bandwidth: 280, latency: 4, compute: 1.0 },
    accelerator: { sram: 6, hbm: 72, dma: 4, bandwidth: 240, latency: 5, compute: 0.92 },
    "CPU-attached SRAM": { sram: 10, hbm: 24, dma: 2, bandwidth: 140, latency: 8, compute: 0.42 },
    "pooled memory node": { sram: 2, hbm: 160, dma: 3, bandwidth: 180, latency: 12, compute: 0.18 },
    "SmartNIC/DPU": { sram: 3, hbm: 16, dma: 4, bandwidth: 210, latency: 6, compute: 0.24 },
    "storage offload node": { sram: 1, hbm: 32, dma: 2, bandwidth: 90, latency: 22, compute: 0.08 },
  };

  sim.utils = {
    formatNumber(value, decimals = 0) {
      return Number(value).toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      });
    },
    bytesToHuman(bytes) {
      if (bytes >= 1024 * 1024) {
        return `${sim.utils.formatNumber(bytes / (1024 * 1024), 2)} MB`;
      }
      if (bytes >= 1024) {
        return `${sim.utils.formatNumber(bytes / 1024, 1)} KB`;
      }
      return `${sim.utils.formatNumber(bytes, 0)} B`;
    },
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    average(values) {
      if (!values.length) {
        return 0;
      }
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    },
    cloneState() {
      return JSON.parse(JSON.stringify(sim.state));
    },
  };

  sim.ensureLayerRange = function ensureLayerRange() {
    const state = sim.state;
    if (state.promotedLayerStart > state.promotedLayerEnd) {
      const temp = state.promotedLayerStart;
      state.promotedLayerStart = state.promotedLayerEnd;
      state.promotedLayerEnd = temp;
    }
    if (state.promotedLayerEnd >= state.layers) {
      state.promotedLayerEnd = state.layers - 1;
    }
    if (state.promotedLayerStart >= state.layers) {
      state.promotedLayerStart = Math.max(0, state.layers - 1);
    }
    if (state.sharedPrefixLength > state.promptLength) {
      state.sharedPrefixLength = state.promptLength;
    }
    if (state.promotedHeads > state.kvHeads) {
      state.promotedHeads = state.kvHeads;
    }
  };

  sim.ensureHeadEligibility = function ensureHeadEligibility() {
    if (sim.memory.headEligibilityOverrides.length !== sim.state.kvHeads) {
      sim.memory.headEligibilityOverrides = Array.from({ length: sim.state.kvHeads }, (_, index) => {
        const profile = sim.profileSequence[index % sim.profileSequence.length];
        return sim.profileConfig[profile].defaultEligible;
      });
    }
  };

  sim.computeLayerBuckets = function computeLayerBuckets(layers) {
    const bucketCount = Math.min(8, Math.max(4, Math.ceil(layers / 16)));
    const bucketSize = Math.ceil(layers / bucketCount);
    return Array.from({ length: bucketCount }, (_, index) => {
      const start = index * bucketSize;
      const end = Math.min(layers - 1, start + bucketSize - 1);
      return {
        id: index,
        start,
        end,
        label: `${start}-${end}`,
      };
    });
  };

  sim.getSelectedLayerCount = function getSelectedLayerCount(policy) {
    return Math.max(0, policy.promotedLayerEnd - policy.promotedLayerStart + 1);
  };

  sim.computeKvBytes = function computeKvBytes(model) {
    return 2 * model.layers * model.kvHeads * model.headDim * model.bytesPerElement;
  };

  sim.computePromotionBytes = function computePromotionBytes(model, policy, promotedHeadCount, granularity) {
    const mode = granularity || policy.promotionGranularity;
    if (mode === "whole-token") {
      return sim.computeKvBytes(model);
    }
    if (mode === "per-head") {
      return 2 * model.layers * promotedHeadCount * model.headDim * model.bytesPerElement;
    }
    const selectedLayerCount = sim.getSelectedLayerCount(policy);
    return 2 * selectedLayerCount * promotedHeadCount * model.headDim * model.bytesPerElement;
  };

  sim.generateHeadProfiles = function generateHeadProfiles() {
    const layerBuckets = sim.computeLayerBuckets(sim.state.layers);
    return Array.from({ length: sim.state.kvHeads }, (_, index) => {
      const profile = sim.profileSequence[index % sim.profileSequence.length];
      const config = sim.profileConfig[profile];
      const layerIntensities = layerBuckets.map((bucket) => {
        const layerWeight =
          bucket.end < sim.state.promotedLayerStart || bucket.start > sim.state.promotedLayerEnd
            ? 1
            : sim.state.layerBoostMultiplier;
        const normalizedIndex = (index + 1) / sim.state.kvHeads;
        const intensity =
          config.baseContribution *
          layerWeight *
          (1 + (bucket.id % 3) * 0.12) *
          (profile === "local" ? 0.92 : 1) *
          (profile === "diffuse" ? 0.74 : 1) *
          (profile === "sink-heavy" ? 1.08 : 1) *
          (profile === "retrieval-biased" ? 1.03 : 1) *
          (1 + normalizedIndex * 0.04);
        return {
          bucketId: bucket.id,
          layerWeight,
          intensity,
        };
      });

      return {
        id: index,
        label: `Head ${index}`,
        profile,
        defaultEligible: config.defaultEligible,
        eligible: sim.memory.headEligibilityOverrides[index],
        sinkScoreContribution: config.baseContribution * (1 + (index % 4) * 0.07),
        layerIntensities,
        promoted: false,
        description: config.description,
      };
    });
  };

  sim.determinePromotedHeads = function determinePromotedHeads(headProfiles) {
    const eligible = headProfiles.filter((head) => head.eligible);
    const selected = eligible
      .slice()
      .sort((a, b) => b.sinkScoreContribution - a.sinkScoreContribution)
      .slice(0, Math.min(sim.state.promotedHeads, eligible.length));
    const selectedIds = new Set(selected.map((head) => head.id));
    headProfiles.forEach((head) => {
      head.promoted = selectedIds.has(head.id);
    });
    return selected;
  };

  sim.getSessionId = function getSessionId(index) {
    return `S${index + 1}`;
  };

  sim.generateSessions = function generateSessions() {
    const seedOffset = sim.state.seed % 11;
    const sessions = Array.from({ length: sim.state.tenantCount }, (_, index) => {
      const sessionId = sim.getSessionId(index);
      const override = sim.memory.sessionOverrides[sessionId] || {};
      const attachedSharedPrefix = override.attachedSharedPrefix !== undefined ? override.attachedSharedPrefix : true;
      const ragAttached = override.ragAttached !== undefined ? override.ragAttached : index % 2 === 0;
      return {
        sessionId,
        promptLength: sim.state.promptLength,
        sharedPrefixLength: sim.state.sharedPrefixLength,
        attachedSharedPrefix,
        ragAttached,
        longPrefixLength: sim.state.sharedPrefixLength + 2 + (index % 3),
        priority: 1 + ((index + seedOffset) % 3),
        decodeRate: 1 + ((index + 1 + seedOffset) % Math.max(2, sim.state.decodeConcurrency)),
        sinkDensity: 0.5 + ((index + seedOffset) % 4) * 0.1,
      };
    });
    return sessions;
  };

  sim.computeSessionSinkEntries = function computeSessionSinkEntries(session, headProfiles, promotedHeads) {
    const promotedHeadIds = promotedHeads.map((head) => head.id);
    const headRange = promotedHeadIds.length ? promotedHeadIds.join(",") : "none";
    const perTokenBytes = sim.computePromotionBytes(
      {
        layers: sim.state.layers,
        kvHeads: sim.state.kvHeads,
        headDim: sim.state.headDim,
        bytesPerElement: sim.state.bytesPerElement,
      },
      sim.state,
      Math.max(1, promotedHeads.length)
    );
    const sinkTokenCount = Math.min(sim.state.promptLength, Math.max(4, Math.ceil(sim.state.sharedPrefixLength + 3)));
    const entries = [];

    if (session.attachedSharedPrefix) {
      entries.push({
        entryId: `SHARED-PREFIX`,
        sessionId: "shared",
        tokenRange: `0-${sim.state.sharedPrefixLength - 1}`,
        headRange,
        layerRange: `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`,
        sinkScore: 1.14,
        age: 0,
        refcount: 0,
        tier: "SRAM",
        shared: true,
        pinned: sim.state.evictionPolicy === "pinned-shared-prefix",
        stale: false,
        evicting: false,
        bytes: perTokenBytes * sim.state.sharedPrefixLength,
        kind: "shared-prefix",
      });
    }

    for (let token = sim.state.sharedPrefixLength; token < sinkTokenCount; token += 1) {
      const baseScore =
        sim.state.sinkStrength *
        (1 - (token - sim.state.sharedPrefixLength) * 0.08) *
        (1 + (session.sessionId.charCodeAt(1) % 3) * 0.05);
      entries.push({
        entryId: `${session.sessionId}-TOK-${token}`,
        sessionId: session.sessionId,
        tokenRange: `${token}-${token}`,
        headRange,
        layerRange: `${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd}`,
        sinkScore: baseScore,
        age: token - sim.state.sharedPrefixLength,
        refcount: 1,
        tier: "HBM",
        shared: false,
        pinned: false,
        stale: token > sinkTokenCount - 2,
        evicting: false,
        bytes: perTokenBytes,
        kind: token === sim.state.sharedPrefixLength ? "sink-anchor" : "sink-tail",
      });
    }

    return entries;
  };
})();
