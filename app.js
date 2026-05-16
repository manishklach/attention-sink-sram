(function () {
  const sim = window.AttentionSinkSim;
  const { formatNumber, bytesToHuman } = sim.utils;

  function syncControlValues() {
    sim.ensureLayerRange();
    document.getElementById("promotedHeads").max = String(sim.state.kvHeads);
    document.getElementById("promotedLayerStart").max = String(Math.max(0, sim.state.layers - 1));
    document.getElementById("promotedLayerEnd").max = String(Math.max(0, sim.state.layers - 1));
    document.getElementById("sharedPrefixLength").max = String(sim.state.promptLength);

    sim.rangeIds.forEach((id) => {
      const input = document.getElementById(id);
      const value = document.getElementById(`${id}Value`);
      input.value = sim.state[id];
      value.textContent = String(sim.state[id]);
      if (["layerBoostMultiplier", "sinkThreshold", "evictionThreshold", "emaAlpha", "draftAcceptRate"].includes(id)) {
        value.textContent = Number(sim.state[id]).toFixed(2).replace(/0$/, "").replace(/\.$/, "");
      }
    });

    sim.selectIds.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = String(sim.state[id]);
      }
    });
  }

  function fillSessionSelector(sessions) {
    const select = document.getElementById("selectedSession");
    const existing = select.value;
    select.innerHTML = sessions
      .map((session) => `<option value="${session.sessionId}">${session.sessionId}${session.attachedSharedPrefix ? " (shared)" : ""}</option>`)
      .join("");
    if ([...select.options].some((option) => option.value === existing)) {
      select.value = existing;
    }
  }

  function renderHeadProfiles(headProfiles) {
    const container = document.getElementById("headProfiles");
    container.innerHTML = "";
    headProfiles.forEach((head) => {
      const el = document.createElement("div");
      el.className = `headCard ${head.promoted ? "promoted" : ""}`;
      el.innerHTML = `
        <div class="headCardHeader">
          <strong>${head.label}</strong>
          <span class="badge ${head.profile}">${head.profile}</span>
        </div>
        <div class="subtle">${head.description}</div>
        <div class="headStats">
          <span>Contribution <strong>${head.sinkScoreContribution.toFixed(2)}</strong></span>
          <span>Eligible <strong>${head.eligible ? "yes" : "no"}</strong></span>
          <span>Status <strong>${head.promoted ? "promoted" : "cold"}</strong></span>
        </div>
      `;
      el.addEventListener("click", () => {
        sim.memory.headEligibilityOverrides[head.id] = !sim.memory.headEligibilityOverrides[head.id];
        runSimulation();
      });
      container.appendChild(el);
    });
  }

  function renderHeatmap(headProfiles, buckets) {
    const container = document.getElementById("headHeatmap");
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "heatRow heatHeader";
    header.innerHTML = `<div class="heatLabel">Layers</div>${headProfiles.map((head) => `<div class="heatHead">${head.id}</div>`).join("")}`;
    container.appendChild(header);

    buckets.forEach((bucket) => {
      const row = document.createElement("div");
      row.className = "heatRow";
      row.innerHTML = `<div class="heatLabel">${bucket.label}</div>`;
      headProfiles.forEach((head) => {
        const slice = head.layerIntensities.find((item) => item.bucketId === bucket.id);
        const intensity = slice ? slice.intensity : 0;
        const cell = document.createElement("div");
        const classes = ["heatCell"];
        if (head.promoted && head.eligible && (sim.state.promotionGranularity !== "per-head-layer" || slice.layerWeight > 1)) {
          classes.push("promoted");
        } else if (intensity >= 1.05) {
          classes.push("high");
        } else if (intensity >= 0.7) {
          classes.push("medium");
        } else {
          classes.push("low");
        }
        cell.className = classes.join(" ");
        cell.textContent = intensity.toFixed(2);
        cell.title = `${head.label}, bucket ${bucket.label}`;
        cell.addEventListener("click", () => {
          sim.memory.headEligibilityOverrides[head.id] = !sim.memory.headEligibilityOverrides[head.id];
          runSimulation();
        });
        row.appendChild(cell);
      });
      container.appendChild(row);
    });

    document.getElementById("heatmapLegend").innerHTML = `
      <span class="legendItem low">Low</span>
      <span class="legendItem medium">Medium</span>
      <span class="legendItem high">High</span>
      <span class="legendItem promoted">Promoted</span>
    `;
  }

  function renderTimeline(timeline) {
    const container = document.getElementById("executionTimeline");
    container.innerHTML = "";
    const maxTime = Math.max(1, ...timeline.map((event) => event.timestamp));
    const cursor = sim.memory.timelineCursor;

    timeline.forEach((event, index) => {
      const card = document.createElement("div");
      const isActive = index === cursor;
      const left = (event.timestamp / maxTime) * 100;
      card.className = `timelineEvent ${isActive ? "active" : ""}`;
      card.style.left = `${left}%`;
      card.innerHTML = `
        <div class="timelineStage">${event.stage}</div>
        <div class="timelineMeta">${event.sessionId} | t=${event.timestamp}</div>
      `;
      card.addEventListener("click", () => {
        sim.memory.timelineCursor = index;
        renderTimeline(sim.memory.lastRun.timeline);
        renderDma(sim.memory.lastRun.dma);
        renderArchitecture(sim.memory.lastRun.architectureState);
      });
      container.appendChild(card);
    });

    const activeEvent = timeline[cursor];
    document.getElementById("timelineStatus").textContent = sim.memory.playbackTimer ? "Playing" : "Paused";
    document.getElementById("timelineStatus").className = `badge ${sim.memory.playbackTimer ? "good" : "neutral"}`;
    document.getElementById("timelineDetails").innerHTML = activeEvent
      ? `
        <div class="detailCard"><strong>Timestamp</strong><span>${activeEvent.timestamp}</span></div>
        <div class="detailCard"><strong>Session</strong><span>${activeEvent.sessionId}</span></div>
        <div class="detailCard"><strong>Token range</strong><span>${activeEvent.tokenRange}</span></div>
        <div class="detailCard"><strong>Heads affected</strong><span>${activeEvent.headsAffected}</span></div>
        <div class="detailCard"><strong>Layer range</strong><span>${activeEvent.layerRange}</span></div>
        <div class="detailCard"><strong>Bytes moved</strong><span>${bytesToHuman(activeEvent.bytesMoved)}</span></div>
        <div class="detailCard"><strong>Path</strong><span>${activeEvent.sourceTier} → ${activeEvent.destinationTier}</span></div>
        <div class="detailCard"><strong>Estimated latency</strong><span>${formatNumber(activeEvent.estimatedLatency, 1)}</span></div>
      `
      : "";
  }

  function renderDma(dmaState) {
    const timeline = sim.memory.lastRun ? sim.memory.lastRun.timeline : [];
    const cursorEvent = timeline[sim.memory.timelineCursor];
    const time = cursorEvent ? cursorEvent.timestamp : 0;
    const active = dmaState.descriptors.filter((item) => item.startTime <= time && item.completionTime > time);
    const queued = dmaState.descriptors.filter(
      (item) => item.enqueueTime > time || (item.enqueueTime <= time && item.startTime > time)
    );
    const completed = dmaState.descriptors.filter((item) => item.completionTime <= time).slice(-8).reverse();

    document.getElementById("dmaUtilizationLabel").textContent = `${formatNumber(dmaState.utilization, 1)}%`;
    document.getElementById("dmaUtilizationBar").style.width = `${Math.min(100, dmaState.utilization)}%`;

    const groups = [
      ["dmaActive", active],
      ["dmaQueued", queued.slice(0, 8)],
      ["dmaCompleted", completed],
    ];

    groups.forEach(([id, items]) => {
      const container = document.getElementById(id);
      container.innerHTML = items.length
        ? items
            .map(
              (item) => `
            <div class="stackItem">
              <strong>${item.id}</strong>
              <span>${item.sessionId} | tokens ${item.tokenRange}</span>
              <span>${bytesToHuman(item.bytes)} | ${item.source} → ${item.destination}</span>
              <span>t${item.enqueueTime} to t${item.completionTime}</span>
            </div>
          `
            )
            .join("")
        : `<div class="stackEmpty">No items</div>`;
    });
  }

  function renderRouting(routingState) {
    const container = document.getElementById("routingTable");
    const rows = routingState.rows.slice(0, 14);
    container.innerHTML = `
      <div class="routingHeader">
        <span>Session</span>
        <span>Step</span>
        <span>Requested heads</span>
        <span>SRAM hits</span>
        <span>Misses</span>
        <span>HBM fallback</span>
        <span>Latency</span>
        <span>Decision</span>
      </div>
      ${rows
        .map(
          (row) => `
        <div class="routingRow ${row.routingDecision.toLowerCase()}">
          <span>${row.sessionId}</span>
          <span>${row.step}</span>
          <span>${row.requestedHeads}</span>
          <span>${row.sramHits}</span>
          <span>${row.sramMisses}</span>
          <span>${row.fallbackHbmReads}</span>
          <span>${formatNumber(row.estimatedLatency, 1)}</span>
          <span>${row.routingDecision}</span>
        </div>
      `
        )
        .join("")}
    `;
  }

  function renderSharedPrefix(sharedMetrics, sessions) {
    const container = document.getElementById("sharedPrefixPanel");
    container.innerHTML = `
      <div class="sharedStat"><span>Attached sessions</span><strong>${sessions.filter((session) => session.attachedSharedPrefix).length}</strong></div>
      <div class="sharedStat"><span>Refcount</span><strong>${sharedMetrics.refcount}</strong></div>
      <div class="sharedStat"><span>SRAM bytes saved</span><strong>${bytesToHuman(sharedMetrics.bytesSaved)}</strong></div>
      <div class="sharedStat"><span>Avoided duplicate promotions</span><strong>${sharedMetrics.duplicatePromotionsAvoided}</strong></div>
      <div class="sharedStat"><span>Avoided HBM reads</span><strong>${formatNumber(sharedMetrics.avoidedHbmReads, 0)}</strong></div>
    `;
  }

  function renderDirectory(directory) {
    const container = document.getElementById("residencyDirectory");
    const entries = sim.residency.getFilteredEntries(directory, sim.state.directorySort, sim.state.directoryFilter);
    container.innerHTML = `
      <div class="directoryHeader">
        <span>Session</span>
        <span>Token range</span>
        <span>Head range</span>
        <span>Layer range</span>
        <span>Sink score</span>
        <span>Age</span>
        <span>Refcount</span>
        <span>Tier</span>
        <span>Flags</span>
      </div>
      ${entries
        .map((entry) => {
          const flags = [
            entry.shared ? "shared" : "",
            entry.pinned ? "pinned" : "",
            entry.evicting ? "evicting" : "",
            entry.stale ? "stale" : "",
            entry.tier === "SRAM" ? "promoted" : "",
          ]
            .filter(Boolean)
            .join(", ");
          const classNames = [
            "directoryRow",
            entry.shared ? "shared" : "",
            entry.pinned ? "pinned" : "",
            entry.evicting ? "evicting" : "",
            entry.stale ? "stale" : "",
            entry.tier === "SRAM" ? "promoted" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
            <div class="${classNames}">
              <span>${entry.sessionId}</span>
              <span>${entry.tokenRange}</span>
              <span>${entry.headRange}</span>
              <span>${entry.layerRange}</span>
              <span>${entry.sinkScore.toFixed(2)}</span>
              <span>${entry.age}</span>
              <span>${entry.refcount}</span>
              <span>${entry.tier}</span>
              <span>${flags || "none"}</span>
            </div>
          `;
        })
        .join("")}
    `;
  }

  function renderSpeculative(trace) {
    const container = document.getElementById("speculativePanel");
    const preview = trace.rows.slice(0, 10);
    container.innerHTML = `
      <div class="specSummary">
        <div class="sharedStat"><span>Rollback frequency</span><strong>${trace.rollbackCount}</strong></div>
        <div class="sharedStat"><span>Wasted DMA bytes</span><strong>${bytesToHuman(trace.wastedBytes)}</strong></div>
        <div class="sharedStat"><span>Reclaimed SRAM</span><strong>${bytesToHuman(trace.reclaimedBytes)}</strong></div>
        <div class="sharedStat"><span>Stable sink retention</span><strong>${bytesToHuman(trace.stableRetention)}</strong></div>
      </div>
      <div class="specList">
        ${preview
          .map(
            (row) => `
          <div class="specRow ${row.rejected > 0 ? "rollback" : "stable"}">
            <strong>${row.sessionId} step ${row.step}</strong>
            <span>Draft ${row.draftTokens}</span>
            <span>Accepted ${row.accepted}</span>
            <span>Rejected ${row.rejected}</span>
            <span>Reclaimed ${bytesToHuman(row.reclaimedBytes)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  function renderArchitecture(architectureState) {
    const svg = document.getElementById("architectureSvg");
    const activeEvent = sim.memory.lastRun ? sim.memory.lastRun.timeline[sim.memory.timelineCursor] : null;
    const activeStage = activeEvent ? activeEvent.stage : "";
    const blocks = [
      { key: "tokenizer", label: "Tokenizer", x: 24, y: 44 },
      { key: "prefill", label: "Prefill engine", x: 170, y: 44 },
      { key: "detector", label: "Sink detector", x: 336, y: 44 },
      { key: "dma", label: "DMA scheduler", x: 520, y: 44 },
      { key: "sram", label: "SRAM cache", x: 708, y: 44 },
      { key: "hbm", label: "HBM KV store", x: 888, y: 44 },
      { key: "router", label: "Decode router", x: 1062, y: 44 },
      { key: "eviction", label: "Eviction manager", x: 438, y: 182 },
      { key: "directory", label: "Multi-tenant directory", x: 760, y: 182 },
    ];
    const activeMap = {
      Prefill: "prefill",
      "Sink detection": "detector",
      "DMA promotion": "dma",
      "SRAM residency": "sram",
      "Decode routing": "router",
      Eviction: "eviction",
      "Re-promotion": "dma",
      "Shared-prefix attach": "directory",
      "Shared-prefix detach": "directory",
    };
    const highlightedKey = activeMap[activeStage];
    const connections = [
      ["tokenizer", "prefill"],
      ["prefill", "detector"],
      ["detector", "dma"],
      ["dma", "sram"],
      ["hbm", "dma"],
      ["sram", "router"],
      ["hbm", "router"],
      ["router", "eviction"],
      ["directory", "sram"],
      ["directory", "router"],
    ];

    svg.innerHTML = `
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L10,3 L0,6 z" fill="#0e5f66"></path>
        </marker>
      </defs>
      ${connections
        .map(([fromKey, toKey]) => {
          const from = blocks.find((block) => block.key === fromKey);
          const to = blocks.find((block) => block.key === toKey);
          return `<line x1="${from.x + 118}" y1="${from.y + 32}" x2="${to.x}" y2="${to.y + 32}" class="archLine" marker-end="url(#arrow)"></line>`;
        })
        .join("")}
      ${blocks
        .map((block) => {
          const active = block.key === highlightedKey ? "active" : "";
          return `
            <g class="archBlock ${active}">
              <rect x="${block.x}" y="${block.y}" width="136" height="64" rx="18"></rect>
              <text x="${block.x + 68}" y="${block.y + 28}" text-anchor="middle">${block.label}</text>
              <text x="${block.x + 68}" y="${block.y + 48}" text-anchor="middle" class="archSub">${architectureState[block.key]}</text>
            </g>
          `;
        })
        .join("")}
    `;
  }

  function renderBenchmarkTable(rows, containerId) {
    const container = document.getElementById(containerId);
    const header = containerId === "evictionComparison"
      ? `
        <div class="benchmarkHeader">
          <span>Policy</span>
          <span>Promotion churn</span>
          <span>Thrash rate</span>
          <span>Latency</span>
          <span>DMA traffic</span>
          <span>Cache stability</span>
          <span>Notes</span>
        </div>
      `
      : `
        <div class="benchmarkHeader">
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
        </div>
      `;

    const body = containerId === "evictionComparison"
      ? rows
          .map(
            (row) => `
          <div class="benchmarkRow ${row.name === sim.state.evictionPolicy ? "highlight" : ""}">
            <span><strong>${row.name}</strong></span>
            <span>${formatNumber(row.churn, 0)}</span>
            <span>${formatNumber(row.thrashRate, 2)}</span>
            <span>${formatNumber(row.latency, 1)}</span>
            <span>${bytesToHuman(row.dmaTraffic)}</span>
            <span>${formatNumber(row.stability, 2)}</span>
            <span>${row.notes}</span>
          </div>
        `
          )
          .join("")
      : rows
          .map(
            (row) => `
          <div class="benchmarkRow ${row.granularity === sim.state.promotionGranularity ? "highlight" : ""}">
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
          </div>
        `
          )
          .join("");

    container.innerHTML = header + body;
  }

  function renderEfficiency(model, promotedHeads) {
    const wholeBytes = sim.computeKvBytes(model);
    const currentBytes = sim.computePromotionBytes(model, sim.state, Math.max(1, promotedHeads.length));
    const reduction = wholeBytes > 0 ? (1 - currentBytes / wholeBytes) * 100 : 0;
    const capacity = currentBytes > 0 ? wholeBytes / currentBytes : 1;
    document.getElementById("wholeTokenBytes").textContent = `${bytesToHuman(wholeBytes)} / token`;
    document.getElementById("currentModeBytes").textContent = `${bytesToHuman(currentBytes)} / token`;
    document.getElementById("footprintReduction").textContent = `${formatNumber(reduction, 1)}%`;
    document.getElementById("capacityIncrease").textContent = `${formatNumber(capacity, 2)}x`;
    document.getElementById("efficiencyNote").textContent =
      sim.state.promotionGranularity === "whole-token"
        ? "Whole-token promotion keeps routing simple, but uses the most SRAM per token."
        : sim.state.promotionGranularity === "per-head"
          ? `Promoting ${promotedHeads.length} of ${model.kvHeads} heads lowers SRAM cost while preserving hot slices.`
          : `Promoting ${promotedHeads.length} of ${model.kvHeads} heads across layers ${sim.state.promotedLayerStart}-${sim.state.promotedLayerEnd} increases sink capacity materially.`;
  }

  function buildArchitectureState(directory, dmaState, routingState) {
    return {
      tokenizer: `${sim.state.tenantCount} sessions`,
      prefill: `${sim.state.promptLength} prompt tokens`,
      detector: `${directory.entries.filter((entry) => entry.sinkScore >= sim.state.sinkThreshold).length} sink candidates`,
      dma: `${dmaState.descriptors.length} transfers`,
      sram: `${directory.entries.filter((entry) => entry.tier === "SRAM").length} active entries`,
      hbm: `${formatNumber(routingState.totalMisses, 0)} fallback reads`,
      router: `${routingState.rows.filter((row) => row.routingDecision === "Mixed").length} mixed routes`,
      eviction: sim.state.evictionPolicy,
      directory: `${directory.summary.sharedUsers} shared refs`,
    };
  }

  function updateSummary(sharedMetrics, routingState, dmaState, evictionRows, benchmarkRows) {
    document.getElementById("modeLabel").textContent =
      document.getElementById("promotionGranularity").selectedOptions[0].textContent;
    document.getElementById("sharedPrefixSavings").textContent = bytesToHuman(sharedMetrics.bytesSaved);
    document.getElementById("readsAvoided").textContent = formatNumber(routingState.totalReadsAvoided, 1);
    document.getElementById("dmaBandwidthUse").textContent = `${formatNumber(dmaState.utilization, 1)}%`;
    const activeEviction = evictionRows.find((row) => row.name === sim.state.evictionPolicy);
    document.getElementById("promotionChurn").textContent = formatNumber(activeEviction ? activeEviction.churn : 0, 0);
    const activeBenchmark =
      benchmarkRows.find((row) => row.granularity === sim.state.promotionGranularity) ||
      benchmarkRows.find((row) => row.granularity === "per-head-layer");
    document.getElementById("relativeSpeedup").textContent = `${formatNumber(activeBenchmark ? activeBenchmark.relativeSpeedup : 1, 2)}x`;
  }

  function runSimulation() {
    sim.ensureLayerRange();
    sim.ensureHeadEligibility();
    syncControlValues();

    const model = {
      layers: sim.state.layers,
      kvHeads: sim.state.kvHeads,
      headDim: sim.state.headDim,
      bytesPerElement: sim.state.bytesPerElement,
    };

    const sessions = sim.generateSessions();
    fillSessionSelector(sessions);
    const layerBuckets = sim.computeLayerBuckets(sim.state.layers);
    const headProfiles = sim.generateHeadProfiles();
    const promotedHeads = sim.determinePromotedHeads(headProfiles);
    const directory = sim.residency.buildDirectory(sessions, headProfiles, promotedHeads);
    const dmaState = sim.dma.buildQueue(directory, sessions);
    const routingState = sim.routing.buildRoutingTable(directory, promotedHeads, sessions);
    const speculativeState = sim.speculative.buildTrace(sessions);
    const timeline = sim.timeline.buildEvents(sessions, directory, dmaState, routingState, speculativeState, promotedHeads.map((head) => head.id));
    const benchmarkComparison = sim.benchmark.computeRuntimeBenchmark({
      model,
      policy: sim.state,
      directory,
      routing: routingState,
      promotedHeads,
    });
    const evictionComparison = sim.eviction.computeComparison(directory.entries, {
      promotions: dmaState.descriptors.length,
      misses: routingState.totalMisses,
      latency: routingState.averageLatency,
      dmaBytes: dmaState.totalBytes,
    });
    const sharedMetrics = sim.residency.computeSharedPrefixMetrics(directory);
    const architectureState = buildArchitectureState(directory, dmaState, routingState);

    sim.memory.lastRun = {
      model,
      sessions,
      layerBuckets,
      headProfiles,
      promotedHeads,
      directory,
      dma: dmaState,
      routing: routingState,
      speculative: speculativeState,
      timeline,
      benchmarkComparison,
      evictionComparison,
      sharedMetrics,
      architectureState,
    };
    sim.memory.timelineCursor = Math.min(sim.memory.timelineCursor, Math.max(0, timeline.length - 1));

    renderHeadProfiles(headProfiles);
    renderHeatmap(headProfiles, layerBuckets);
    renderEfficiency(model, promotedHeads);
    renderTimeline(timeline);
    renderDma(dmaState);
    renderRouting(routingState);
    renderSharedPrefix(sharedMetrics, sessions);
    renderDirectory(directory);
    renderSpeculative(speculativeState);
    renderArchitecture(architectureState);
    renderBenchmarkTable(evictionComparison, "evictionComparison");
    renderBenchmarkTable(benchmarkComparison, "benchmarkTable");
    updateSummary(sharedMetrics, routingState, dmaState, evictionComparison, benchmarkComparison);
  }

  function applyPreset(next) {
    Object.assign(sim.state, next);
    sim.memory.headEligibilityOverrides = [];
    sim.ensureHeadEligibility();
    syncControlValues();
    runSimulation();
  }

  function attachSharedPrefix(attached) {
    const sessionId = document.getElementById("selectedSession").value;
    if (!sessionId) {
      return;
    }
    sim.memory.sessionOverrides[sessionId] = sim.memory.sessionOverrides[sessionId] || {};
    sim.memory.sessionOverrides[sessionId].attachedSharedPrefix = attached;
    runSimulation();
  }

  function addSession() {
    sim.state.tenantCount = Math.min(12, sim.state.tenantCount + 1);
    syncControlValues();
    runSimulation();
  }

  function bindControls() {
    sim.rangeIds.forEach((id) => {
      const input = document.getElementById(id);
      input.addEventListener("input", () => {
        sim.state[id] = Number(input.value);
        runSimulation();
      });
    });

    sim.selectIds.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) {
        return;
      }
      input.addEventListener("change", () => {
        sim.state[id] = id === "bytesPerElement" || id === "timelineSpeed" ? Number(input.value) : input.value;
        runSimulation();
      });
    });

    document.getElementById("rerun").addEventListener("click", runSimulation);
    document.getElementById("presetConservative").addEventListener("click", () => {
      applyPreset({
        promotionGranularity: "per-head",
        evictionPolicy: "refcount-protected",
        promptLength: 18,
        decodeSteps: 12,
        tenantCount: 3,
        sharedPrefixLength: 4,
        promotedHeads: 2,
        promotedLayerStart: 20,
        promotedLayerEnd: 28,
        layerBoostMultiplier: 1.3,
        sramBudget: 6,
        dmaBandwidth: 72,
        dmaSlots: 2,
        draftTokens: 1,
        draftAcceptRate: 0.74,
      });
    });
    document.getElementById("presetAggressive").addEventListener("click", () => {
      applyPreset({
        promotionGranularity: "per-head-layer",
        evictionPolicy: "pinned-shared-prefix",
        promptLength: 24,
        decodeSteps: 20,
        tenantCount: 6,
        sharedPrefixLength: 6,
        promotedHeads: 4,
        promotedLayerStart: 12,
        promotedLayerEnd: 36,
        layerBoostMultiplier: 2.1,
        sramBudget: 12,
        dmaBandwidth: 144,
        dmaSlots: 4,
        draftTokens: 3,
        draftAcceptRate: 0.62,
      });
    });
    document.getElementById("playTimeline").addEventListener("click", () => sim.timeline.play(() => {
      renderTimeline(sim.memory.lastRun.timeline);
      renderDma(sim.memory.lastRun.dma);
      renderArchitecture(sim.memory.lastRun.architectureState);
    }));
    document.getElementById("pauseTimeline").addEventListener("click", () => {
      sim.timeline.pause();
      renderTimeline(sim.memory.lastRun.timeline);
      renderDma(sim.memory.lastRun.dma);
    });
    document.getElementById("stepTimeline").addEventListener("click", () => sim.timeline.step(() => {
      renderTimeline(sim.memory.lastRun.timeline);
      renderDma(sim.memory.lastRun.dma);
      renderArchitecture(sim.memory.lastRun.architectureState);
    }));
    document.getElementById("addSession").addEventListener("click", addSession);
    document.getElementById("attachShared").addEventListener("click", () => attachSharedPrefix(true));
    document.getElementById("detachShared").addEventListener("click", () => attachSharedPrefix(false));
    document.getElementById("generateSnapshot").addEventListener("click", () => sim.exporter.exportSnapshot());
  }

  sim.ensureHeadEligibility();
  bindControls();
  syncControlValues();
  runSimulation();
})();
