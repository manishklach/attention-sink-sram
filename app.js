const state = {
  promptLength: 18,
  decodeSteps: 18,
  headCount: 5,
  tenantCount: 4,
  sharedPrefixLength: 4,
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

const ids = [
  "promptLength",
  "decodeSteps",
  "headCount",
  "tenantCount",
  "sharedPrefixLength",
  "sinkThreshold",
  "evictionThreshold",
  "emaAlpha",
  "dwellSteps",
  "sramBudget",
  "sinkStrength",
  "hbmLatency",
  "sramLatency",
];

const tokenKinds = ["BOS", "SYS", "INST", "ANCHOR"];
const headProfiles = ["sink", "local", "retrieval"];

function bindControls() {
  ids.forEach((id) => {
    const input = document.getElementById(id);
    const value = document.getElementById(`${id}Value`);
    input.addEventListener("input", () => {
      state[id] = Number(input.value);
      value.textContent = input.value;
      if (id === "promptLength" && state.sharedPrefixLength > state.promptLength) {
        state.sharedPrefixLength = state.promptLength;
        document.getElementById("sharedPrefixLength").value = state.sharedPrefixLength;
        document.getElementById("sharedPrefixLengthValue").textContent = state.sharedPrefixLength;
      }
      run();
    });
  });

  document.getElementById("rerun").addEventListener("click", run);
  document.getElementById("presetConservative").addEventListener("click", () => {
    setPreset({
      promptLength: 18,
      decodeSteps: 16,
      headCount: 4,
      tenantCount: 3,
      sharedPrefixLength: 4,
      sinkThreshold: 0.66,
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
    setPreset({
      promptLength: 22,
      decodeSteps: 22,
      headCount: 6,
      tenantCount: 8,
      sharedPrefixLength: 5,
      sinkThreshold: 0.44,
      evictionThreshold: 0.2,
      emaAlpha: 0.6,
      dwellSteps: 2,
      sramBudget: 7,
      sinkStrength: 0.84,
      hbmLatency: 20,
      sramLatency: 2,
    });
  });
  document.getElementById("exportJson").addEventListener("click", exportJson);
}

function setPreset(next) {
  Object.entries(next).forEach(([key, value]) => {
    state[key] = value;
    document.getElementById(key).value = value;
    document.getElementById(`${key}Value`).textContent = value;
  });
  run();
}

function generateTokens(promptLength, sharedPrefixLength) {
  return Array.from({ length: promptLength }, (_, index) => {
    if (index < tokenKinds.length) {
      return { id: index, label: tokenKinds[index], kind: "anchor", shared: index < sharedPrefixLength };
    }
    return { id: index, label: `T${index}`, kind: "normal", shared: index < sharedPrefixLength };
  });
}

function generateHeadConfigs(headCount) {
  return Array.from({ length: headCount }, (_, index) => {
    const profile = headProfiles[index % headProfiles.length];
    const bias = profile === "sink" ? 1.15 : profile === "local" ? 0.95 : 0.82;
    return { id: index, label: `H${index}`, profile, bias };
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function baseWeightForToken(index, promptLength, sinkStrength, profile, step) {
  const recentWindow = index >= promptLength - 4 ? 0.2 : 0;
  const wave = (((step + 1) * (index + 5)) % 9) / 140;

  if (profile === "sink") {
    if (index === 0) return sinkStrength + 0.18 + wave;
    if (index === 1) return sinkStrength + 0.12 + wave;
    if (index === 2) return sinkStrength + 0.08 + wave;
    if (index === 3) return sinkStrength + 0.02 + wave;
    return clamp(0.14 + wave - index / (promptLength * 5), 0.05, 0.4);
  }

  if (profile === "local") {
    const distance = (promptLength - 1 - index) / Math.max(promptLength - 1, 1);
    return clamp(0.16 + recentWindow + distance * 0.18 + wave, 0.04, 0.5);
  }

  const distancePenalty = index / Math.max(promptLength - 1, 1);
  return clamp(0.28 - distancePenalty * 0.12 + recentWindow * 0.4 + wave, 0.06, 0.42);
}

function normalizeRow(row) {
  const sum = row.reduce((acc, value) => acc + value, 0);
  return row.map((value) => value / sum);
}

function generateAttentionByHead(tokens, heads, decodeSteps, sinkStrength) {
  return Array.from({ length: decodeSteps }, (_, step) =>
    heads.map((head) => {
      const row = tokens.map((token, index) =>
        baseWeightForToken(index, tokens.length, sinkStrength, head.profile, step) * head.bias,
      );
      return normalizeRow(row);
    }),
  );
}

function generateTenantWeights(tokens, tenantCount, sharedPrefixLength) {
  return Array.from({ length: tenantCount }, (_, tenantIndex) => {
    const focus = sharedPrefixLength + ((tenantIndex * 3) % Math.max(tokens.length - sharedPrefixLength, 1));
    return tokens.map((token, tokenIndex) => {
      if (tokenIndex < sharedPrefixLength) {
        return 1;
      }
      const distance = Math.abs(tokenIndex - focus);
      return clamp(0.85 - distance * 0.08, 0.18, 0.9);
    });
  });
}

function aggregateAttention(attentionByHead, heads, tenantWeights) {
  return attentionByHead.map((stepRows) => {
    const tokenCount = stepRows[0]?.length ?? 0;
    const totals = Array.from({ length: tokenCount }, () => 0);

    tenantWeights.forEach((tenantRow) => {
      stepRows.forEach((row, headIndex) => {
        row.forEach((value, tokenIndex) => {
          totals[tokenIndex] += value * heads[headIndex].bias * tenantRow[tokenIndex];
        });
      });
    });

    return normalizeRow(totals);
  });
}

function computeStaticScores(aggregateRows) {
  const tokenCount = aggregateRows[0]?.length ?? 0;
  const sums = Array.from({ length: tokenCount }, () => 0);
  aggregateRows.forEach((row) => {
    row.forEach((value, index) => {
      sums[index] += value;
    });
  });
  const peak = Math.max(...sums, 1);
  return sums.map((value) => value / peak);
}

function simulateDynamicController(tokens, heads, attentionByHead, tenantWeights) {
  const slotMap = new Map();
  const emaScores = Array.from({ length: tokens.length }, () => 0);
  const coldCounters = Array.from({ length: tokens.length }, () => 0);
  const timeline = Array.from({ length: tokens.length }, () => []);
  const promotions = Array.from({ length: tokens.length }, () => 0);
  const evictions = Array.from({ length: tokens.length }, () => 0);
  const sharedHitsByStep = [];
  const trace = [];

  const aggregateRows = aggregateAttention(attentionByHead, heads, tenantWeights);

  aggregateRows.forEach((normalized, stepIndex) => {
    normalized.forEach((value, tokenIndex) => {
      emaScores[tokenIndex] =
        state.emaAlpha * emaScores[tokenIndex] + (1 - state.emaAlpha) * value;
      timeline[tokenIndex].push(emaScores[tokenIndex]);
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

    let sramReads = 0;
    let hbmReads = 0;
    let sharedHits = 0;
    activeReads.forEach(({ index }) => {
      if (slotMap.has(index)) {
        sramReads += 1;
        if (tokens[index].shared) {
          sharedHits += 1;
        }
      } else {
        hbmReads += 1;
      }
    });

    sharedHitsByStep.push(sharedHits);

    const baselineCost = activeReads.length * state.hbmLatency;
    const actualCost = sramReads * state.sramLatency + hbmReads * state.hbmLatency;

    trace.push({
      step: stepIndex + 1,
      aggregate: normalized,
      residentTokenIds: [...slotMap.keys()],
      sramReads,
      hbmReads,
      sharedHits,
      baselineCost,
      actualCost,
      saved: baselineCost - actualCost,
      events,
    });
  });

  const assignments = tokens.map((token, index) => ({
    ...token,
    sinkScore: timeline[index][timeline[index].length - 1] || 0,
    tier: trace[trace.length - 1]?.residentTokenIds.includes(token.id) ? "SRAM" : "HBM",
    promotions: promotions[index],
    evictions: evictions[index],
  }));

  const readsAvoided = trace.reduce((acc, row) => acc + row.sramReads, 0);
  const latencySaved = trace.reduce((acc, row) => acc + row.saved, 0);
  const totalReads = trace.reduce((acc, row) => acc + row.sramReads + row.hbmReads, 0);
  const sharedHits = trace.reduce((acc, row) => acc + row.sharedHits, 0);

  return {
    assignments,
    trace,
    timeline,
    aggregateRows,
    readsAvoided,
    latencySaved,
    sharedHits,
    hitRate: totalReads ? readsAvoided / totalReads : 0,
  };
}

function simulateBaseline(aggregateRows) {
  const trace = aggregateRows.map((row, stepIndex) => {
    const activeReads = row
      .map((value, index) => ({ index, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.min(6, row.length));
    return {
      step: stepIndex + 1,
      sramReads: 0,
      hbmReads: activeReads.length,
      actualCost: activeReads.length * state.hbmLatency,
    };
  });

  return {
    latencyCost: trace.reduce((acc, row) => acc + row.actualCost, 0),
    hitRate: 0,
  };
}

function simulateStaticPolicy(tokens, aggregateRows) {
  const scores = computeStaticScores(aggregateRows);
  const ranked = tokens
    .map((token, index) => ({ tokenId: token.id, score: scores[index] }))
    .filter((token) => token.score >= state.sinkThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, state.sramBudget);
  const resident = new Set(ranked.map((item) => item.tokenId));
  const trace = aggregateRows.map((row, stepIndex) => {
    const activeReads = row
      .map((value, index) => ({ index, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.min(6, row.length));

    let sramReads = 0;
    let hbmReads = 0;
    activeReads.forEach(({ index }) => {
      if (resident.has(index)) {
        sramReads += 1;
      } else {
        hbmReads += 1;
      }
    });

    return {
      step: stepIndex + 1,
      sramReads,
      hbmReads,
      actualCost: sramReads * state.sramLatency + hbmReads * state.hbmLatency,
    };
  });

  const totalReads = trace.reduce((acc, row) => acc + row.sramReads + row.hbmReads, 0);
  const sramReads = trace.reduce((acc, row) => acc + row.sramReads, 0);

  return {
    residentCount: resident.size,
    latencyCost: trace.reduce((acc, row) => acc + row.actualCost, 0),
    hitRate: totalReads ? sramReads / totalReads : 0,
  };
}

function renderHeadProfiles(heads) {
  const container = document.getElementById("headProfiles");
  container.innerHTML = "";
  heads.forEach((head) => {
    const card = document.createElement("div");
    card.className = "headCard";
    card.innerHTML = `
      <div class="headCardHeader">
        <strong>${head.label}</strong>
        <span class="badge ${head.profile}">${head.profile}</span>
      </div>
      <p class="subtle">${
        head.profile === "sink"
          ? "Prefers anchor and shared-prefix tokens. Strong fit for sink-aware promotion."
          : head.profile === "local"
            ? "Prefers recent context. Often favors HBM fallback unless hot windows are promoted."
            : "Reads broadly across context. Useful stress case for limited SRAM capacity."
      }</p>
    `;
    container.appendChild(card);
  });
}

function renderBenchmark(baseline, staticPolicy, dynamicResult) {
  const container = document.getElementById("benchmarkTable");
  container.innerHTML = "";
  const rows = [
    {
      name: "HBM-only baseline",
      hitRate: baseline.hitRate,
      latencyCost: baseline.latencyCost,
      extra: "No promoted tokens",
    },
    {
      name: "Static one-shot policy",
      hitRate: staticPolicy.hitRate,
      latencyCost: staticPolicy.latencyCost,
      extra: `${staticPolicy.residentCount} fixed SRAM slots`,
    },
    {
      name: "Dynamic EMA controller",
      hitRate: dynamicResult.hitRate,
      latencyCost: dynamicResult.trace.reduce((acc, row) => acc + row.actualCost, 0),
      extra: `${dynamicResult.assignments.filter((token) => token.tier === "SRAM").length} final residents`,
    },
  ];

  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = "benchmarkRow";
    div.innerHTML = `
      <div class="rowSplit">
        <strong>${row.name}</strong>
        <span>${(row.hitRate * 100).toFixed(1)}% hit rate</span>
      </div>
      <div class="tinyBar">
        <div class="sramHits" style="width:${(row.hitRate * 100).toFixed(2)}%"></div>
        <div class="hbmHits" style="width:${(100 - row.hitRate * 100).toFixed(2)}%"></div>
      </div>
      <p class="subtle">Latency cost: ${row.latencyCost.toFixed(0)} | ${row.extra}</p>
    `;
    container.appendChild(div);
  });
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

function heatColor(value) {
  const clamped = clamp(value, 0, 1);
  const low = [247, 242, 234];
  const high = [14, 95, 102];
  const rgb = low.map((channel, index) =>
    Math.round(channel + (high[index] - channel) * clamped),
  );
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function renderHeatmap(aggregateRows) {
  const container = document.getElementById("heatmap");
  container.innerHTML = "";
  aggregateRows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "heatmapRow";
    rowEl.style.gridTemplateColumns = `repeat(${row.length}, minmax(0, 1fr))`;
    row.forEach((value, tokenIndex) => {
      const cell = document.createElement("div");
      cell.className = "heatCell";
      cell.style.backgroundColor = heatColor(value / Math.max(...row, 0.001));
      cell.title = `Token ${tokenIndex} aggregate attention ${value.toFixed(3)}`;
      rowEl.appendChild(cell);
    });
    container.appendChild(rowEl);
  });
}

function renderTimeline(tokens, timeline) {
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  const topTokens = [...tokens]
    .sort((a, b) => b.sinkScore - a.sinkScore)
    .slice(0, Math.min(5, tokens.length));

  topTokens.forEach((token) => {
    const row = document.createElement("div");
    row.className = "timelineRow";
    const track = timeline[token.id]
      .map((value) => `<div class="timelineCell" style="background:${heatColor(value)}" title="${value.toFixed(3)}"></div>`)
      .join("");
    row.innerHTML = `
      <div class="rowSplit">
        <strong>${token.label}</strong>
        <span>${token.sinkScore.toFixed(3)}</span>
      </div>
      <div class="timelineTrack">${track}</div>
    `;
    container.appendChild(row);
  });
}

function renderTrace(trace, tokens) {
  const container = document.getElementById("routingTrace");
  container.innerHTML = "";
  trace.forEach((entry) => {
    const total = entry.sramReads + entry.hbmReads || 1;
    const sramWidth = (entry.sramReads / total) * 100;
    const hbmWidth = (entry.hbmReads / total) * 100;
    const labels = entry.events
      .map((event) => {
        const label = tokens[event.tokenId].label;
        return `<span class="eventTag ${event.type}">${event.type}: ${label}</span>`;
      })
      .join("");

    const row = document.createElement("div");
    row.className = "traceRow";
    row.innerHTML = `
      <div class="traceHeader">
        <span>Decode step ${entry.step}</span>
        <span>Residents: ${entry.residentTokenIds.map((id) => tokens[id].label).join(", ") || "none"}</span>
      </div>
      <div class="traceBar">
        <div class="sramHits" style="width:${sramWidth}%"></div>
        <div class="hbmHits" style="width:${hbmWidth}%"></div>
      </div>
      <p class="subtle">SRAM reads: ${entry.sramReads} | HBM reads: ${entry.hbmReads} | Shared-prefix hits: ${entry.sharedHits} | Saved ${entry.saved.toFixed(0)} latency units</p>
      <div class="eventTags">${labels || '<span class="eventTag">no controller events</span>'}</div>
    `;
    container.appendChild(row);
  });
}

function renderSummary(assignments, dynamicResult, baseline, staticPolicy) {
  const sinkCount = assignments.filter((token) => token.tier === "SRAM").length;
  const dynamicCost = dynamicResult.trace.reduce((acc, row) => acc + row.actualCost, 0);
  const savedVsBaseline = baseline.latencyCost - dynamicCost;
  const savedVsStatic = staticPolicy.latencyCost - dynamicCost;
  const totalSramReads = dynamicResult.trace.reduce((acc, row) => acc + row.sramReads, 0);
  const prefixLift = totalSramReads ? dynamicResult.sharedHits / totalSramReads : 0;

  document.getElementById("sinkCount").textContent = String(sinkCount);
  document.getElementById("readsAvoided").textContent = String(dynamicResult.readsAvoided);
  document.getElementById("latencySaved").textContent = dynamicResult.latencySaved.toFixed(0);
  document.getElementById("sramHitRate").textContent = `${(dynamicResult.hitRate * 100).toFixed(1)}%`;
  document.getElementById("prefixLift").textContent = `${(prefixLift * 100).toFixed(1)}%`;

  const promotedLabels = assignments
    .filter((token) => token.tier === "SRAM")
    .map((token) => token.label)
    .join(", ") || "none";

  document.getElementById("summaryText").textContent =
    `Final SRAM residents: ${promotedLabels}. With ${state.tenantCount} simulated tenants sharing the first ` +
    `${state.sharedPrefixLength} prompt tokens, the dynamic controller saved ${savedVsBaseline.toFixed(0)} latency units ` +
    `versus an HBM-only baseline and ${savedVsStatic.toFixed(0)} versus a static one-shot placement policy.`;
}

function exportJson() {
  if (!lastRun) {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    patentApplicationNumber: "202641062302",
    state,
    benchmark: lastRun.benchmark,
    heads: lastRun.heads,
    tokens: lastRun.dynamicResult.assignments,
    trace: lastRun.dynamicResult.trace,
    timeline: lastRun.dynamicResult.timeline,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attention-sink-sram-trace.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function run() {
  if (state.sharedPrefixLength > state.promptLength) {
    state.sharedPrefixLength = state.promptLength;
  }

  const tokens = generateTokens(state.promptLength, state.sharedPrefixLength);
  const heads = generateHeadConfigs(state.headCount);
  const attentionByHead = generateAttentionByHead(tokens, heads, state.decodeSteps, state.sinkStrength);
  const tenantWeights = generateTenantWeights(tokens, state.tenantCount, state.sharedPrefixLength);
  const dynamicResult = simulateDynamicController(tokens, heads, attentionByHead, tenantWeights);
  const baseline = simulateBaseline(dynamicResult.aggregateRows);
  const staticPolicy = simulateStaticPolicy(tokens, dynamicResult.aggregateRows);

  renderSummary(dynamicResult.assignments, dynamicResult, baseline, staticPolicy);
  renderHeadProfiles(heads);
  renderBenchmark(baseline, staticPolicy, dynamicResult);
  renderTokenTable(dynamicResult.assignments);
  renderHeatmap(dynamicResult.aggregateRows);
  renderTimeline(dynamicResult.assignments, dynamicResult.timeline);
  renderTrace(dynamicResult.trace, tokens);

  lastRun = {
    heads,
    benchmark: {
      baseline,
      staticPolicy,
      dynamic: {
        latencyCost: dynamicResult.trace.reduce((acc, row) => acc + row.actualCost, 0),
        hitRate: dynamicResult.hitRate,
      },
    },
    dynamicResult,
  };
}

bindControls();
run();
