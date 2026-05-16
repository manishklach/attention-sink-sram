const state = {
  promotionGranularity: "whole-token",
  promptLength: 18,
  decodeSteps: 18,
  tenantCount: 4,
  sharedPrefixLength: 4,
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
  sramBudget: 5,
  sinkStrength: 0.74,
  hbmLatency: 18,
  sramLatency: 3,
};

let lastRun = null;
let headEligibilityOverrides = [];

const rangeIds = [
  "promptLength",
  "decodeSteps",
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
];

const selectIds = ["promotionGranularity", "bytesPerElement"];

const tokenKinds = ["BOS", "SYS", "INST", "ANCHOR"];
const profileSequence = [
  "sink-heavy",
  "retrieval-biased",
  "local",
  "recency-biased",
  "diffuse",
];

const profileConfig = {
  "sink-heavy": {
    defaultEligible: true,
    baseContribution: 1.0,
    description: "Persistent anchor and sink behavior across many decode steps.",
  },
  "retrieval-biased": {
    defaultEligible: true,
    baseContribution: 0.82,
    description: "Useful for globally reused context, but not as concentrated as sink-heavy heads.",
  },
  local: {
    defaultEligible: false,
    baseContribution: 0.52,
    description: "Reads nearby tokens; often better served by recency than SRAM pinning.",
  },
  "recency-biased": {
    defaultEligible: false,
    baseContribution: 0.6,
    description: "Favors the latest tokens and typically offers lower SRAM ROI than sink-heavy heads.",
  },
  diffuse: {
    defaultEligible: false,
    baseContribution: 0.34,
    description: "Spreads attention broadly and usually has the weakest slice-promotion case.",
  },
};

