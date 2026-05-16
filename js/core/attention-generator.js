(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.core = sim.core || {};

  const DEFAULT_CONFIG = {
    layers: 8,
    heads: 8,
    sequenceLength: 128,
    sinkTokenIds: [0, 1, 2, 3],
    sinkStrength: 0.35,
    localWindow: 16,
    retrievalSpikeProbability: 0.08,
    seed: 42,
  };

  const PROFILE_SEQUENCE = [
    "sink-heavy",
    "local",
    "recency-biased",
    "retrieval-biased",
    "diffuse",
  ];

  function createRng(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return function rng() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function normalizeRow(row, limit) {
    const normalized = row.map((value, index) => (index <= limit ? Math.max(0, value) : 0));
    const total = sum(normalized);
    if (!total) {
      normalized[limit] = 1;
      return normalized;
    }
    return normalized.map((value) => value / total);
  }

  function headProfileFor(head) {
    return PROFILE_SEQUENCE[head % PROFILE_SEQUENCE.length];
  }

  function baseRecencyWeight(query, key, localWindow) {
    const distance = query - key;
    const bounded = Math.max(0, 1 - distance / Math.max(1, localWindow));
    return 0.02 + bounded * bounded * 0.9;
  }

  function generateRow(profile, query, config, rng) {
    const row = Array.from({ length: config.sequenceLength }, () => 0);
    const anchorSet = new Set(config.sinkTokenIds.filter((id) => id <= query));
    const retrievalCandidateCount = Math.max(1, Math.floor(query * config.retrievalSpikeProbability));
    const retrievalTarget = retrievalCandidateCount ? Math.max(0, query - 1 - Math.floor(rng() * Math.max(1, query))) : 0;

    for (let key = 0; key <= query; key += 1) {
      let weight = 0.001;
      const isSink = anchorSet.has(key);
      const recency = baseRecencyWeight(query, key, config.localWindow);

      switch (profile) {
        case "sink-heavy":
          weight = recency * 0.28 + (isSink ? config.sinkStrength * 3.6 : 0) + (key === query ? 0.2 : 0);
          break;
        case "local":
          weight = recency * 1.35 + (query - key <= Math.max(2, Math.floor(config.localWindow / 4)) ? 0.18 : 0) + (isSink ? config.sinkStrength * 0.4 : 0);
          break;
        case "recency-biased":
          weight = recency * 1.7 + (key === query ? 0.22 : 0) + (isSink ? config.sinkStrength * 0.55 : 0);
          break;
        case "retrieval-biased":
          weight = recency * 0.65 + (key === retrievalTarget ? 1.35 : 0) + (isSink ? config.sinkStrength * 1.2 : 0);
          break;
        default:
          weight = 0.08 + recency * 0.35 + (isSink ? config.sinkStrength * 0.75 : 0);
          break;
      }

      weight *= 0.94 + rng() * 0.12;
      row[key] = weight;
    }

    return normalizeRow(row, query);
  }

  function generateAttentionTensor(config = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const rng = createRng(merged.seed);
    const tensor = [];
    const headProfiles = [];

    for (let layer = 0; layer < merged.layers; layer += 1) {
      const layerTensor = [];
      for (let head = 0; head < merged.heads; head += 1) {
        const profile = headProfileFor(head + layer);
        if (layer === 0) {
          headProfiles.push({ headId: head, profile });
        }
        const headTensor = [];
        for (let query = 0; query < merged.sequenceLength; query += 1) {
          headTensor.push(generateRow(profile, query, merged, rng));
        }
        layerTensor.push(headTensor);
      }
      tensor.push(layerTensor);
    }

    return {
      tensor,
      config: merged,
      headProfiles,
      validation: validateAttentionTensor(tensor),
      summary: summarizeAttentionPatterns(tensor, merged, headProfiles),
    };
  }

  function validateAttentionTensor(tensor) {
    const problems = [];
    let maxRowDeviation = 0;
    let causalViolations = 0;

    for (let layer = 0; layer < tensor.length; layer += 1) {
      for (let head = 0; head < tensor[layer].length; head += 1) {
        for (let query = 0; query < tensor[layer][head].length; query += 1) {
          const row = tensor[layer][head][query];
          const total = sum(row);
          maxRowDeviation = Math.max(maxRowDeviation, Math.abs(total - 1));
          if (Math.abs(total - 1) > 1e-6) {
            problems.push(`Row sum mismatch at layer ${layer}, head ${head}, query ${query}: ${total}`);
          }
          for (let key = query + 1; key < row.length; key += 1) {
            if (Math.abs(row[key]) > 1e-9) {
              causalViolations += 1;
              problems.push(`Causal violation at layer ${layer}, head ${head}, query ${query}, key ${key}`);
              break;
            }
          }
        }
      }
    }

    return {
      valid: problems.length === 0,
      maxRowDeviation,
      causalViolations,
      problems,
    };
  }

  function summarizeAttentionPatterns(tensor, config = DEFAULT_CONFIG, headProfiles = []) {
    const tokenMass = Array.from({ length: config.sequenceLength }, () => 0);
    const headSummary = headProfiles.map((profile) => ({
      headId: profile.headId,
      profile: profile.profile,
      averageSinkMass: 0,
      averageRecentMass: 0,
      averageDiffuseMass: 0,
    }));

    for (let layer = 0; layer < tensor.length; layer += 1) {
      for (let head = 0; head < tensor[layer].length; head += 1) {
        let sinkMass = 0;
        let recentMass = 0;
        let diffuseMass = 0;
        let rowCount = 0;
        for (let query = 0; query < tensor[layer][head].length; query += 1) {
          const row = tensor[layer][head][query];
          row.forEach((value, key) => {
            tokenMass[key] += value;
          });
          sinkMass += config.sinkTokenIds.filter((key) => key <= query).reduce((acc, key) => acc + row[key], 0);
          recentMass += row.slice(Math.max(0, query - config.localWindow + 1), query + 1).reduce((acc, value) => acc + value, 0);
          diffuseMass += row.slice(0, query + 1).reduce((acc, value) => acc + value, 0) / (query + 1);
          rowCount += 1;
        }
        const summary = headSummary[head];
        if (summary) {
          summary.averageSinkMass += sinkMass / Math.max(1, rowCount);
          summary.averageRecentMass += recentMass / Math.max(1, rowCount);
          summary.averageDiffuseMass += diffuseMass / Math.max(1, rowCount);
        }
      }
    }

    const rankedTokens = tokenMass
      .map((score, tokenId) => ({ tokenId, score }))
      .sort((a, b) => b.score - a.score);

    return {
      topTokens: rankedTokens.slice(0, 10),
      headSummary,
      sinkCoverage: config.sinkTokenIds.reduce((acc, tokenId) => acc + (tokenMass[tokenId] || 0), 0),
    };
  }

  sim.core.attentionGenerator = {
    DEFAULT_CONFIG,
    generateAttentionTensor,
    validateAttentionTensor,
    summarizeAttentionPatterns,
  };
})();
