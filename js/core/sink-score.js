(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.core = sim.core || {};

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function ema(values, alpha) {
    let state = 0;
    return values.map((value, index) => {
      state = index === 0 ? value : alpha * state + (1 - alpha) * value;
      return state;
    });
  }

  function buildRange(length, queryWindow) {
    if (!queryWindow || queryWindow === "all") {
      return { start: 0, end: length - 1 };
    }
    if (Array.isArray(queryWindow)) {
      return {
        start: Math.max(0, queryWindow[0] || 0),
        end: Math.min(length - 1, queryWindow[1] ?? length - 1),
      };
    }
    return {
      start: Math.max(0, length - Number(queryWindow)),
      end: length - 1,
    };
  }

  function computeSinkScores(attentionTensor, options = {}) {
    const layerCount = attentionTensor.length;
    const headCount = attentionTensor[0]?.length || 0;
    const queryCount = attentionTensor[0]?.[0]?.length || 0;
    const tokenCount = attentionTensor[0]?.[0]?.[0]?.length || 0;
    const layerWeights = options.layerWeights || Array.from({ length: layerCount }, () => 1);
    const headWeights = options.headWeights || Array.from({ length: headCount }, () => 1);
    const normalizationMode = options.normalizationMode || "raw";
    const queryRange = buildRange(queryCount, options.queryWindow);
    const rawScores = Array.from({ length: tokenCount }, () => 0);
    const breakdownByLayer = Array.from({ length: layerCount }, () => Array.from({ length: tokenCount }, () => 0));
    const breakdownByHead = Array.from({ length: headCount }, () => Array.from({ length: tokenCount }, () => 0));
    const perQueryMass = Array.from({ length: tokenCount }, () => []);

    for (let layer = 0; layer < layerCount; layer += 1) {
      for (let head = 0; head < headCount; head += 1) {
        for (let query = queryRange.start; query <= queryRange.end; query += 1) {
          for (let tokenId = 0; tokenId <= query && tokenId < tokenCount; tokenId += 1) {
            const value = attentionTensor[layer][head][query][tokenId] * layerWeights[layer] * headWeights[head];
            rawScores[tokenId] += value;
            breakdownByLayer[layer][tokenId] += value;
            breakdownByHead[head][tokenId] += value;
            perQueryMass[tokenId].push(value);
          }
        }
      }
    }

    let scores = rawScores.slice();
    if (normalizationMode === "per-layer") {
      scores = rawScores.map((_, tokenId) => sum(breakdownByLayer.map((layerScores) => {
        const layerTotal = sum(layerScores) || 1;
        return layerScores[tokenId] / layerTotal;
      })));
    } else if (normalizationMode === "per-head") {
      scores = rawScores.map((_, tokenId) => sum(breakdownByHead.map((headScores) => {
        const headTotal = sum(headScores) || 1;
        return headScores[tokenId] / headTotal;
      })));
    } else if (normalizationMode === "ema-smoothed") {
      scores = perQueryMass.map((queryValues) => {
        if (!queryValues.length) {
          return 0;
        }
        const smoothed = ema(queryValues, options.emaAlpha ?? 0.72);
        return smoothed[smoothed.length - 1];
      });
    }

    const rankedTokens = rankSinkTokens(scores);
    const sinkTokens = classifySinkTokens(scores, options.threshold ?? 0.56);
    return {
      scores,
      rankedTokens,
      sinkTokens,
      breakdownByLayer,
      breakdownByHead,
      normalizationMode,
      queryRange,
    };
  }

  function rankSinkTokens(scores) {
    return scores
      .map((score, tokenId) => ({ tokenId, score }))
      .sort((a, b) => b.score - a.score);
  }

  function classifySinkTokens(scores, threshold) {
    const maxScore = Math.max(...scores, 0);
    const cutoff = threshold <= 1 ? maxScore * threshold : threshold;
    return scores
      .map((score, tokenId) => ({ tokenId, score, isSink: score >= cutoff }))
      .filter((entry) => entry.isSink);
  }

  function computeSinkScoreBreakdown(attentionTensor, tokenId, options = {}) {
    const result = computeSinkScores(attentionTensor, options);
    return {
      tokenId,
      score: result.scores[tokenId] || 0,
      byLayer: result.breakdownByLayer.map((layerScores, layer) => ({
        layer,
        contribution: layerScores[tokenId] || 0,
      })),
      byHead: result.breakdownByHead.map((headScores, head) => ({
        head,
        contribution: headScores[tokenId] || 0,
      })),
      normalizationMode: result.normalizationMode,
    };
  }

  sim.core.sinkScore = {
    computeSinkScores,
    rankSinkTokens,
    classifySinkTokens,
    computeSinkScoreBreakdown,
  };
})();