// Small formatting helpers keep the UI readable while the simulator recomputes frequently.
function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function bytesToHuman(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${formatNumber(bytes / (1024 * 1024), 2)} MB`;
  }
  if (bytes >= 1024) {
    return `${formatNumber(bytes / 1024, 1)} KB`;
  }
  return `${formatNumber(bytes, 0)} B`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRow(row) {
  const sum = row.reduce((acc, value) => acc + value, 0);
  if (sum === 0) {
    return row.map(() => 0);
  }
  return row.map((value) => value / sum);
}

function ensureLayerRange() {
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
}

function syncControlValues() {
  document.getElementById("promotedHeads").max = String(state.kvHeads);
  document.getElementById("promotedLayerStart").max = String(Math.max(0, state.layers - 1));
  document.getElementById("promotedLayerEnd").max = String(Math.max(0, state.layers - 1));
  document.getElementById("sharedPrefixLength").max = String(state.promptLength);

  rangeIds.forEach((id) => {
    const input = document.getElementById(id);
    const value = document.getElementById(`${id}Value`);
    input.value = state[id];
    value.textContent = state[id];
    if (id === "layerBoostMultiplier" || id === "sinkThreshold" || id === "evictionThreshold" || id === "emaAlpha") {
      value.textContent = Number(state[id]).toFixed(2).replace(/0$/, "").replace(/\.$/, "");
    }
  });

  selectIds.forEach((id) => {
    document.getElementById(id).value = state[id];
  });
}

function ensureHeadEligibility() {
  if (headEligibilityOverrides.length !== state.kvHeads) {
    headEligibilityOverrides = Array.from({ length: state.kvHeads }, (_, index) => {
      const profile = profileSequence[index % profileSequence.length];
      return profileConfig[profile].defaultEligible;
    });
  }
}

function bindControls() {
  rangeIds.forEach((id) => {
    const input = document.getElementById(id);
    const value = document.getElementById(`${id}Value`);
    input.addEventListener("input", () => {
      state[id] = Number(input.value);
      ensureLayerRange();
      ensureHeadEligibility();
      syncControlValues();
      run();
    });
  });

  selectIds.forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("change", () => {
      state[id] = id === "bytesPerElement" ? Number(input.value) : input.value;
      run();
    });
  });

  document.getElementById("rerun").addEventListener("click", run);
  document.getElementById("presetConservative").addEventListener("click", () => {
    applyPreset({
      promotionGranularity: "whole-token",
      promptLength: 18,
      decodeSteps: 16,
      tenantCount: 3,
      sharedPrefixLength: 4,
      layers: 80,
      kvHeads: 8,
      headDim: 128,
      bytesPerElement: 2,
      promotedHeads: 2,
      promotedLayerStart: 20,
      promotedLayerEnd: 28,
      layerBoostMultiplier: 1.3,
      sinkThreshold: 0.64,
      evictionThreshold: 0.34,
      emaAlpha: 0.78,
      dwellSteps: 4,
      sramBudget: 3,
      sinkStrength: 0.62,
      hbmLatency: 18,
      sramLatency: 3,
    });
  });

  document.getElementById("presetAggressive").addEventListener("click", () => {
    applyPreset({
      promotionGranularity: "per-head-layer",
      promptLength: 24,
      decodeSteps: 24,
      tenantCount: 8,
      sharedPrefixLength: 5,
      layers: 80,
      kvHeads: 8,
      headDim: 128,
      bytesPerElement: 2,
      promotedHeads: 3,
      promotedLayerStart: 16,
      promotedLayerEnd: 32,
      layerBoostMultiplier: 1.8,
      sinkThreshold: 0.48,
      evictionThreshold: 0.22,
      emaAlpha: 0.66,
      dwellSteps: 2,
      sramBudget: 8,
      sinkStrength: 0.84,
      hbmLatency: 20,
      sramLatency: 2,
    });
  });

  document.getElementById("exportJson").addEventListener("click", exportTrace);
}

function applyPreset(next) {
  Object.assign(state, next);
  ensureLayerRange();
  headEligibilityOverrides = [];
  ensureHeadEligibility();
  syncControlValues();
  run();
}

function generateTokens(promptLength, sharedPrefixLength) {
  return Array.from({ length: promptLength }, (_, index) => {
    if (index < tokenKinds.length) {
      return {
        id: index,
        label: tokenKinds[index],
        kind: "anchor",
        shared: index < sharedPrefixLength,
      };
    }
    return {
      id: index,
      label: `T${index}`,
      kind: "normal",
      shared: index < sharedPrefixLength,
    };
  });
}

function generateTenantWeights(tokens, tenantCount, sharedPrefixLength) {
  return Array.from({ length: tenantCount }, (_, tenantIndex) => {
    const focus = sharedPrefixLength + ((tenantIndex * 3) % Math.max(tokens.length - sharedPrefixLength, 1));
    return tokens.map((token, tokenIndex) => {
      if (tokenIndex < sharedPrefixLength) {
        return 1.2;
      }
      const distance = Math.abs(tokenIndex - focus);
      return clamp(0.88 - distance * 0.08, 0.18, 0.9);
    });
  });
}

function computeLayerBuckets(layers, bucketCount = 8) {
  const bucketSize = Math.max(1, Math.ceil(layers / bucketCount));
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = index * bucketSize;
    const end = Math.min(layers - 1, start + bucketSize - 1);
    return {
      id: index,
      start,
      end,
      label: `${start}-${end}`,
    };
  }).filter((bucket) => bucket.start < layers);
}

function layerOverlapCount(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start + 1);
}

function computeLayerWeight(bucket, selectedStart, selectedEnd, boostMultiplier, granularity) {
  const overlap = layerOverlapCount(bucket.start, bucket.end, selectedStart, selectedEnd);
  if (granularity === "per-head-layer") {
    return overlap > 0 ? boostMultiplier : 0;
  }
  return overlap > 0 ? boostMultiplier : 1;
}

function computeHeadProfiles(tokens, layerBuckets, tenantWeights) {
  ensureHeadEligibility();

  const sharedPressure = tenantWeights.reduce(
    (acc, row) => acc + row.slice(0, state.sharedPrefixLength).reduce((sum, value) => sum + value, 0),
    0,
  ) / Math.max(tenantWeights.length * Math.max(state.sharedPrefixLength, 1), 1);

  return Array.from({ length: state.kvHeads }, (_, index) => {
    const profile = profileSequence[index % profileSequence.length];
    const config = profileConfig[profile];
    const contributionSeed = config.baseContribution * (1 + (sharedPressure - 1) * 0.12);

    const layerIntensities = layerBuckets.map((bucket, bucketIndex) => {
      const normalizedStart = bucket.start / Math.max(state.layers - 1, 1);
      const normalizedMid = (bucket.start + bucket.end) / 2 / Math.max(state.layers - 1, 1);

      let profileBias = 0.4;
      if (profile === "sink-heavy") {
        profileBias = 0.82 + (1 - normalizedStart) * 0.24;
      } else if (profile === "retrieval-biased") {
        profileBias = 0.64 + Math.sin((bucketIndex + 1) / layerBuckets.length * Math.PI) * 0.2;
      } else if (profile === "local") {
        profileBias = 0.42 + (1 - normalizedMid) * 0.18;
      } else if (profile === "recency-biased") {
        profileBias = 0.46 + normalizedMid * 0.2;
      } else if (profile === "diffuse") {
        profileBias = 0.34 + ((bucketIndex % 2) * 0.04);
      }

      const layerWeight = computeLayerWeight(
        bucket,
        state.promotedLayerStart,
        state.promotedLayerEnd,
        state.layerBoostMultiplier,
        state.promotionGranularity,
      );

      return {
        bucketId: bucket.id,
        intensity: contributionSeed * profileBias * (layerWeight || 1),
        bucket,
        layerWeight,
      };
    });

    const contribution =
      layerIntensities.reduce((acc, item) => acc + item.intensity, 0) /
      Math.max(layerIntensities.length, 1);

    return {
      id: index,
      label: `H${index}`,
      profile,
      description: config.description,
      sinkScoreContribution: contribution,
      eligible: headEligibilityOverrides[index],
      defaultEligible: config.defaultEligible,
      layerIntensities,
      promoted: false,
    };
  });
}

// This is a deterministic stand-in for learned attention behavior, not a real kernel execution path.
function baseWeightForToken(index, promptLength, sinkStrength, profile, step) {
  const recentWindow = index >= promptLength - 4 ? 0.2 : 0;
  const wave = (((step + 1) * (index + 5)) % 9) / 140;

  if (profile === "sink-heavy") {
    if (index === 0) return sinkStrength + 0.18 + wave;
    if (index === 1) return sinkStrength + 0.12 + wave;
    if (index === 2) return sinkStrength + 0.08 + wave;
    if (index === 3) return sinkStrength + 0.02 + wave;
    return clamp(0.14 + wave - index / (promptLength * 5), 0.05, 0.4);
  }

  if (profile === "retrieval-biased") {
    const anchorLift = index < 6 ? 0.08 : 0;
    return clamp(0.24 + anchorLift + wave - index / (promptLength * 6), 0.06, 0.44);
  }

  if (profile === "local") {
    const distance = (promptLength - 1 - index) / Math.max(promptLength - 1, 1);
    return clamp(0.16 + recentWindow + distance * 0.18 + wave, 0.04, 0.5);
  }

  if (profile === "recency-biased") {
    const distance = (promptLength - 1 - index) / Math.max(promptLength - 1, 1);
    return clamp(0.12 + recentWindow * 1.35 + distance * 0.1 + wave, 0.03, 0.55);
  }

  const distancePenalty = index / Math.max(promptLength - 1, 1);
  return clamp(0.2 - distancePenalty * 0.08 + recentWindow * 0.18 + wave, 0.05, 0.34);
}

function generateAttentionByHead(tokens, headProfiles, decodeSteps) {
  return Array.from({ length: decodeSteps }, (_, step) =>
    headProfiles.map((head) => {
      const row = tokens.map((token, index) =>
        baseWeightForToken(index, tokens.length, state.sinkStrength, head.profile, step) *
        (0.88 + head.sinkScoreContribution * 0.18),
      );
      return normalizeRow(row);
    }),
  );
}

function aggregateAttention(attentionByHead, headProfiles, tenantWeights) {
  return attentionByHead.map((stepRows) => {
    const tokenCount = stepRows[0]?.length ?? 0;
    const totals = Array.from({ length: tokenCount }, () => 0);

    tenantWeights.forEach((tenantRow) => {
      stepRows.forEach((row, headIndex) => {
        row.forEach((value, tokenIndex) => {
          totals[tokenIndex] += value * headProfiles[headIndex].sinkScoreContribution * tenantRow[tokenIndex];
        });
      });
    });

    return normalizeRow(totals);
  });
}

function simulateDynamicController(tokens, aggregateRows) {
  const slotMap = new Map();
  const emaScores = Array.from({ length: tokens.length }, () => 0);
  const coldCounters = Array.from({ length: tokens.length }, () => 0);
  const promotions = Array.from({ length: tokens.length }, () => 0);
  const evictions = Array.from({ length: tokens.length }, () => 0);
  const trace = [];

  aggregateRows.forEach((normalized, stepIndex) => {
    normalized.forEach((value, tokenIndex) => {
      emaScores[tokenIndex] =
        state.emaAlpha * emaScores[tokenIndex] + (1 - state.emaAlpha) * value;
    });

    const promoteCandidates = tokens
      .map((token, index) => ({ tokenId: token.id, score: emaScores[index] }))
      .filter((item) => item.score >= state.sinkThreshold)
      .sort((a, b) => b.score - a.score);

    const events = [];

    promoteCandidates.forEach((candidate) => {
      if (slotMap.has(candidate.tokenId)) {
        coldCounters[candidate.tokenId] = 0;
        return;
      }

      if (slotMap.size < state.sramBudget) {
        slotMap.set(candidate.tokenId, { promotedAt: stepIndex });
        promotions[candidate.tokenId] += 1;
        coldCounters[candidate.tokenId] = 0;
        events.push({ type: "promote", tokenId: candidate.tokenId });
        return;
      }

      const weakestResident = [...slotMap.keys()]
        .map((tokenId) => ({ tokenId, score: emaScores[tokenId] }))
        .sort((a, b) => a.score - b.score)[0];

      if (weakestResident && candidate.score > weakestResident.score + 0.02) {
        slotMap.delete(weakestResident.tokenId);
        evictions[weakestResident.tokenId] += 1;
        events.push({ type: "evict", tokenId: weakestResident.tokenId });
        slotMap.set(candidate.tokenId, { promotedAt: stepIndex });
        promotions[candidate.tokenId] += 1;
        coldCounters[candidate.tokenId] = 0;
        events.push({ type: "promote", tokenId: candidate.tokenId });
      }
    });

    [...slotMap.keys()].forEach((tokenId) => {
      if (emaScores[tokenId] < state.evictionThreshold) {
        coldCounters[tokenId] += 1;
      } else {
        coldCounters[tokenId] = 0;
      }

      if (coldCounters[tokenId] >= state.dwellSteps) {
        slotMap.delete(tokenId);
        evictions[tokenId] += 1;
        coldCounters[tokenId] = 0;
        events.push({ type: "evict", tokenId });
      }
    });

    const activeReads = normalized
      .map((value, index) => ({ index, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.min(6, normalized.length));

    let promotedReadHits = 0;
    let sharedHits = 0;
    activeReads.forEach(({ index }) => {
      if (slotMap.has(index)) {
        promotedReadHits += 1;
        if (tokens[index].shared) {
          sharedHits += 1;
        }
      }
    });

    trace.push({
      step: stepIndex + 1,
      residentTokenIds: [...slotMap.keys()],
      promotedReadHits,
      activeReadCount: activeReads.length,
      sharedHits,
      events,
    });
  });

  return {
    assignments: tokens.map((token, index) => ({
      ...token,
      sinkScore: emaScores[index],
      tier: trace[trace.length - 1]?.residentTokenIds.includes(token.id) ? "SRAM" : "HBM",
      promotions: promotions[index],
      evictions: evictions[index],
    })),
    trace,
    readsAvoidedWholeToken: trace.reduce((acc, step) => acc + step.promotedReadHits, 0),
    finalResidents: trace[trace.length - 1]?.residentTokenIds ?? [],
  };
}

// Full-token KV size is the baseline used for footprint-reduction and capacity-increase comparisons.
function computeKvBytes(model) {
  return 2 * model.layers * model.kvHeads * model.headDim * model.bytesPerElement;
}

function getSelectedLayerCount(policy) {
  return Math.max(0, policy.promotedLayerEnd - policy.promotedLayerStart + 1);
}

function computePromotionBytes(model, policy, activePromotedHeads, granularity = policy.promotionGranularity) {
  const selectedLayerCount = getSelectedLayerCount(policy);

  if (granularity === "whole-token") {
    return 2 * model.layers * model.kvHeads * model.headDim * model.bytesPerElement;
  }

  if (granularity === "per-head") {
    return 2 * model.layers * activePromotedHeads * model.headDim * model.bytesPerElement;
  }

  return 2 * selectedLayerCount * activePromotedHeads * model.headDim * model.bytesPerElement;
}

function determinePromotedHeads(headProfiles, policy) {
  const eligible = headProfiles
    .filter((head) => head.eligible)
    .sort((a, b) => b.sinkScoreContribution - a.sinkScoreContribution);

  const selected = eligible.slice(0, Math.min(policy.promotedHeads, eligible.length));
  const promotedIds = new Set(selected.map((head) => head.id));

  headProfiles.forEach((head) => {
    head.promoted = promotedIds.has(head.id);
  });

  return selected;
}

function computeCoverageRatio(granularity, model, promotedHeadCount, selectedLayerCount) {
  if (granularity === "whole-token") {
    return 1;
  }

  const headFraction = promotedHeadCount / Math.max(model.kvHeads, 1);
  if (granularity === "per-head") {
    return headFraction;
  }

  const layerFraction = selectedLayerCount / Math.max(model.layers, 1);
  return headFraction * layerFraction;
}

function computeLatencyCost(totalReads, readsAvoided, coverageRatio, hbmLatency, sramLatency) {
  return totalReads * hbmLatency - readsAvoided * coverageRatio * (hbmLatency - sramLatency);
}

// The benchmark panel compares policy families using the same deterministic workload and latency assumptions.
function computeBenchmarkComparison(context) {
  const {
    model,
    policy,
    dynamic,
    staticAssignments,
    promotedHeads,
  } = context;

  const fullTokenBytes = computeKvBytes(model);
  const selectedLayerCount = getSelectedLayerCount(policy);
  const promotedHeadCount = promotedHeads.length;
  const totalReads = dynamic.trace.reduce((acc, step) => acc + step.activeReadCount, 0);
  const baselineCost = totalReads * policy.hbmLatency;
  const staticPromotedTokens = staticAssignments.length;
  const dynamicPromotedTokens = dynamic.finalResidents.length;
  const budgetBytes = policy.sramBudget * fullTokenBytes;

  const rows = [
    {
      name: "HBM only",
      granularity: "none",
      promotedTokens: 0,
      promotedHeads: 0,
      promotedLayers: 0,
      sramBytesUsed: 0,
      sramBudgetPercent: 0,
      hbmReadsAvoided: 0,
      latencyCost: baselineCost,
      relativeSpeedup: 1,
      notes: "Baseline with no SRAM placement.",
    },
    {
      name: "Static whole-token SRAM",
      granularity: "whole-token",
      promotedTokens: staticPromotedTokens,
      promotedHeads: model.kvHeads,
      promotedLayers: model.layers,
      sramBytesUsed: staticPromotedTokens * fullTokenBytes,
      sramBudgetPercent: budgetBytes ? (staticPromotedTokens * fullTokenBytes) / budgetBytes * 100 : 0,
      hbmReadsAvoided: dynamic.readsAvoidedWholeToken,
      latencyCost: computeLatencyCost(
        totalReads,
        dynamic.readsAvoidedWholeToken,
        1,
        policy.hbmLatency,
        policy.sramLatency,
      ),
      relativeSpeedup: 1,
      notes: "Reference policy that promotes full-token KV for hot tokens.",
    },
    {
      name: "Dynamic whole-token SRAM",
      granularity: "whole-token",
      promotedTokens: dynamicPromotedTokens,
      promotedHeads: model.kvHeads,
      promotedLayers: model.layers,
      sramBytesUsed: dynamicPromotedTokens * fullTokenBytes,
      sramBudgetPercent: budgetBytes ? (dynamicPromotedTokens * fullTokenBytes) / budgetBytes * 100 : 0,
      hbmReadsAvoided: dynamic.readsAvoidedWholeToken,
      latencyCost: computeLatencyCost(
        totalReads,
        dynamic.readsAvoidedWholeToken,
        1,
        policy.hbmLatency,
        policy.sramLatency,
      ),
      relativeSpeedup: 1,
      notes: "Dynamic promotion and eviction, but all heads/layers per token.",
    },
    {
      name: "Dynamic per-head SRAM",
      granularity: "per-head",
      promotedTokens: dynamicPromotedTokens,
      promotedHeads: promotedHeadCount,
      promotedLayers: model.layers,
      sramBytesUsed:
        dynamicPromotedTokens *
        computePromotionBytes(model, policy, promotedHeadCount, "per-head"),
      sramBudgetPercent: budgetBytes
        ? (dynamicPromotedTokens *
            computePromotionBytes(model, policy, promotedHeadCount, "per-head")) /
          budgetBytes *
          100
        : 0,
      hbmReadsAvoided:
        dynamic.readsAvoidedWholeToken *
        computeCoverageRatio("per-head", model, promotedHeadCount, selectedLayerCount),
      latencyCost: computeLatencyCost(
        totalReads,
        dynamic.readsAvoidedWholeToken,
        computeCoverageRatio("per-head", model, promotedHeadCount, selectedLayerCount),
        policy.hbmLatency,
        policy.sramLatency,
      ),
      relativeSpeedup: 1,
      notes: "Only promoted head slices occupy SRAM; same hot-token controller.",
    },
    {
      name: "Dynamic per-head + layer-range SRAM",
      granularity: "per-head-layer",
      promotedTokens: dynamicPromotedTokens,
      promotedHeads: promotedHeadCount,
      promotedLayers: selectedLayerCount,
      sramBytesUsed:
        dynamicPromotedTokens *
        computePromotionBytes(model, policy, promotedHeadCount, "per-head-layer"),
      sramBudgetPercent: budgetBytes
        ? (dynamicPromotedTokens *
            computePromotionBytes(model, policy, promotedHeadCount, "per-head-layer")) /
          budgetBytes *
          100
        : 0,
      hbmReadsAvoided:
        dynamic.readsAvoidedWholeToken *
        computeCoverageRatio("per-head-layer", model, promotedHeadCount, selectedLayerCount),
      latencyCost: computeLatencyCost(
        totalReads,
        dynamic.readsAvoidedWholeToken,
        computeCoverageRatio("per-head-layer", model, promotedHeadCount, selectedLayerCount),
        policy.hbmLatency,
        policy.sramLatency,
      ),
      relativeSpeedup: 1,
      notes: "Most selective mode: promoted head slices only inside the chosen layer range.",
    },
  ];

  rows.forEach((row) => {
    row.relativeSpeedup = row.latencyCost > 0 ? baselineCost / row.latencyCost : 1;
  });

  return rows;
}

function renderHeadProfiles(headProfiles) {
  const container = document.getElementById("headProfiles");
  container.innerHTML = "";

  headProfiles.forEach((head) => {
    const card = document.createElement("div");
    card.className = `headCard${head.eligible ? "" : " is-disabled"}`;
    card.dataset.headId = head.id;
    card.innerHTML = `
      <div class="headCardHeader">
        <strong>${head.label}</strong>
        <span class="badge ${head.profile}">${head.profile}</span>
      </div>
      <p class="subtle">${head.description}</p>
      <div class="headMeta">
        <span>Contribution: <strong>${head.sinkScoreContribution.toFixed(3)}</strong></span>
        <span>Eligible: <strong>${head.eligible ? "yes" : "no"}</strong></span>
        <span>Status: <strong>${head.promoted ? "promoted" : "not promoted"}</strong></span>
        <span>Default: <strong>${head.defaultEligible ? "eligible" : "off"}</strong></span>
      </div>
    `;
    card.addEventListener("click", () => toggleHeadEligibility(head.id));
    container.appendChild(card);
  });
}

function renderHeadHeatmap(headProfiles, layerBuckets, granularity) {
  const container = document.getElementById("headHeatmap");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "heatmapHeader";
  header.style.gridTemplateColumns = `90px repeat(${headProfiles.length}, minmax(0, 1fr))`;
  header.innerHTML = `<div class="heatmapHeaderLabel">Layer bucket</div>`;

  headProfiles.forEach((head) => {
    const cell = document.createElement("div");
    cell.className = `heatHead${head.eligible ? " active" : ""}`;
    cell.textContent = head.label;
    cell.title = `Toggle eligibility for ${head.label}`;
    cell.addEventListener("click", () => toggleHeadEligibility(head.id));
    header.appendChild(cell);
  });
  container.appendChild(header);

  layerBuckets.forEach((bucket) => {
    const row = document.createElement("div");
    row.className = "heatmapRow";
    row.style.gridTemplateColumns = `90px repeat(${headProfiles.length}, minmax(0, 1fr))`;

    const label = document.createElement("div");
    label.className = "heatmapRowLabel";
    label.textContent = bucket.label;
    row.appendChild(label);

    headProfiles.forEach((head) => {
      const intensityItem = head.layerIntensities.find((item) => item.bucketId === bucket.id);
      const value = intensityItem ? intensityItem.intensity : 0;
      const classes = ["heatCell"];
      if (head.promoted && head.eligible && (granularity !== "per-head-layer" || intensityItem.layerWeight > 0)) {
        classes.push("promoted");
      } else if (value >= 1.05) {
        classes.push("high");
      } else if (value >= 0.65) {
        classes.push("medium");
      } else {
        classes.push("low");
      }

      const cell = document.createElement("div");
      cell.className = classes.join(" ");
      cell.textContent = value.toFixed(2);
      cell.title = `${head.label}, layers ${bucket.label}, intensity ${value.toFixed(3)}`;
      cell.addEventListener("click", () => toggleHeadEligibility(head.id));
      row.appendChild(cell);
    });

    container.appendChild(row);
  });

  renderLegend();
}

function renderLegend() {
  const container = document.getElementById("heatmapLegend");
  container.innerHTML = `
    <span class="legendItem low">Low</span>
    <span class="legendItem medium">Medium</span>
    <span class="legendItem high">High</span>
    <span class="legendItem promoted">Promoted</span>
  `;
}

function renderBenchmarkTable(rows, activeGranularity) {
  const container = document.getElementById("benchmarkTable");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "benchmarkHeader";
  header.innerHTML = `
    <span>Mode</span>
    <span>Promoted tokens</span>
    <span>Promoted heads</span>
    <span>Promoted layers</span>
    <span>SRAM bytes used</span>
    <span>SRAM budget %</span>
    <span>HBM reads avoided</span>
    <span>Latency cost</span>
    <span>Speedup</span>
    <span>Notes</span>
  `;
  container.appendChild(header);

  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = `benchmarkRow${row.granularity === activeGranularity ? " highlight" : ""}`;
    div.innerHTML = `
      <span><strong>${row.name}</strong></span>
      <span>${formatNumber(row.promotedTokens, 0)}</span>
      <span>${formatNumber(row.promotedHeads, 0)}</span>
      <span>${formatNumber(row.promotedLayers, 0)}</span>
      <span>${bytesToHuman(row.sramBytesUsed)}</span>
      <span>${formatNumber(row.sramBudgetPercent, 1)}%</span>
      <span>${formatNumber(row.hbmReadsAvoided, 1)}</span>
      <span>${formatNumber(row.latencyCost, 1)}</span>
      <span>${formatNumber(row.relativeSpeedup, 2)}x</span>
      <span>${row.notes}</span>
    `;
    container.appendChild(div);
  });
}

function renderEfficiencyCard(model, policy, promotedHeads, promotedTokens) {
  const wholeTokenBytes = computeKvBytes(model);
  const currentBytes = computePromotionBytes(model, policy, promotedHeads.length);
  const reduction = wholeTokenBytes > 0 ? (1 - currentBytes / wholeTokenBytes) * 100 : 0;
  const capacityIncrease = currentBytes > 0 ? wholeTokenBytes / currentBytes : 1;

  document.getElementById("wholeTokenBytes").textContent = `${bytesToHuman(wholeTokenBytes)} / token`;
  document.getElementById("currentModeBytes").textContent = `${bytesToHuman(currentBytes)} / token`;
  document.getElementById("footprintReduction").textContent = `${formatNumber(reduction, 1)}%`;
  document.getElementById("capacityIncrease").textContent = `${formatNumber(capacityIncrease, 2)}x`;

  document.getElementById("efficiencyNote").textContent =
    policy.promotionGranularity === "whole-token"
      ? "Whole-token mode keeps correctness simple but uses the most SRAM per promoted token."
      : policy.promotionGranularity === "per-head"
        ? `Promoting ${promotedHeads.length} of ${model.kvHeads} KV heads reduces per-token SRAM footprint while preserving selected hot slices.`
        : `Promoting ${promotedHeads.length} of ${model.kvHeads} KV heads only across layers ${policy.promotedLayerStart}-${policy.promotedLayerEnd} compresses SRAM use further.`;
}

function renderTokenTable(tokens) {
  const container = document.getElementById("tokenTable");
  container.innerHTML = "";
  const sorted = [...tokens].sort((a, b) => b.sinkScore - a.sinkScore);

  sorted.forEach((token) => {
    const row = document.createElement("div");
    row.className = "tokenRow";
    row.innerHTML = `
      <div class="tokenName">${token.label}</div>
      <div class="scoreBarWrap"><div class="scoreBar" style="width:${(token.sinkScore * 100).toFixed(1)}%"></div></div>
      <div>${token.sinkScore.toFixed(3)}</div>
      <div>${token.promotions}</div>
      <div>${token.evictions}</div>
      <div><span class="tierBadge ${token.tier.toLowerCase()}">${token.tier}</span></div>
      <div>${token.shared ? "shared" : token.kind}</div>
    `;
    container.appendChild(row);
  });
}

function renderPolicySummary(data) {
  const container = document.getElementById("policySummary");
  const activeRow = data.benchmarkComparison.find((row) => row.granularity === state.promotionGranularity);
  const selectedLayerCount = getSelectedLayerCount(state);

  container.innerHTML = `
    <div class="summaryRow"><span>Promotion granularity</span><strong>${document.getElementById("promotionGranularity").selectedOptions[0].textContent}</strong></div>
    <div class="summaryRow"><span>Selected promoted heads</span><strong>${data.promotedHeads.map((head) => head.label).join(", ") || "none"}</strong></div>
    <div class="summaryRow"><span>Selected layer range</span><strong>${state.promotedLayerStart}-${state.promotedLayerEnd} (${selectedLayerCount} layers)</strong></div>
    <div class="summaryRow"><span>SRAM bytes used (active mode)</span><strong>${bytesToHuman(activeRow.sramBytesUsed)}</strong></div>
    <div class="summaryRow"><span>SRAM budget utilization</span><strong>${formatNumber(activeRow.sramBudgetPercent, 1)}%</strong></div>
    <div class="summaryRow"><span>Deterministic disclaimer</span><strong>Architecture simulator</strong></div>
  `;
}

function toggleHeadEligibility(headId) {
  ensureHeadEligibility();
  headEligibilityOverrides[headId] = !headEligibilityOverrides[headId];
  run();
}

function exportTrace() {
  if (!lastRun) {
    return;
  }

  const payload = {
    model: {
      layers: state.layers,
      kvHeads: state.kvHeads,
      headDim: state.headDim,
      bytesPerElement: state.bytesPerElement,
    },
    promotionPolicy: {
      granularity: state.promotionGranularity,
      promotedHeads: state.promotedHeads,
      promotedLayerStart: state.promotedLayerStart,
      promotedLayerEnd: state.promotedLayerEnd,
      layerBoostMultiplier: state.layerBoostMultiplier,
      threshold: state.sinkThreshold,
      evictionThreshold: state.evictionThreshold,
      emaAlpha: state.emaAlpha,
      dwellSteps: state.dwellSteps,
    },
    headProfiles: lastRun.headProfiles.map((head) => ({
      id: head.id,
      profile: head.profile,
      sinkScoreContribution: head.sinkScoreContribution,
      eligible: head.eligible,
      promoted: head.promoted,
    })),
    promotedEntries: lastRun.dynamic.assignments
      .filter((token) => token.tier === "SRAM")
      .map((token) => ({
        tokenId: token.id,
        tokenLabel: token.label,
        sinkScore: token.sinkScore,
        promotionCount: token.promotions,
        evictionCount: token.evictions,
      })),
    benchmarkComparison: lastRun.benchmarkComparison,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attention-sink-sram-benchmark-trace.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyStaticWholeTokenAssignments(tokens, dynamicAssignments) {
  return dynamicAssignments
    .filter((token) => token.sinkScore >= state.sinkThreshold)
    .sort((a, b) => b.sinkScore - a.sinkScore)
    .slice(0, state.sramBudget);
}

function run() {
  ensureLayerRange();
  ensureHeadEligibility();
  syncControlValues();

  const model = {
    layers: state.layers,
    kvHeads: state.kvHeads,
    headDim: state.headDim,
    bytesPerElement: state.bytesPerElement,
  };

  const tokens = generateTokens(state.promptLength, state.sharedPrefixLength);
  const layerBuckets = computeLayerBuckets(state.layers);
  const tenantWeights = generateTenantWeights(tokens, state.tenantCount, state.sharedPrefixLength);
  const headProfiles = computeHeadProfiles(tokens, layerBuckets, tenantWeights);
  const promotedHeads = determinePromotedHeads(headProfiles, state);
  const attentionByHead = generateAttentionByHead(tokens, headProfiles, state.decodeSteps);
  const aggregateRows = aggregateAttention(attentionByHead, headProfiles, tenantWeights);
  const dynamic = simulateDynamicController(tokens, aggregateRows);
  const staticAssignments = applyStaticWholeTokenAssignments(tokens, dynamic.assignments);
  const benchmarkComparison = computeBenchmarkComparison({
    model,
    policy: state,
    dynamic,
    staticAssignments,
    promotedHeads,
  });

  renderHeadProfiles(headProfiles);
  renderHeadHeatmap(headProfiles, layerBuckets, state.promotionGranularity);
  renderBenchmarkTable(benchmarkComparison, state.promotionGranularity);
  renderEfficiencyCard(model, state, promotedHeads, dynamic.finalResidents.length);
  renderTokenTable(dynamic.assignments);
  renderPolicySummary({ benchmarkComparison, promotedHeads, dynamic });

  const activeRow = benchmarkComparison.find((row) => row.granularity === state.promotionGranularity);
  document.getElementById("modeLabel").textContent =
    document.getElementById("promotionGranularity").selectedOptions[0].textContent;
  document.getElementById("promotedTokenCount").textContent = formatNumber(activeRow.promotedTokens, 0);
  document.getElementById("selectedHeadCount").textContent = formatNumber(activeRow.promotedHeads, 0);
  document.getElementById("selectedLayerCount").textContent = formatNumber(activeRow.promotedLayers, 0);
  document.getElementById("readsAvoided").textContent = formatNumber(activeRow.hbmReadsAvoided, 1);
  document.getElementById("relativeSpeedup").textContent = `${formatNumber(activeRow.relativeSpeedup, 2)}x`;

  lastRun = {
    model,
    headProfiles,
    dynamic,
    benchmarkComparison,
    promotedHeads,
  };
}

bindControls();
ensureHeadEligibility();
syncControlValues();
run();
