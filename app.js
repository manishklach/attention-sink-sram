(function () {
  const sim = window.AttentionSinkSim;
  const { formatNumber, bytesToHuman } = sim.utils;

  function getSelectText(id) {
    const el = document.getElementById(id);
    return el && el.selectedOptions.length ? el.selectedOptions[0].textContent : String(sim.state[id] || "");
  }

  function activeTimeline() {
    if (sim.memory.overrideTimeline) {
      return sim.memory.overrideTimeline;
    }
    return sim.memory.lastRun ? sim.memory.lastRun.timeline : [];
  }

  function syncControlValues() {
    sim.ensureLayerRange();
    document.getElementById("promotedHeads").max = String(sim.state.kvHeads);
    document.getElementById("promotedLayerStart").max = String(Math.max(0, sim.state.layers - 1));
    document.getElementById("promotedLayerEnd").max = String(Math.max(0, sim.state.layers - 1));
    document.getElementById("sharedPrefixLength").max = String(sim.state.promptLength);
    const pooledNodesInput = document.getElementById("pooledMemoryNodes");
    if (pooledNodesInput) {
      pooledNodesInput.max = String(Math.max(0, sim.state.deviceCount - 2));
      if (sim.state.pooledMemoryNodes > Number(pooledNodesInput.max)) {
        sim.state.pooledMemoryNodes = Number(pooledNodesInput.max);
      }
    }
    ["prefillNodes", "decodeNodes"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.max = String(sim.state.deviceCount);
        if (sim.state[id] > sim.state.deviceCount) {
          sim.state[id] = sim.state.deviceCount;
        }
      }
    });

    sim.rangeIds.forEach((id) => {
      const input = document.getElementById(id);
      const value = document.getElementById(`${id}Value`);
      if (!input || !value) {
        return;
      }
      input.value = sim.state[id];
      value.textContent = String(sim.state[id]);
      if (["layerBoostMultiplier", "sinkThreshold", "evictionThreshold", "emaAlpha", "draftAcceptRate", "remoteLatencyMultiplier"].includes(id)) {
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
      card.className = `timelineEvent ${index === cursor ? "active" : ""}`;
      card.style.left = `${(event.timestamp / maxTime) * 100}%`;
      card.innerHTML = `
        <div class="timelineStage">${event.stage}</div>
        <div class="timelineMeta">${event.sessionId} | t=${event.timestamp}</div>
      `;
      card.addEventListener("click", () => {
        sim.memory.timelineCursor = index;
        rerenderTimelineLinkedViews();
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
    const timeline = activeTimeline();
    const cursorEvent = timeline[sim.memory.timelineCursor];
    const time = cursorEvent ? cursorEvent.timestamp : 0;
    const active = dmaState.descriptors.filter((item) => item.startTime <= time && item.completionTime > time);
    const queued = dmaState.descriptors.filter((item) => item.enqueueTime > time || (item.enqueueTime <= time && item.startTime > time));
    const completed = dmaState.descriptors.filter((item) => item.completionTime <= time).slice(-8).reverse();

    document.getElementById("dmaUtilizationLabel").textContent = `${formatNumber(dmaState.utilization, 1)}%`;
    document.getElementById("dmaUtilizationBar").style.width = `${Math.min(100, dmaState.utilization)}%`;
    [
      ["dmaActive", active],
      ["dmaQueued", queued.slice(0, 8)],
      ["dmaCompleted", completed],
    ].forEach(([id, items]) => {
      const container = document.getElementById(id);
      container.innerHTML = items.length
        ? items.map((item) => `
          <div class="stackItem">
            <strong>${item.id}</strong>
            <span>${item.sessionId} | tokens ${item.tokenRange}</span>
            <span>${bytesToHuman(item.bytes)} | ${item.source} → ${item.destination}</span>
            <span>t${item.enqueueTime} to t${item.completionTime}</span>
          </div>
        `).join("")
        : `<div class="stackEmpty">No items</div>`;
    });
  }

  function renderRouting(routingState, tierState) {
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
      ${rows.map((row) => `
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
      `).join("")}
      <div class="routingFooter">Routing mix: SRAM ${formatNumber(tierState.tierHitRates.SRAM, 1)}% | HBM ${formatNumber(tierState.tierHitRates.HBM, 1)}% | Compressed ${formatNumber(tierState.tierHitRates["compressed-HBM"], 1)}%</div>
    `;
  }

  function renderDistributedTopology(topology, fabric) {
    document.getElementById("topologySummary").innerHTML = `
      <div class="sharedStat"><span>Devices</span><strong>${topology.nodes.length}</strong></div>
      <div class="sharedStat"><span>Links</span><strong>${topology.links.length}</strong></div>
      <div class="sharedStat"><span>Total SRAM</span><strong>${bytesToHuman(topology.summary.totalSram)}</strong></div>
      <div class="sharedStat"><span>Total HBM</span><strong>${bytesToHuman(topology.summary.totalHbm)}</strong></div>
      <div class="sharedStat"><span>Fabric utilization</span><strong>${formatNumber(fabric.utilization, 1)}%</strong></div>
      <div class="sharedStat"><span>Hotspots</span><strong>${fabric.hotspots}</strong></div>
    `;
    const svg = document.getElementById("topologySvg");
    const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));
    svg.innerHTML = `
      ${fabric.links.map((link) => {
        const from = nodeMap.get(link.from);
        const to = nodeMap.get(link.to);
        const stroke = link.failed ? "#aa4038" : link.saturated ? "#b56b36" : "#0e5f66";
        const width = 2 + Math.min(5, link.utilization / 28);
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${stroke}" stroke-width="${width}" opacity="0.7" />`;
      }).join("")}
      ${topology.nodes.map((node) => `
        <g class="topoNode">
          <circle cx="${node.x}" cy="${node.y}" r="34" fill="${node.type === "pooled memory node" ? "#dceff1" : node.type === "storage offload node" ? "#f7e8dc" : "#fff"}" stroke="#615a54" stroke-width="2" />
          <text x="${node.x}" y="${node.y - 4}" text-anchor="middle" font-size="12" font-weight="700">${node.id}</text>
          <text x="${node.x}" y="${node.y + 12}" text-anchor="middle" font-size="9">${node.type.replace(" memory node", "")}</text>
        </g>
      `).join("")}
    `;
  }

  function renderFabricAndDistributedRouting(fabric, distributedRouting) {
    document.getElementById("fabricSummary").innerHTML = `
      <div class="sharedStat"><span>Fabric type</span><strong>${sim.state.fabricType}</strong></div>
      <div class="sharedStat"><span>Multicast efficiency</span><strong>${formatNumber(fabric.multicastEfficiency * 100, 1)}%</strong></div>
      <div class="sharedStat"><span>Remote fetch rate</span><strong>${formatNumber(distributedRouting.remoteFetchRate, 1)}%</strong></div>
      <div class="sharedStat"><span>Pooled accesses</span><strong>${distributedRouting.pooledAccesses}</strong></div>
      <div class="sharedStat"><span>Escalations</span><strong>${distributedRouting.escalations}</strong></div>
      <div class="sharedStat"><span>Avg remote latency</span><strong>${formatNumber(distributedRouting.averageRemoteLatency, 1)}</strong></div>
    `;
    const rows = distributedRouting.rows.slice(0, 14);
    document.getElementById("distributedRoutingTable").innerHTML = `
      <div class="routingHeader">
        <span>Session</span>
        <span>Step</span>
        <span>Local device</span>
        <span>Target</span>
        <span>Hops</span>
        <span>Congested</span>
        <span>Latency</span>
        <span>Decision</span>
      </div>
      ${rows.map((row) => `
        <div class="routingRow ${row.decision.toLowerCase()}">
          <span>${row.sessionId}</span>
          <span>${row.step}</span>
          <span>${row.localDevice}</span>
          <span>${row.targetTier}</span>
          <span>${row.hops}</span>
          <span>${row.congested ? "yes" : "no"}</span>
          <span>${formatNumber(row.latency, 1)}</span>
          <span>${row.decision}</span>
        </div>
      `).join("")}
    `;
  }

  function renderPoolingAndScheduler(pooling, scheduler, migration) {
    document.getElementById("poolingPanel").innerHTML = `
      <div class="sharedStat"><span>Pooled nodes</span><strong>${pooling.pooledNodes.join(", ") || "none"}</strong></div>
      <div class="sharedStat"><span>Pool occupancy</span><strong>${formatNumber(pooling.occupancyPercent, 1)}%</strong></div>
      <div class="sharedStat"><span>Spill bytes</span><strong>${bytesToHuman(pooling.spillBytes)}</strong></div>
      <div class="sharedStat"><span>Remote amplification</span><strong>${formatNumber(pooling.remoteAccessAmplification, 2)}x</strong></div>
      <div class="sharedStat"><span>Pooled fragmentation</span><strong>${formatNumber(pooling.pooledFragmentation, 1)}%</strong></div>
      <div class="sharedStat"><span>Shared efficiency</span><strong>${formatNumber(pooling.sharedResidencyEfficiency, 2)}</strong></div>
    `;
    document.getElementById("schedulerPanel").innerHTML = `
      ${scheduler.decisions.slice(0, 8).map((decision) => `
        <div class="stackItem">
          <strong>${decision.sessionId}: ${decision.localDevice} → ${decision.targetDevice}</strong>
          <span>${decision.rationale}</span>
          <span>${decision.colocateSharedPrefix ? "Shared prefixes co-located." : "Shared prefixes may traverse fabric."}</span>
          <span>${decision.congestionMitigation}</span>
        </div>
      `).join("")}
      <div class="stackItem">
        <strong>Promotion waves</strong>
        <span>${migration.waves.length} active waves | ${bytesToHuman(migration.totalBytes)} moved</span>
        <span>Multicast bytes ${bytesToHuman(migration.multicastBytes)} | synchronized ${migration.synchronizedPromotions}</span>
      </div>
    `;
  }

  function renderEnergyAndEconomics(energy, economics) {
    document.getElementById("energyPanel").innerHTML = `
      <div class="sharedStat"><span>Energy per decode token</span><strong>${formatNumber(energy.energyPerDecodeToken, 2)}</strong></div>
      <div class="sharedStat"><span>Energy per tenant</span><strong>${formatNumber(energy.energyPerTenant, 2)}</strong></div>
      <div class="sharedStat"><span>SRAM energy</span><strong>${formatNumber(energy.sramAccessEnergy, 1)}</strong></div>
      <div class="sharedStat"><span>HBM energy</span><strong>${formatNumber(energy.hbmEnergy, 1)}</strong></div>
      <div class="sharedStat"><span>Remote fetch energy</span><strong>${formatNumber(energy.remoteFetchEnergy, 1)}</strong></div>
      <div class="sharedStat"><span>DMA energy</span><strong>${formatNumber(energy.dmaEnergy, 1)}</strong></div>
    `;
    document.getElementById("economicsPanel").innerHTML = `
      <div class="stackItem">
        <strong>Cluster cost model</strong>
        <span>Bandwidth cost ${formatNumber(economics.bandwidthCost, 2)}</span>
        <span>Memory cost ${formatNumber(economics.memoryCost, 2)}</span>
        <span>Fabric cost ${formatNumber(economics.fabricCost, 2)}</span>
      </div>
      <div class="stackItem">
        <strong>Efficiency</strong>
        <span>SRAM gain ${formatNumber(economics.sramEfficiencyGain, 2)}x</span>
        <span>Pooled memory efficiency ${formatNumber(economics.pooledMemoryEfficiency, 2)}</span>
        <span>Throughput per dollar ${formatNumber(economics.throughputPerDollar, 4)}</span>
      </div>
      ${economics.scalingCurve.slice(0, 3).map((point) => `
        <div class="stackItem">
          <strong>${point.devices} devices</strong>
          <span>Throughput/$ ${formatNumber(point.throughputPerDollar, 4)}</span>
          <span>Remote penalty ${formatNumber(point.remotePenalty, 1)}%</span>
        </div>
      `).join("")}
    `;
  }

  function renderThesisMode(snapshot) {
    const panel = document.getElementById("thesisModePanel");
    const button = document.getElementById("toggleThesisMode");
    const progress = document.getElementById("thesisProgress");
    const callouts = document.getElementById("thesisCallouts");
    document.querySelectorAll(".thesisFocus").forEach((el) => el.classList.remove("thesisFocus"));

    if (!sim.memory.thesisModeActive) {
      panel.classList.add("thesisMuted");
      button.textContent = "Enable Thesis Mode";
      progress.innerHTML = `<div class="sharedStat"><span>Mode</span><strong>Off</strong></div>`;
      callouts.innerHTML = `<div class="stackEmpty">Enable Thesis Mode to walk through the architecture thesis.</div>`;
      return;
    }

    panel.classList.remove("thesisMuted");
    button.textContent = "Disable Thesis Mode";
    const step = sim.thesis.current();
    progress.innerHTML = `
      <div class="sharedStat"><span>Step</span><strong>${sim.memory.thesisStep + 1} / ${sim.thesis.steps.length}</strong></div>
      <div class="sharedStat"><span>Thesis</span><strong>${step.title}</strong></div>
      <div class="sharedStat"><span>Claim</span><strong>${step.targets.length} architectural surfaces</strong></div>
    `;
    callouts.innerHTML = `
      <div class="stackItem">
        <strong>${step.title}</strong>
        <span>${step.body}</span>
      </div>
      <div class="stackItem">
        <strong>Design principle</strong>
        <span>${[
          "Deterministic execution over opportunistic caching.",
          "Promotion is treated as scheduling rather than a passive cache reaction.",
          "Compiler planning and runtime adaptation cooperate inside bounded legality windows.",
          "Replay-safe decode windows constrain when state may change.",
          "Topology and fabric costs are part of the memory model.",
          "Memory follows an explicit lifecycle with visible legality boundaries.",
        ][sim.memory.thesisStep]}</span>
      </div>
      ${step.callouts.map((item) => `<div class="stackItem"><span>${item}</span></div>`).join("")}
    `;
    step.targets.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        (el.closest(".panel") || el).classList.add("thesisFocus");
      }
    });
  }

  function renderFormalDiagrams(snapshot) {
    const currentStep = sim.memory.thesisStep;
    document.getElementById("formalExportSummary").innerHTML = `
      <div class="sharedStat"><span>Execution regions</span><strong>${snapshot.compilerPlan.regions.length}</strong></div>
      <div class="sharedStat"><span>Lifecycle phases</span><strong>11</strong></div>
      <div class="sharedStat"><span>Replay checkpoints</span><strong>${snapshot.compilerPlan.checkpoints.length}</strong></div>
      <div class="sharedStat"><span>Residency epochs</span><strong>${snapshot.orchestrator.windows.length}</strong></div>
    `;

    const executionSvg = document.getElementById("executionModelSvg");
    executionSvg.innerHTML = `
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(14, 95, 102, 0.55)"></path>
        </marker>
      </defs>
      <text x="30" y="36" class="archTitle">Execution model: bounded regions with replay checkpoints and adaptation barriers</text>
      ${snapshot.compilerPlan.regions.map((region, index) => {
      const x = 30 + index * 285;
      return `
        <g class="archBlock ${sim.memory.thesisModeActive && currentStep === Math.min(3, index + 2) ? "active" : ""}">
          <rect x="${x}" y="66" width="240" height="82" rx="18"></rect>
          <text x="${x + 16}" y="96">${region.name}</text>
          <text x="${x + 16}" y="118" class="archSub">${region.type}</text>
          <text x="${x + 16}" y="138" class="archSub">window ${region.start}-${region.end}</text>
        </g>
        ${index < snapshot.compilerPlan.regions.length - 1 ? `<line class="archLine" x1="${x + 240}" y1="107" x2="${x + 285}" y2="107" marker-end="url(#arrow)"></line>` : ""}
      `;
    }).join("")}
      <text x="30" y="196" class="archCaption">Compile-time planning defines regions; runtime adaptation stays inside explicit barriers.</text>
    `;

    const phases = [
      "creation",
      "observation",
      "classification",
      "promotion",
      "residency",
      "replay protection",
      "sharing",
      "migration",
      "compression",
      "eviction",
      "reclamation",
    ];
    const lifecycleSvg = document.getElementById("lifecycleSvg");
    lifecycleSvg.innerHTML = `
      <defs>
        <marker id="arrowLifecycle" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(139, 74, 46, 0.55)"></path>
        </marker>
      </defs>
      <text x="18" y="36" class="archTitle">Memory lifecycle: explicit state transitions instead of implicit cache churn</text>
      ${phases.map((phase, index) => {
      const x = 18 + index * 106;
      return `
        <g class="archBlock ${sim.memory.thesisModeActive && currentStep === 5 ? "active" : ""}">
          <rect x="${x}" y="82" width="94" height="62" rx="16"></rect>
          <text x="${x + 10}" y="112" font-size="11">${phase}</text>
        </g>
        ${index < phases.length - 1 ? `<line class="archLine warm" x1="${x + 94}" y1="113" x2="${x + 106}" y2="113" marker-end="url(#arrowLifecycle)"></line>` : ""}
      `;
    }).join("")}
      <text x="18" y="190" class="archCaption">Promotion, sharing, migration, and reclamation are modeled as legal lifecycle transitions.</text>
    `;
  }

  function createSeededRng(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return function rng() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function buildAlgorithmDemo(model) {
    const algorithmConfig = {
      layers: Math.min(8, Math.max(4, Math.floor(sim.state.layers / 10))),
      heads: Math.min(8, sim.state.kvHeads),
      sequenceLength: Math.min(128, Math.max(48, sim.state.promptLength + sim.state.decodeSteps + 24)),
      sinkTokenIds: Array.from({ length: Math.min(4, Math.max(2, sim.state.sharedPrefixLength)) }, (_, index) => index),
      sinkStrength: Math.min(0.8, Math.max(0.2, sim.state.sinkStrength * 0.5)),
      localWindow: Math.min(24, Math.max(8, sim.state.sharedPrefixLength * 3)),
      retrievalSpikeProbability: 0.08,
      seed: sim.state.seed,
    };
    const attention = sim.core.attentionGenerator.generateAttentionTensor(algorithmConfig);
    const selectedStart = Math.floor((sim.state.promotedLayerStart / Math.max(1, sim.state.layers - 1)) * (algorithmConfig.layers - 1));
    const selectedEnd = Math.floor((sim.state.promotedLayerEnd / Math.max(1, sim.state.layers - 1)) * (algorithmConfig.layers - 1));
    const layerWeights = Array.from({ length: algorithmConfig.layers }, (_, layer) => (
      layer >= selectedStart && layer <= selectedEnd ? sim.state.layerBoostMultiplier : 1
    ));
    const headWeights = attention.headProfiles.map((profile, index) => (
      sim.memory.headEligibilityOverrides[index % sim.memory.headEligibilityOverrides.length] ? 1.1 : 1
    ));
    const sinkResult = sim.core.sinkScore.computeSinkScores(attention.tensor, {
      layerWeights,
      headWeights,
      threshold: sim.state.sinkThreshold,
      normalizationMode: "raw",
      emaAlpha: sim.state.emaAlpha,
    });
    const emaResult = sim.core.sinkScore.computeSinkScores(attention.tensor, {
      layerWeights,
      headWeights,
      threshold: sim.state.sinkThreshold,
      normalizationMode: "ema-smoothed",
      emaAlpha: sim.state.emaAlpha,
    });
    const rankedTokens = sinkResult.rankedTokens.slice(0, 12);
    const promotedTokenIds = sinkResult.sinkTokens
      .slice(0, Math.max(2, Math.min(sim.state.sramBudget, 8)))
      .map((entry) => entry.tokenId);
    const topTokenId = rankedTokens[0] ? rankedTokens[0].tokenId : 0;
    const breakdown = sim.core.sinkScore.computeSinkScoreBreakdown(attention.tensor, topTokenId, {
      layerWeights,
      headWeights,
      normalizationMode: "raw",
      emaAlpha: sim.state.emaAlpha,
    });

    const rng = createSeededRng(sim.state.seed + 17);
    const dim = Math.min(16, Math.max(8, Math.floor(model.headDim / 8)));
    const Q = Array.from({ length: dim }, () => (rng() * 2) - 1);
    const K = Array.from({ length: algorithmConfig.sequenceLength }, (_, tokenId) => (
      Array.from({ length: dim }, (_, axis) => {
        const sinkBias = promotedTokenIds.includes(tokenId) ? 0.45 : 0.08;
        return ((rng() * 2) - 1) + sinkBias * Math.cos((axis + 1) * (tokenId + 1));
      })
    ));
    const V = Array.from({ length: algorithmConfig.sequenceLength }, (_, tokenId) => (
      Array.from({ length: dim }, (_, axis) => ((rng() * 2) - 1) + (promotedTokenIds.includes(tokenId) ? 0.25 : 0) + axis * 0.01)
    ));
    const sinkPartition = promotedTokenIds.length ? promotedTokenIds.slice() : rankedTokens.slice(0, 4).map((entry) => entry.tokenId);
    const bulkPartition = Array.from({ length: algorithmConfig.sequenceLength }, (_, tokenId) => tokenId).filter((tokenId) => !sinkPartition.includes(tokenId));
    const mergeVerification = sim.core.merge.verifyMergeAgainstFullAttention(Q, K, V, [sinkPartition, bulkPartition]);

    return {
      config: algorithmConfig,
      attentionSummary: attention.summary,
      attentionValidation: attention.validation,
      attentionTensor: attention.tensor,
      headProfiles: attention.headProfiles,
      sinkScores: sinkResult,
      emaSinkScores: emaResult,
      sinkBreakdown: breakdown,
      promotionDecision: {
        threshold: sim.state.sinkThreshold,
        promotedTokenIds: sinkPartition,
        sinkPartition,
        bulkPartition,
      },
      mergeVerification,
    };
  }

  function renderCoreAlgorithmDemo(algorithmDemo) {
    const summary = document.getElementById("algorithmSummary");
    const topSink = algorithmDemo.sinkScores.rankedTokens[0];
    summary.innerHTML = `
      <div class="sharedStat"><span>Tensor validation</span><strong>${algorithmDemo.attentionValidation.valid ? "Valid" : "Invalid"}</strong></div>
      <div class="sharedStat"><span>Top sink token</span><strong>${topSink ? topSink.tokenId : "n/a"}</strong></div>
      <div class="sharedStat"><span>Promoted sinks</span><strong>${algorithmDemo.promotionDecision.promotedTokenIds.length}</strong></div>
      <div class="sharedStat"><span>Merge status</span><strong>${algorithmDemo.mergeVerification.passed ? "PASS" : "FAIL"}</strong></div>
    `;

    document.getElementById("attentionTensorSummary").innerHTML = `
      <div class="stackItem">
        <strong>Generator configuration</strong>
        <span>${algorithmDemo.config.layers} layers · ${algorithmDemo.config.heads} heads · ${algorithmDemo.config.sequenceLength} tokens</span>
        <span>sink tokens [${algorithmDemo.config.sinkTokenIds.join(", ")}], sink strength ${formatNumber(algorithmDemo.config.sinkStrength, 2)}</span>
      </div>
      <div class="stackItem">
        <strong>Validation</strong>
        <span>row deviation ${algorithmDemo.attentionValidation.maxRowDeviation.toExponential(2)}</span>
        <span>causal violations ${algorithmDemo.attentionValidation.causalViolations}</span>
      </div>
      <div class="stackItem">
        <strong>Attention patterns</strong>
        <span>top tokens ${algorithmDemo.attentionSummary.topTokens.slice(0, 5).map((entry) => `${entry.tokenId}:${formatNumber(entry.score, 2)}`).join(" | ")}</span>
      </div>
    `;

    document.getElementById("sinkScoreSummary").innerHTML = `
      <div class="stackItem">
        <strong>Cumulative sink score</strong>
        <span>S(t) = Σ_l Σ_h Σ_i A(l,h,i,t)</span>
        <span>normalization mode ${algorithmDemo.sinkScores.normalizationMode}</span>
      </div>
      <div class="stackItem">
        <strong>Top-token breakdown</strong>
        <span>token ${algorithmDemo.sinkBreakdown.tokenId} raw score ${formatNumber(algorithmDemo.sinkBreakdown.score, 4)}</span>
        <span>top layer contributions ${algorithmDemo.sinkBreakdown.byLayer.slice().sort((a, b) => b.contribution - a.contribution).slice(0, 3).map((entry) => `L${entry.layer}:${formatNumber(entry.contribution, 3)}`).join(" | ")}</span>
        <span>top head contributions ${algorithmDemo.sinkBreakdown.byHead.slice().sort((a, b) => b.contribution - a.contribution).slice(0, 3).map((entry) => `H${entry.head}:${formatNumber(entry.contribution, 3)}`).join(" | ")}</span>
      </div>
      <div class="stackItem">
        <strong>EMA-smoothed comparison</strong>
        <span>top EMA token ${algorithmDemo.emaSinkScores.rankedTokens[0]?.tokenId ?? "n/a"} score ${formatNumber(algorithmDemo.emaSinkScores.rankedTokens[0]?.score ?? 0, 4)}</span>
      </div>
    `;

    document.getElementById("sinkRankingTable").innerHTML = algorithmDemo.sinkScores.rankedTokens.slice(0, 8).map((entry, index) => `
      <div class="stackItem">
        <strong>#${index + 1} token ${entry.tokenId}</strong>
        <span>score ${formatNumber(entry.score, 4)}</span>
        <span>${algorithmDemo.sinkScores.sinkTokens.some((sink) => sink.tokenId === entry.tokenId) ? "classified as sink" : "below threshold"}</span>
      </div>
    `).join("");

    document.getElementById("promotionDecision").innerHTML = `
      <div class="stackItem">
        <strong>Threshold classification</strong>
        <span>threshold ${formatNumber(algorithmDemo.promotionDecision.threshold, 2)} of max score</span>
        <span>${algorithmDemo.sinkScores.sinkTokens.length} tokens exceed threshold</span>
      </div>
      <div class="stackItem">
        <strong>SRAM promotion set</strong>
        <span>sink partition [${algorithmDemo.promotionDecision.sinkPartition.join(", ")}]</span>
        <span>bulk partition size ${algorithmDemo.promotionDecision.bulkPartition.length}</span>
      </div>
    `;

    document.getElementById("mergeVerification").innerHTML = `
      <div class="stackItem">
        <strong>Split-path merge</strong>
        <span>sink partition ${algorithmDemo.promotionDecision.sinkPartition.length} tokens</span>
        <span>bulk partition ${algorithmDemo.promotionDecision.bulkPartition.length} tokens</span>
      </div>
      <div class="stackItem">
        <strong>Reference vs merged</strong>
        <span>merged lse ${formatNumber(algorithmDemo.mergeVerification.mergedLSE, 6)}</span>
        <span>reference lse ${formatNumber(algorithmDemo.mergeVerification.referenceLSE, 6)}</span>
      </div>
      <div class="stackItem">
        <strong>Merged output preview</strong>
        <span>${algorithmDemo.mergeVerification.mergedOutput.slice(0, 5).map((value) => formatNumber(value, 6)).join(", ")}</span>
      </div>
    `;

    document.getElementById("mergeErrorSummary").innerHTML = `
      <div class="stackItem">
        <strong>Numerical verification</strong>
        <span class="${algorithmDemo.mergeVerification.passed ? "goodText" : "dangerText"}">${algorithmDemo.mergeVerification.passed ? "PASS" : "FAIL"}</span>
        <span>max abs error ${algorithmDemo.mergeVerification.maxAbsError.toExponential(2)}</span>
        <span>mean abs error ${algorithmDemo.mergeVerification.meanAbsError.toExponential(2)}</span>
      </div>
    `;
  }

  function renderAbi(abi) {
    document.getElementById("abiSummary").innerHTML = `
      <div class="sharedStat"><span>ABI mode</span><strong>${abi.mode}</strong></div>
      <div class="sharedStat"><span>Handles</span><strong>${abi.handles.length}</strong></div>
      <div class="sharedStat"><span>Commands</span><strong>${abi.commands.length}</strong></div>
    `;
    document.getElementById("abiTable").innerHTML = `
      <div class="directoryHeader">
        <span>Handle</span><span>Type</span><span>Tier</span><span>Contract</span><span>VAddr</span><span>Placement</span><span>Flags</span><span>Replay</span><span></span>
      </div>
      ${abi.handles.map((handle) => `
        <div class="directoryRow">
          <span>${handle.handleId}</span>
          <span>${handle.objectType}</span>
          <span>${handle.residencyTier}</span>
          <span>${handle.residencyContract}</span>
          <span>${handle.virtualAddress}</span>
          <span>${handle.physicalPlacement}</span>
          <span>${handle.schedulingFlags}</span>
          <span>${handle.replayFlags}</span>
          <span></span>
        </div>
      `).join("")}
    `;
  }

  function renderPaging(paging) {
    document.getElementById("pagingSummary").innerHTML = `
      <div class="sharedStat"><span>Layout mode</span><strong>${paging.mode}</strong></div>
      <div class="sharedStat"><span>Virtual pages</span><strong>${paging.totalVirtualPages}</strong></div>
      <div class="sharedStat"><span>Page bytes</span><strong>${bytesToHuman(paging.pageBytes)}</strong></div>
      <div class="sharedStat"><span>Remaps</span><strong>${paging.remapCount}</strong></div>
    `;
    document.getElementById("pagingTable").innerHTML = `
      <div class="directoryHeader">
        <span>Page</span><span>Logical</span><span>VAddr</span><span>Placement</span><span>Residency</span><span>Migratable</span><span></span><span></span><span></span>
      </div>
      ${paging.pageTable.slice(0, 12).map((page) => `
        <div class="directoryRow">
          <span>${page.pageId}</span>
          <span>${page.logicalRange}</span>
          <span>${page.virtualAddress}</span>
          <span>${page.physicalPlacement}</span>
          <span>${page.residency}</span>
          <span>${page.migratable ? "yes" : "no"}</span>
          <span></span><span></span><span></span>
        </div>
      `).join("")}
    `;
  }

  function renderCompilerPlan(plan) {
    document.getElementById("compilerPlanSummary").innerHTML = `
      <div class="sharedStat"><span>Planning mode</span><strong>${plan.mode}</strong></div>
      <div class="sharedStat"><span>Execution regions</span><strong>${plan.regions.length}</strong></div>
      <div class="sharedStat"><span>Checkpoints</span><strong>${plan.checkpoints.length}</strong></div>
      <div class="sharedStat"><span>DMA schedule entries</span><strong>${plan.dmaSchedule.length}</strong></div>
    `;
    const svg = document.getElementById("compilerPlanSvg");
    svg.innerHTML = plan.planNodes.map((node, index) => {
      const x = 40 + index * 270;
      return `
        <g class="archBlock">
          <rect x="${x}" y="70" width="220" height="90" rx="18"></rect>
          <text x="${x + 16}" y="100">${node.name}</text>
          <text x="${x + 16}" y="122" class="archSub">${node.type} | ${node.residency}</text>
          <text x="${x + 16}" y="144" class="archSub">t${node.start} - t${node.end}</text>
        </g>
        ${index < plan.planNodes.length - 1 ? `<line class="archLine" x1="${x + 220}" y1="115" x2="${x + 270}" y2="115" marker-end="url(#arrow)"></line>` : ""}
      `;
    }).join("");
  }

  function renderLaunch(launch) {
    document.getElementById("launchSummary").innerHTML = `
      <div class="sharedStat"><span>Graph mode</span><strong>${launch.mode}</strong></div>
      <div class="sharedStat"><span>Graph reuse</span><strong>${launch.graphReuse}</strong></div>
      <div class="sharedStat"><span>Invalidations</span><strong>${launch.graphInvalidations}</strong></div>
      <div class="sharedStat"><span>Dynamic fallbacks</span><strong>${launch.dynamicFallbacks}</strong></div>
    `;
    document.getElementById("launchTable").innerHTML = launch.launches.map((row) => `
      <div class="stackItem">
        <strong>Wave ${row.wave}: ${row.attentionKernel} + ${row.decodeKernel}</strong>
        <span>${row.dmaOverlap ? "DMA overlap enabled" : "DMA overlap disabled"} | barrier ${row.barrier}</span>
        <span>Orchestration bubble ${row.bubbleCost}</span>
      </div>
    `).join("");
  }

  function renderIntegration(integration) {
    document.getElementById("integrationSummary").innerHTML = `
      <div class="sharedStat"><span>Prefill nodes</span><strong>${integration.prefillNodes.join(", ")}</strong></div>
      <div class="sharedStat"><span>Decode nodes</span><strong>${integration.decodeNodes.join(", ")}</strong></div>
      <div class="sharedStat"><span>KV transfer cost</span><strong>${formatNumber(integration.kvTransferCost, 1)}</strong></div>
      <div class="sharedStat"><span>Migration amplification</span><strong>${formatNumber(integration.migrationAmplification, 2)}x</strong></div>
      <div class="sharedStat"><span>Replay stability</span><strong>${formatNumber(integration.replayStability, 1)}%</strong></div>
    `;
    document.getElementById("integrationStack").innerHTML = integration.stackLayers.map((layer, index) => `
      <div class="stackItem">
        <strong>${index + 1}. ${layer}</strong>
        <span>${index === 0 ? "Compile execution regions and residency plans." : index === 1 ? "Issue orchestration commands and ABI transitions." : index === 2 ? "Place decode and prefill work." : "Coordinate dataflow through the stack."}</span>
      </div>
    `).join("");
  }

  function renderLifetimes(lifetimes) {
    document.getElementById("lifetimeSummary").innerHTML = `
      <div class="sharedStat"><span>Lifetime rows</span><strong>${lifetimes.rows.length}</strong></div>
      <div class="sharedStat"><span>Replay-safe rows</span><strong>${lifetimes.replaySafeRows}</strong></div>
      <div class="sharedStat"><span>Reclaim hazards</span><strong>${lifetimes.reclaimHazards}</strong></div>
    `;
    document.getElementById("lifetimeTable").innerHTML = `
      <div class="directoryHeader">
        <span>Entry</span><span>Create</span><span>Active until</span><span>Replay-safe</span><span>Reclaim</span><span>Spec invalid</span><span>Migratable</span><span></span><span></span>
      </div>
      ${lifetimes.rows.map((row) => `
        <div class="directoryRow">
          <span>${row.entryId}</span>
          <span>${row.createdAt}</span>
          <span>${row.activeUntil}</span>
          <span>${row.replaySafeUntil}</span>
          <span>${row.reclaimEligibleAt}</span>
          <span>${row.speculativeInvalidation ? "yes" : "no"}</span>
          <span>${row.migrationEligible ? "yes" : "no"}</span>
          <span></span><span></span>
        </div>
      `).join("")}
    `;
  }

  function renderSharedPrefix(sharedMetrics, sessions) {
    document.getElementById("sharedPrefixPanel").innerHTML = `
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
      ${entries.map((entry) => {
        const flags = [entry.shared ? "shared" : "", entry.pinned ? "pinned" : "", entry.evicting ? "evicting" : "", entry.stale ? "stale" : "", entry.tier === "SRAM" ? "promoted" : ""].filter(Boolean).join(", ");
        const classNames = ["directoryRow", entry.shared ? "shared" : "", entry.pinned ? "pinned" : "", entry.evicting ? "evicting" : "", entry.stale ? "stale" : "", entry.tier === "SRAM" ? "promoted" : ""].filter(Boolean).join(" ");
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
      }).join("")}
    `;
  }

  function renderSpeculative(trace) {
    const preview = trace.rows.slice(0, 10);
    document.getElementById("speculativePanel").innerHTML = `
      <div class="specSummary">
        <div class="sharedStat"><span>Rollback frequency</span><strong>${trace.rollbackCount}</strong></div>
        <div class="sharedStat"><span>Wasted DMA bytes</span><strong>${bytesToHuman(trace.wastedBytes)}</strong></div>
        <div class="sharedStat"><span>Reclaimed SRAM</span><strong>${bytesToHuman(trace.reclaimedBytes)}</strong></div>
        <div class="sharedStat"><span>Stable sink retention</span><strong>${bytesToHuman(trace.stableRetention)}</strong></div>
      </div>
      <div class="specList">
        ${preview.map((row) => `
          <div class="specRow ${row.rejected > 0 ? "rollback" : "stable"}">
            <strong>${row.sessionId} step ${row.step}</strong>
            <span>Draft ${row.draftTokens}</span>
            <span>Accepted ${row.accepted}</span>
            <span>Rejected ${row.rejected}</span>
            <span>Reclaimed ${bytesToHuman(row.reclaimedBytes)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderOrchestratorState(orchestrator) {
    document.getElementById("orchestratorState").innerHTML = `
      <div class="sharedStat"><span>Active sessions</span><strong>${orchestrator.activeSessions}</strong></div>
      <div class="sharedStat"><span>Total SRAM used</span><strong>${bytesToHuman(orchestrator.totalSramUsed)}</strong></div>
      <div class="sharedStat"><span>DMA utilization</span><strong>${formatNumber(orchestrator.dmaUtilization, 1)}%</strong></div>
      <div class="sharedStat"><span>Pending promotions</span><strong>${orchestrator.pendingPromotions}</strong></div>
      <div class="sharedStat"><span>Decode queue depth</span><strong>${orchestrator.decodeQueueDepth}</strong></div>
      <div class="sharedStat"><span>Rollback pressure</span><strong>${formatNumber(orchestrator.rollbackPressure, 1)}</strong></div>
      <div class="sharedStat"><span>Residency pressure</span><strong>${formatNumber(orchestrator.residencyPressure, 1)}%</strong></div>
      <div class="sharedStat"><span>Promotion churn</span><strong>${orchestrator.promotionChurn}</strong></div>
      <div class="sharedStat"><span>Execution stability</span><strong>${formatNumber(orchestrator.executionStability, 1)}%</strong></div>
      <div class="sharedStat"><span>Policy</span><strong>${sim.state.executionPolicy}</strong></div>
    `;
  }

  function renderExecutionWindows(orchestrator) {
    document.getElementById("executionWindows").innerHTML = `
      <div class="windowsSummary">
        <div class="sharedStat"><span>Deterministic decode hit rate</span><strong>${formatNumber(orchestrator.deterministicDecodeHitRate, 1)}%</strong></div>
        <div class="sharedStat"><span>Residency volatility</span><strong>${formatNumber(orchestrator.residencyVolatility, 1)}%</strong></div>
        <div class="sharedStat"><span>Stable windows</span><strong>${formatNumber(orchestrator.executionWindowStability * 100, 1)}%</strong></div>
      </div>
      <div class="windowBars">
        ${orchestrator.windows.map((window) => `
          <div class="windowBar ${window.stable ? "stable" : "unstable"}">
            <strong>${window.id}</strong>
            <span>${window.start}-${window.end}</span>
            <span>Guarantee ${formatNumber(window.guarantee * 100, 1)}%</span>
            <span>Pinned ${window.pinnedEntries}</span>
            <span>Risk ${window.risk}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderPartitions(partitions) {
    document.getElementById("partitionPanel").innerHTML = `
      <div class="sharedStat"><span>Total budget</span><strong>${bytesToHuman(partitions.totalBudgetBytes)}</strong></div>
      <div class="sharedStat"><span>Shared reserved pool</span><strong>${bytesToHuman(partitions.sharedReserved)}</strong></div>
      <div class="partitionBars">
        ${partitions.allocations.map((allocation) => {
          const utilization = allocation.allocatedBytes > 0 ? (allocation.usedBytes / allocation.allocatedBytes) * 100 : 0;
          return `
            <div class="partitionCard ${allocation.oversubscribed ? "oversubscribed" : ""} ${allocation.starvationRisk ? "starved" : ""}">
              <strong>${allocation.sessionId}</strong>
              <span>Allocated ${bytesToHuman(allocation.allocatedBytes)}</span>
              <span>Used ${bytesToHuman(allocation.usedBytes)}</span>
              <span>Wasted ${bytesToHuman(allocation.wastedBytes)}</span>
              <span>Utilization ${formatNumber(utilization, 1)}%</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderTierPanel(tierState) {
    document.getElementById("tierPanel").innerHTML = tierState.tiers.map((tier) => `
      <div class="tierCard">
        <strong>${tier.id}</strong>
        <span>Latency ${formatNumber(tier.latency, 1)}</span>
        <span>Bandwidth ${formatNumber(tier.bandwidth, 1)}</span>
        <span>Capacity ${bytesToHuman(tier.capacity)}</span>
        <span>Energy ${formatNumber(tier.energyCost, 1)}</span>
        <span>Hit rate ${formatNumber(tierState.tierHitRates[tier.id] || 0, 1)}%</span>
        <span>Traffic ${bytesToHuman(tierState.traffic[tier.id] || 0)}</span>
      </div>
    `).join("");
  }

  function renderCompressionPanel(compressionState) {
    document.getElementById("compressionPanel").innerHTML = `
      <div class="sharedStat"><span>Compression mode</span><strong>${compressionState.mode}</strong></div>
      <div class="sharedStat"><span>Compression ratio</span><strong>${formatNumber(compressionState.ratio, 2)}x raw</strong></div>
      <div class="sharedStat"><span>Effective capacity gain</span><strong>${formatNumber(compressionState.effectiveCapacityGain, 2)}x</strong></div>
      <div class="sharedStat"><span>Decompression latency</span><strong>${formatNumber(compressionState.decompressionLatency, 1)}</strong></div>
      <div class="sharedStat"><span>Bandwidth savings</span><strong>${bytesToHuman(compressionState.bandwidthSavings)}</strong></div>
      <div class="sharedStat"><span>Compressed regions</span><strong>${bytesToHuman(compressionState.compressedBytes)}</strong></div>
      <div class="sharedStat"><span>Decompression events</span><strong>${compressionState.decompressionEvents}</strong></div>
    `;
  }

  function renderFragmentation(fragmentationState) {
    document.getElementById("fragmentationSummary").innerHTML = `
      <div class="sharedStat"><span>Fragmentation</span><strong>${formatNumber(fragmentationState.fragmentationPercent, 1)}%</strong></div>
      <div class="sharedStat"><span>Compaction overhead</span><strong>${formatNumber(fragmentationState.compactionOverhead, 1)}</strong></div>
      <div class="sharedStat"><span>Relocation traffic</span><strong>${bytesToHuman(fragmentationState.relocationTraffic)}</strong></div>
      <div class="sharedStat"><span>Failed placements</span><strong>${fragmentationState.failedPlacements}</strong></div>
    `;
    document.getElementById("fragmentationMap").innerHTML = fragmentationState.blocks.map((block) => `
      <div class="fragBlock ${block.status}">
        <span>${block.index}</span>
        <small>${block.sessionId || "-"}</small>
      </div>
    `).join("");
  }

  function renderTelemetry(telemetry, metricsSummary) {
    document.getElementById("telemetryCards").innerHTML = `
      <div class="sharedStat" title="${sim.metrics.definitions.executionStability}"><span>Execution stability</span><strong>${formatNumber(metricsSummary.executionStability, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.residencyHalfLife}"><span>Residency half-life</span><strong>${formatNumber(metricsSummary.residencyHalfLife, 1)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.effectiveSramAmplification}"><span>SRAM amplification</span><strong>${formatNumber(metricsSummary.effectiveSramAmplification, 2)}x</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.promotionEntropy}"><span>Promotion entropy</span><strong>${formatNumber(metricsSummary.promotionEntropy, 2)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.routingDeterminism}"><span>Routing determinism</span><strong>${formatNumber(metricsSummary.routingDeterminism, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.dmaEfficiency}"><span>DMA efficiency</span><strong>${formatNumber(metricsSummary.dmaEfficiency, 6)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.speculativeWasteFactor}"><span>Speculative waste</span><strong>${formatNumber(metricsSummary.speculativeWasteFactor * 100, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.residencyVolatility}"><span>Residency volatility</span><strong>${formatNumber(metricsSummary.residencyVolatility, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.decodeStallProbability}"><span>Decode stall probability</span><strong>${formatNumber(metricsSummary.decodeStallProbability, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.multiTenantReuseEfficiency}"><span>Reuse efficiency</span><strong>${formatNumber(metricsSummary.multiTenantReuseEfficiency, 2)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.compactionOverhead}"><span>Compaction overhead</span><strong>${formatNumber(metricsSummary.compactionOverhead, 1)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.effectiveBandwidthSaved}"><span>Bandwidth saved</span><strong>${bytesToHuman(metricsSummary.effectiveBandwidthSaved)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.remoteFetchRate}"><span>Remote fetch rate</span><strong>${formatNumber(metricsSummary.remoteFetchRate, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.fabricUtilization}"><span>Fabric utilization</span><strong>${formatNumber(metricsSummary.fabricUtilization, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.clusterResidencyStability}"><span>Cluster residency stability</span><strong>${formatNumber(metricsSummary.clusterResidencyStability, 1)}%</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.energyPerDecodeToken}"><span>Energy / decode token</span><strong>${formatNumber(metricsSummary.energyPerDecodeToken, 2)}</strong></div>
      <div class="sharedStat" title="${sim.metrics.definitions.throughputPerDollar}"><span>Throughput / $</span><strong>${formatNumber(metricsSummary.throughputPerDollar, 4)}</strong></div>
    `;
    const history = telemetry.history;
    sim.graphs.renderSeries("telemetrySvg", "Rolling Telemetry", [
      { label: "SRAM hit rate", points: history.map((point, index) => ({ x: index, value: point.sramHitRate })) },
      { label: "DMA queue occupancy", points: history.map((point, index) => ({ x: index, value: point.dmaQueueOccupancy * 10 })) },
      { label: "Rollback rate", points: history.map((point, index) => ({ x: index, value: point.rollbackRate * 100 })) },
      { label: "Deterministic decode", points: history.map((point, index) => ({ x: index, value: point.deterministicDecode })) },
      { label: "Remote fetch rate", points: history.map((point, index) => ({ x: index, value: point.remoteFetchRate })) },
      { label: "Fabric utilization", points: history.map((point, index) => ({ x: index, value: point.fabricUtilization })) },
    ], "Rolling metrics");
  }

  function renderArchitecture(architectureState) {
    const svg = document.getElementById("architectureSvg");
    const activeEvent = activeTimeline()[sim.memory.timelineCursor];
    const activeStage = activeEvent ? activeEvent.stage : "";
    const blocks = [
      { key: "tokenizer", label: "Tokenizer", x: 24, y: 44 },
      { key: "prefill", label: "Prefill engine", x: 160, y: 44 },
      { key: "detector", label: "Sink detector", x: 316, y: 44 },
      { key: "orchestrator", label: "Orchestration controller", x: 472, y: 44 },
      { key: "dma", label: "DMA scheduler", x: 664, y: 44 },
      { key: "sram", label: "SRAM cache", x: 840, y: 44 },
      { key: "hbm", label: "HBM KV store", x: 1000, y: 44 },
      { key: "router", label: "Decode router", x: 1130, y: 44 },
      { key: "eviction", label: "Eviction manager", x: 428, y: 182 },
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
    const highlightedKey = activeMap[activeStage] || "orchestrator";
    const connections = [
      ["tokenizer", "prefill"],
      ["prefill", "detector"],
      ["detector", "orchestrator"],
      ["orchestrator", "dma"],
      ["dma", "sram"],
      ["hbm", "dma"],
      ["sram", "router"],
      ["hbm", "router"],
      ["router", "eviction"],
      ["directory", "sram"],
      ["directory", "router"],
      ["orchestrator", "directory"],
    ];
    svg.innerHTML = `
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L10,3 L0,6 z" fill="#0e5f66"></path>
        </marker>
      </defs>
      ${connections.map(([fromKey, toKey]) => {
        const from = blocks.find((block) => block.key === fromKey);
        const to = blocks.find((block) => block.key === toKey);
        return `<line x1="${from.x + 118}" y1="${from.y + 32}" x2="${to.x}" y2="${to.y + 32}" class="archLine" marker-end="url(#arrow)"></line>`;
      }).join("")}
      ${blocks.map((block) => `
        <g class="archBlock ${block.key === highlightedKey ? "active" : ""}">
          <rect x="${block.x}" y="${block.y}" width="132" height="64" rx="18"></rect>
          <text x="${block.x + 66}" y="${block.y + 28}" text-anchor="middle">${block.label}</text>
          <text x="${block.x + 66}" y="${block.y + 48}" text-anchor="middle" class="archSub">${architectureState[block.key]}</text>
        </g>
      `).join("")}
    `;
  }

  function renderMicroarchitecture(snapshot) {
    const svg = document.getElementById("microarchitectureSvg");
    const activeEvent = activeTimeline()[sim.memory.timelineCursor];
    const activeLabel = activeEvent ? activeEvent.stage : "idle";
    const banks = Array.from({ length: 6 }, (_, index) => ({
      id: `Bank ${index + 1}`,
      pressure: Math.min(100, 28 + index * 9 + snapshot.fragmentation.fragmentationPercent * 0.4),
    }));
    svg.innerHTML = `
      <rect x="24" y="22" width="1220" height="262" rx="22" fill="#fffdfa" stroke="#ddd2c4"></rect>
      <g class="archBlock active"><rect x="44" y="48" width="136" height="64" rx="18"></rect><text x="112" y="78" text-anchor="middle">Decode engine</text><text x="112" y="98" text-anchor="middle" class="archSub">${activeLabel}</text></g>
      <g class="archBlock"><rect x="220" y="48" width="136" height="64" rx="18"></rect><text x="288" y="78" text-anchor="middle">Attention fetch</text><text x="288" y="98" text-anchor="middle" class="archSub">${formatNumber(snapshot.routing.totalReadsAvoided, 0)} routed</text></g>
      <g class="archBlock"><rect x="400" y="48" width="136" height="64" rx="18"></rect><text x="468" y="78" text-anchor="middle">Routing fabric</text><text x="468" y="98" text-anchor="middle" class="archSub">${snapshot.routing.rows.filter((row) => row.routingDecision === "Mixed").length} mixed</text></g>
      <g class="archBlock"><rect x="582" y="48" width="136" height="64" rx="18"></rect><text x="650" y="78" text-anchor="middle">DMA engine</text><text x="650" y="98" text-anchor="middle" class="archSub">${snapshot.dma.descriptors.length} ops</text></g>
      <g class="archBlock"><rect x="770" y="48" width="136" height="64" rx="18"></rect><text x="838" y="78" text-anchor="middle">HBM controller</text><text x="838" y="98" text-anchor="middle" class="archSub">${formatNumber(snapshot.tierState.tierHitRates.HBM, 1)}% HBM</text></g>
      <g class="archBlock"><rect x="956" y="48" width="136" height="64" rx="18"></rect><text x="1024" y="78" text-anchor="middle">Compression engine</text><text x="1024" y="98" text-anchor="middle" class="archSub">${snapshot.compression.decompressionEvents} events</text></g>
      <g class="archBlock"><rect x="1116" y="48" width="108" height="64" rx="18"></rect><text x="1170" y="78" text-anchor="middle">Directory</text><text x="1170" y="98" text-anchor="middle" class="archSub">${snapshot.directory.entries.length} entries</text></g>
      ${banks.map((bank, index) => `
        <g>
          <rect x="${56 + index * 188}" y="182" width="132" height="54" rx="16" fill="#f7efe3" stroke="#ddd2c4"></rect>
          <rect x="${64 + index * 188}" y="212" width="${Math.min(116, bank.pressure)}" height="12" rx="6" fill="${bank.pressure > 70 ? "#aa4038" : bank.pressure > 45 ? "#b56b36" : "#1c7a51"}"></rect>
          <text x="${122 + index * 188}" y="202" text-anchor="middle" font-size="13" fill="#191613">${bank.id}</text>
          <text x="${122 + index * 188}" y="248" text-anchor="middle" font-size="12" fill="#615a54">${formatNumber(bank.pressure, 1)}% pressure</text>
        </g>
      `).join("")}
      <line x1="180" y1="80" x2="220" y2="80" class="archLine" marker-end="url(#arrow)"></line>
      <line x1="356" y1="80" x2="400" y2="80" class="archLine" marker-end="url(#arrow)"></line>
      <line x1="536" y1="80" x2="582" y2="80" class="archLine" marker-end="url(#arrow)"></line>
      <line x1="718" y1="80" x2="770" y2="80" class="archLine" marker-end="url(#arrow)"></line>
      <line x1="906" y1="80" x2="956" y2="80" class="archLine" marker-end="url(#arrow)"></line>
      <line x1="1092" y1="80" x2="1116" y2="80" class="archLine" marker-end="url(#arrow)"></line>
    `;
  }

  function renderBenchmarkTable(rows, containerId) {
    const container = document.getElementById(containerId);
    const header = containerId === "evictionComparison"
      ? `<div class="benchmarkHeader benchmarkHeaderTight"><span>Policy</span><span>Promotion churn</span><span>Thrash rate</span><span>Latency</span><span>DMA traffic</span><span>Cache stability</span><span>Notes</span></div>`
      : containerId === "runtimeComparisonTable"
        ? `<div class="benchmarkHeader"><span>Model</span><span>Promoted tokens</span><span>Promoted heads</span><span>Promoted layers</span><span>SRAM bytes used</span><span>SRAM budget %</span><span>HBM reads avoided</span><span>Latency cost</span><span>Speedup</span><span>Notes</span></div>`
      : `<div class="benchmarkHeader"><span>Mode</span><span>Promoted tokens</span><span>Promoted heads</span><span>Promoted layers</span><span>SRAM bytes used</span><span>SRAM budget %</span><span>HBM reads avoided</span><span>Latency cost</span><span>Speedup</span><span>Notes</span></div>`;
    const body = containerId === "evictionComparison"
      ? rows.map((row) => `
          <div class="benchmarkRow benchmarkRowTight ${row.name === sim.state.evictionPolicy ? "highlight" : ""}">
            <span><strong>${row.name}</strong></span>
            <span>${formatNumber(row.churn, 0)}</span>
            <span>${formatNumber(row.thrashRate, 2)}</span>
            <span>${formatNumber(row.latency, 1)}</span>
            <span>${bytesToHuman(row.dmaTraffic)}</span>
            <span>${formatNumber(row.stability, 2)}</span>
            <span>${row.notes}</span>
          </div>
        `).join("")
      : rows.map((row) => `
          <div class="benchmarkRow ${row.granularity === sim.state.promotionGranularity ? "highlight" : ""}">
            <span><strong>${row.name}</strong></span>
            <span>${formatNumber(row.promotedTokens ?? row.routingDeterminism ?? 0, 0)}</span>
            <span>${formatNumber(row.promotedHeads ?? row.fragmentation ?? 0, 0)}</span>
            <span>${formatNumber(row.promotedLayers ?? row.replayStability ?? 0, 0)}</span>
            <span>${row.sramBytesUsed !== undefined ? bytesToHuman(row.sramBytesUsed) : formatNumber(row.dmaTraffic, 1)}</span>
            <span>${formatNumber(row.sramBudgetPercent ?? row.residencyEfficiency ?? 0, 1)}${row.sramBudgetPercent !== undefined ? "%" : ""}</span>
            <span>${formatNumber(row.hbmReadsAvoided ?? row.orchestrationOverhead ?? 0, 1)}</span>
            <span>${formatNumber(row.latencyCost ?? row.routingDeterminism ?? 0, 1)}</span>
            <span>${row.relativeSpeedup !== undefined ? `${formatNumber(row.relativeSpeedup, 2)}x` : `${formatNumber(row.replayStability, 1)}%`}</span>
            <span>${row.notes ?? "Comparison surface"}</span>
          </div>
        `).join("");
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

  function renderExperimentQueue() {
    const container = document.getElementById("experimentQueue");
    container.innerHTML = sim.experiments.queue.length
      ? sim.experiments.queue.map((exp) => `
          <div class="stackItem">
            <strong>${exp.name}</strong>
            <span>${exp.workload} | ${exp.runtimePolicy} | seed ${exp.seed}</span>
            <span>duration ${exp.duration} | ${exp.promotionPolicy}</span>
          </div>
        `).join("")
      : `<div class="stackEmpty">No queued experiments</div>`;
  }

  function renderExperimentResults(results) {
    const container = document.getElementById("experimentResults");
    container.innerHTML = results.length
      ? results.map((result) => `
          <div class="stackItem">
            <strong>${result.name}</strong>
            <span>Snapshot hash ${result.checksums.snapshotHash}</span>
            <span>Execution stability ${result.orchestrator.executionStability.toFixed(2)}%</span>
            <span>Deterministic decode ${result.orchestrator.deterministicDecodeHitRate.toFixed(2)}%</span>
          </div>
        `).join("")
      : `<div class="stackEmpty">No experiment results yet</div>`;
  }

  function renderResultHistory() {
    const db = sim.persistence.load();
    document.getElementById("resultHistory").innerHTML = db.results.length
      ? db.results.slice(0, 8).map((result) => `
          <div class="stackItem">
            <strong>${result.name}</strong>
            <span>${result.createdAt}</span>
            <span>${result.config.workloadPreset || result.config.workload || sim.state.workloadPreset}</span>
            <span>${result.checksums ? result.checksums.snapshotHash : "no hash"}</span>
          </div>
        `).join("")
      : `<div class="stackEmpty">No stored results yet</div>`;
    document.getElementById("notebookHistory").innerHTML = db.notes.length
      ? db.notes.slice(0, 6).map((note) => `
          <div class="stackItem">
            <strong>${note.createdAt}</strong>
            <span>${note.note.slice(0, 120)}</span>
          </div>
        `).join("")
      : `<div class="stackEmpty">No notebook notes yet</div>`;
  }

  function renderTraceStatus(status) {
    const container = document.getElementById("traceStatus");
    if (!status) {
      container.innerHTML = `<div class="stackEmpty">No trace loaded</div>`;
      return;
    }
    container.innerHTML = `
      <div class="stackItem">
        <strong>${status.valid ? "Trace loaded" : "Trace error"}</strong>
        <span>${status.message || ""}</span>
        ${status.summary ? `<span>${status.summary.eventCount} events | ${status.summary.sessionCount} sessions | ${status.summary.averageSink !== undefined ? `avg sink ${status.summary.averageSink.toFixed(3)}` : `schema ${status.summary.schema || "runtime"}`}</span>` : ""}
      </div>
    `;
  }

  function renderSweepResults(results) {
    const container = document.getElementById("sweepSummary");
    if (!results.length) {
      container.innerHTML = `<div class="stackEmpty">No sweep results yet</div>`;
      return;
    }
    container.innerHTML = results.slice(0, 8).map((result) => `
      <div class="stackItem">
        <strong>${result.name}</strong>
        <span>${JSON.stringify(result.config)}</span>
        <span>Stability ${result.orchestrator.executionStability.toFixed(2)}% | Speedup ${result.benchmark[4].relativeSpeedup.toFixed(2)}x</span>
      </div>
    `).join("");
  }

  function renderResearchGraphFromResults(results, title) {
    if (!results.length) {
      sim.graphs.renderSeries("graphSvg", title, [], "No data");
      return;
    }
    const primaryKey = Object.keys(results[0].config).find((key) => !["workloadPreset", "executionPolicy", "partitionPolicy", "evictionPolicy", "promotionGranularity", "seed", "decodeSteps"].includes(key)) || "sramBudget";
    const series = [
      {
        label: "Relative speedup",
        points: results.map((result, index) => ({
          x: Number(result.config[primaryKey] || index),
          value: result.benchmark.find((row) => row.granularity === "per-head-layer")?.relativeSpeedup || 1,
        })),
      },
      {
        label: "Execution stability",
        points: results.map((result, index) => ({
          x: Number(result.config[primaryKey] || index),
          value: result.orchestrator.executionStability,
        })),
      },
    ];
    sim.graphs.renderSeries("graphSvg", title, series, primaryKey);
  }

  function buildArchitectureState(snapshot) {
    const { directory, dma, routing, orchestrator, topology, fabric, distributedRouting } = snapshot;
    return {
      tokenizer: `${sim.state.tenantCount} sessions`,
      prefill: `${sim.state.promptLength} prompt tokens`,
      detector: `${directory.entries.filter((entry) => entry.sinkScore >= sim.state.sinkThreshold).length} sink candidates`,
      orchestrator: `${formatNumber(orchestrator.executionStability, 1)}% stable`,
      dma: `${dma.descriptors.length} transfers`,
      sram: `${directory.entries.filter((entry) => entry.tier === "SRAM").length} active entries`,
      hbm: `${formatNumber(routing.totalMisses, 0)} fallback reads`,
      router: `${routing.rows.filter((row) => row.routingDecision === "Mixed").length} mixed | ${formatNumber(distributedRouting.remoteFetchRate, 1)}% remote`,
      eviction: sim.state.evictionPolicy,
      directory: `${directory.summary.sharedUsers} shared refs | ${topology.nodes.length} devices | ${fabric.hotspots} hotspots`,
    };
  }

  function updateSummary(snapshot) {
    document.getElementById("modeLabel").textContent = getSelectText("promotionGranularity");
    document.getElementById("sharedPrefixSavings").textContent = bytesToHuman(snapshot.sharedMetrics.bytesSaved);
    document.getElementById("readsAvoided").textContent = formatNumber(snapshot.routing.totalReadsAvoided, 1);
    document.getElementById("dmaBandwidthUse").textContent = `${formatNumber(snapshot.dma.utilization, 1)}%`;
    document.getElementById("promotionChurn").textContent = formatNumber(snapshot.orchestrator.promotionChurn, 0);
    const activeBenchmark = snapshot.benchmarkComparison.find((row) => row.granularity === sim.state.promotionGranularity) || snapshot.benchmarkComparison[0];
    document.getElementById("relativeSpeedup").textContent = `${formatNumber(activeBenchmark.relativeSpeedup, 2)}x`;
  }

  function computeSnapshot(overrides = {}, options = {}) {
    const baseState = sim.utils.cloneState();
    const baseStress = { ...sim.memory.stressEvents };
    Object.assign(sim.state, overrides);
    sim.ensureLayerRange();
    sim.ensureHeadEligibility();
    sim.memory.policyRuntime = sim.policies.applyPolicyToState(sim.state);

    const model = {
      layers: sim.state.layers,
      kvHeads: sim.state.kvHeads,
      headDim: sim.state.headDim,
      bytesPerElement: sim.state.bytesPerElement,
    };
    const sessions = sim.generateSessions();
    const layerBuckets = sim.computeLayerBuckets(sim.state.layers);
    const headProfiles = sim.generateHeadProfiles();
    const promotedHeads = sim.determinePromotedHeads(headProfiles);
    const directory = sim.residency.buildDirectory(sessions, headProfiles, promotedHeads);
    const sharedMetrics = sim.residency.computeSharedPrefixMetrics(directory);
    const topology = sim.topology.build(model, sessions);
    const fabric = sim.fabric.build(topology, sessions);
    const dma = sim.dma.buildQueue(directory, sessions);
    const routing = sim.routing.buildRoutingTable(directory, promotedHeads, sessions);
    const distributedRouting = sim.routing.buildDistributedRouting(topology, fabric, directory, sessions);
    const speculative = sim.speculative.buildTrace(sessions);
    const compression = sim.compression.build(directory, dma);
    const tierState = sim.tiers.build(directory, routing, compression);
    const pooling = sim.pooling.build(topology, directory);
    const benchmarkComparison = sim.benchmark.computeRuntimeBenchmark({
      model,
      policy: sim.state,
      directory,
      routing,
      promotedHeads,
    });
    const evictionComparison = sim.eviction.computeComparison(directory.entries, {
      promotions: dma.descriptors.length,
      misses: routing.totalMisses,
      latency: routing.averageLatency,
      dmaBytes: dma.totalBytes,
    });
    const partitions = sim.orchestrator.buildPartitions({
      model,
      sessions,
      directory,
      routing,
      dma,
      speculative,
      sharedMetrics,
      tierState,
      compression,
      evictionComparison,
    });
    const fragmentation = sim.fragmentation.build(directory, partitions);
    const paging = sim.paging.build(model, directory, fragmentation, distributedRouting);
    const scheduler = sim.scheduler.build(topology, fabric, pooling, sessions, distributedRouting);
    const migration = sim.migration.build(topology, fabric, directory, scheduler);
    const compilerPlan = sim.compiler.build({ dma, sharedMetrics });
    const orchestrator = sim.orchestrator.build({
      model,
      sessions,
      directory,
      routing,
      dma,
      speculative,
      sharedMetrics,
      tierState,
      compression,
      evictionComparison,
      fragmentation,
    });
    const energy = sim.energy.build({
      distributedRouting,
      dma,
      migration,
      compression,
      routing,
      sessions,
    });
    const abi = sim.abi.build({ directory, dma, sharedMetrics });
    const launch = sim.launch.build({ speculative, dma });
    const lifetimes = sim.lifetimes.build({ directory });
    const economics = sim.economics.build({
      topology,
      fabric,
      routing,
      distributedRouting,
      pooling,
      metricsSummary: { effectiveSramAmplification: directory.entries.length ? sim.computeKvBytes(model) / Math.max(1, directory.entries.reduce((sum, entry) => sum + entry.bytes, 0)) : 0 },
    });
    const integration = sim.integration.build({
      topology,
      distributedRouting,
      migration,
      metricsSummary: { routingDeterminism: 86 },
    });
    const timeline = sim.timeline.buildEvents(sessions, directory, dma, routing, speculative, promotedHeads.map((head) => head.id));
    const architectureState = buildArchitectureState({ directory, dma, routing, orchestrator, topology, fabric, distributedRouting });
    const telemetry = sim.telemetry.build({
      sessions,
      tierState,
      routing,
      dma,
      orchestrator,
      speculative,
      sharedMetrics,
      fragmentation,
      compression,
      distributedRouting,
      fabric,
      migration,
      energy,
    }, { persistHistory: options.persistTelemetry !== false });
    const metricsSummary = sim.metrics.summarize({
      model,
      sessions,
      directory,
      sharedMetrics,
      dma,
      routing,
      speculative,
      compression,
      tierState,
      fragmentation,
      orchestrator,
      telemetry,
      distributedRouting,
      fabric,
      pooling,
      energy,
      economics,
      paging,
      launch,
    });
    const algorithmDemo = buildAlgorithmDemo(model);

    const snapshot = {
      model,
      sessions,
      layerBuckets,
      headProfiles,
      promotedHeads,
      directory,
      sharedMetrics,
      abi,
      paging,
      topology,
      fabric,
      dma,
      routing,
      distributedRouting,
      speculative,
      compression,
      tierState,
      pooling,
      benchmarkComparison,
      evictionComparison,
      partitions,
      fragmentation,
      compilerPlan,
      launch,
      lifetimes,
      integration,
      scheduler,
      migration,
      orchestrator,
      energy,
      economics,
      timeline,
      architectureState,
      telemetry,
      metricsSummary,
      algorithmDemo,
      workload: sim.workloads.getActiveWorkload(),
      state: sim.utils.cloneState(),
    };

    Object.assign(sim.state, baseState);
    sim.memory.stressEvents = { ...baseStress };
    sim.memory.policyRuntime = sim.policies.applyPolicyToState(sim.state);
    return snapshot;
  }

  function renderSnapshot(snapshot) {
    renderThesisMode(snapshot);
    renderFormalDiagrams(snapshot);
    fillSessionSelector(snapshot.sessions);
    renderDistributedTopology(snapshot.topology, snapshot.fabric);
    renderFabricAndDistributedRouting(snapshot.fabric, snapshot.distributedRouting);
    renderPoolingAndScheduler(snapshot.pooling, snapshot.scheduler, snapshot.migration);
    renderEnergyAndEconomics(snapshot.energy, snapshot.economics);
    renderAbi(snapshot.abi);
    renderPaging(snapshot.paging);
    renderCompilerPlan(snapshot.compilerPlan);
    renderLaunch(snapshot.launch);
    renderIntegration(snapshot.integration);
    renderLifetimes(snapshot.lifetimes);
    renderCoreAlgorithmDemo(snapshot.algorithmDemo);
    renderHeadProfiles(snapshot.headProfiles);
    renderHeatmap(snapshot.headProfiles, snapshot.layerBuckets);
    renderEfficiency(snapshot.model, snapshot.promotedHeads);
    renderOrchestratorState(snapshot.orchestrator);
    renderExecutionWindows(snapshot.orchestrator);
    renderPartitions(snapshot.partitions);
    renderTimeline(activeTimeline().length ? activeTimeline() : snapshot.timeline);
    renderDma(snapshot.dma);
    renderRouting(snapshot.routing, snapshot.tierState);
    renderSharedPrefix(snapshot.sharedMetrics, snapshot.sessions);
    renderDirectory(snapshot.directory);
    renderSpeculative(snapshot.speculative);
    renderTierPanel(snapshot.tierState);
    renderCompressionPanel(snapshot.compression);
    renderFragmentation(snapshot.fragmentation);
    renderArchitecture(snapshot.architectureState);
    renderMicroarchitecture(snapshot);
    renderTelemetry(snapshot.telemetry, snapshot.metricsSummary);
    renderBenchmarkTable(snapshot.evictionComparison, "evictionComparison");
    renderBenchmarkTable(snapshot.benchmarkComparison, "benchmarkTable");
    renderBenchmarkTable(snapshot.paging.comparison.map((row) => ({
      name: row.name,
      granularity: row.name,
      promotedTokens: row.routingDeterminism,
      promotedHeads: row.fragmentation,
      promotedLayers: row.replayStability,
      sramBytesUsed: row.dmaTraffic * 1024,
      sramBudgetPercent: row.residencyEfficiency,
      hbmReadsAvoided: row.orchestrationOverhead,
      latencyCost: row.routingDeterminism,
      relativeSpeedup: row.replayStability / 100,
      notes: "Research comparison model",
    })), "runtimeComparisonTable");
    updateSummary(snapshot);
  }

  function rerenderTimelineLinkedViews() {
    if (!sim.memory.lastRun) {
      return;
    }
    renderTimeline(activeTimeline());
    renderDma(sim.memory.lastRun.dma);
    renderArchitecture(sim.memory.lastRun.architectureState);
    renderMicroarchitecture(sim.memory.lastRun);
  }

  function injectStressEvent(eventName) {
    sim.memory.overrideTimeline = null;
    sim.memory.stressEvents[eventName] = (sim.memory.stressEvents[eventName] || 0) + 1;
    runSimulation();
  }

  function queueCurrentExperiment() {
    const definition = sim.experiments.makeDefinition({
      name: document.getElementById("experimentName").value,
      duration: Number(document.getElementById("experimentDuration").value),
    });
    sim.experiments.queueExperiment(definition);
    renderExperimentQueue();
    renderResultHistory();
  }

  function runCurrentExperiment() {
    const definition = sim.experiments.makeDefinition({
      name: document.getElementById("experimentName").value,
      duration: Number(document.getElementById("experimentDuration").value),
    });
    const result = sim.experiments.runExperiment(definition, computeSnapshot);
    renderExperimentResults([result]);
    renderResultHistory();
  }

  function runQueuedExperiments() {
    const results = sim.experiments.runBatch(computeSnapshot);
    renderExperimentResults(results);
    renderResultHistory();
  }

  function comparePolicies() {
    const policies = [
      "aggressive-promotion",
      "bandwidth-optimized",
      "latency-optimized",
      "tenant-fairness-optimized",
      "sink-stability-optimized",
      "deterministic-residency-optimized",
    ];
    const results = sim.experiments.comparePolicies(policies, computeSnapshot);
    renderExperimentResults(results);
    sim.graphs.renderSeries("graphSvg", "Policy Comparison", [
      {
        label: "Execution stability",
        points: results.map((result, index) => ({ x: index, value: result.orchestrator.executionStability })),
      },
      {
        label: "Deterministic decode",
        points: results.map((result, index) => ({ x: index, value: result.orchestrator.deterministicDecodeHitRate })),
      },
    ], "Policy index");
    renderResultHistory();
  }

  function runSweep() {
    const sweepConfig = {
      name: document.getElementById("experimentName").value || "Sweep",
      param: document.getElementById("sweepParam").value,
      scale: document.getElementById("sweepScale").value,
      start: Number(document.getElementById("sweepStart").value),
      end: Number(document.getElementById("sweepEnd").value),
      steps: Number(document.getElementById("sweepSteps").value),
      secondaryParam: document.getElementById("secondarySweepParam").value || undefined,
      secondaryScale: document.getElementById("secondarySweepScale").value,
      secondaryStart: Number(document.getElementById("secondarySweepStart").value),
      secondaryEnd: Number(document.getElementById("secondarySweepEnd").value),
      secondarySteps: Number(document.getElementById("secondarySweepSteps").value),
    };
    const results = sim.experiments.runSweep(sweepConfig, computeSnapshot);
    renderSweepResults(results);
    renderResearchGraphFromResults(
      results,
      sweepConfig.secondaryParam ? `${sweepConfig.param} x ${sweepConfig.secondaryParam} sweep` : `${sweepConfig.param} sweep`
    );
    renderResultHistory();
  }

  function verifyDeterministicReplay() {
    const config = sim.utils.cloneState();
    const verification = sim.reproducibility.verifyReplay(config, computeSnapshot);
    renderExperimentResults([
      {
        name: "Deterministic replay verification",
        checksums: { snapshotHash: verification.leftHash },
        orchestrator: { executionStability: verification.deterministic ? 100 : 0, deterministicDecodeHitRate: verification.deterministic ? 100 : 0 },
        benchmark: [],
      },
    ]);
    renderTraceStatus({
      valid: verification.deterministic,
      message: verification.deterministic ? `Replay consistent (${verification.leftHash})` : `Replay diverged (${verification.leftHash} vs ${verification.rightHash})`,
    });
  }

  function loadTrace() {
    const text = document.getElementById("traceInput").value.trim();
    const status = sim.state.traceSchema === "scheduler-events" ? sim.replay.importTrace(text) : sim.traces.importRuntimeTrace(text);
    if (status.valid) {
      status.summary = sim.state.traceSchema === "scheduler-events"
        ? sim.replay.buildReplaySummary(sim.memory.importedTrace)
        : sim.traces.summarize(sim.memory.importedRuntimeTrace);
    }
    renderTraceStatus(status);
    renderResultHistory();
  }

  function replayTrace() {
    const hasSchedulerTrace = sim.memory.importedTrace && sim.state.traceSchema === "scheduler-events";
    const hasRuntimeTrace = sim.memory.importedRuntimeTrace && sim.state.traceSchema !== "scheduler-events";
    if (!hasSchedulerTrace && !hasRuntimeTrace) {
      renderTraceStatus({ valid: false, message: "Load a trace first." });
      return;
    }
    sim.memory.overrideTimeline = hasSchedulerTrace
      ? sim.replay.toTimeline(sim.memory.importedTrace)
      : sim.memory.importedRuntimeTrace.map((event, index) => ({
        stage: event.eventType,
        timestamp: event.timestamp ?? index,
        sessionId: event.sessionId,
        tokenRange: `${event.tokenId}-${event.tokenId}`,
        headsAffected: `${event.head}`,
        layerRange: `${event.layer}-${event.layer}`,
        bytesMoved: sim.computeVirtualPageBytes(sim.memory.lastRun.model),
        sourceTier: event.reusedPrefix ? "shared-prefix" : "runtime",
        destinationTier: event.accepted ? "decode-graph" : "fallback",
        estimatedLatency: event.attentionWeight * sim.state.hbmLatency,
      }));
    sim.memory.timelineCursor = 0;
    renderTraceStatus({
      valid: true,
      message: "Trace replay timeline loaded.",
      summary: hasSchedulerTrace ? sim.replay.buildReplaySummary(sim.memory.importedTrace) : sim.traces.summarize(sim.memory.importedRuntimeTrace),
    });
    rerenderTimelineLinkedViews();
  }

  function saveNotebookNote() {
    const note = document.getElementById("notebookNote").value.trim();
    if (!note) {
      return;
    }
    sim.notebook.save(note);
    renderResultHistory();
  }

  function generatePaperFigures() {
    sim.graphs.exportFigure("graphSvg", "paper-figure-research-graph", [["series", "value"]]);
    sim.graphs.exportFigure("telemetrySvg", "paper-figure-telemetry", [["series", "value"]]);
    const arch = document.getElementById("architectureSvg");
    const micro = document.getElementById("microarchitectureSvg");
    const topo = document.getElementById("topologySvg");
    const compilerPlan = document.getElementById("compilerPlanSvg");
    const executionModel = document.getElementById("executionModelSvg");
    const lifecycle = document.getElementById("lifecycleSvg");
    const downloadSvg = (element, name) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([element.outerHTML], { type: "image/svg+xml" }));
      link.download = name;
      link.click();
    };
    downloadSvg(arch, "paper-figure-architecture.svg");
    downloadSvg(micro, "paper-figure-microarchitecture.svg");
    downloadSvg(topo, "paper-figure-distributed-topology.svg");
    downloadSvg(compilerPlan, "paper-figure-compiler-plan.svg");
    downloadSvg(executionModel, "paper-figure-execution-model.svg");
    downloadSvg(lifecycle, "paper-figure-memory-lifecycle.svg");
  }

  function runSimulation() {
    sim.memory.overrideTimeline = null;
    syncControlValues();
    const snapshot = computeSnapshot({}, { persistTelemetry: true });
    snapshot.architectureState = buildArchitectureState(snapshot);
    sim.memory.lastRun = snapshot;
    sim.memory.timelineCursor = Math.min(sim.memory.timelineCursor, Math.max(0, snapshot.timeline.length - 1));
    renderSnapshot(snapshot);
    renderExperimentQueue();
    renderResultHistory();
    if (sim.experiments.lastSweep.length) {
      renderSweepResults(sim.experiments.lastSweep);
    }
  }

  function applyPreset(next) {
    Object.assign(sim.state, next);
    sim.memory.headEligibilityOverrides = [];
    sim.ensureHeadEligibility();
    syncControlValues();
    runSimulation();
  }

  function replayWorkload() {
    sim.workloads.applyPresetToState();
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
      if (!input) {
        return;
      }
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
        sim.state[id] = ["bytesPerElement", "timelineSpeed", "traceReplaySpeed"].includes(id) ? Number(input.value) : input.value;
        if (id === "workloadPreset") {
          sim.workloads.applyPresetToState();
        }
        runSimulation();
      });
    });

    document.getElementById("rerun").addEventListener("click", runSimulation);
    document.getElementById("replayWorkload").addEventListener("click", replayWorkload);
    document.getElementById("presetConservative").addEventListener("click", () => {
      applyPreset({
        promotionGranularity: "per-head",
        evictionPolicy: "refcount-protected",
        executionPolicy: "tenant-fairness-optimized",
        partitionPolicy: "static-equal-partition",
        compressionMode: "uncompressed-sram",
        compactionMode: "enabled",
        promptLength: 18,
        decodeSteps: 12,
        decodeConcurrency: 3,
        tenantCount: 3,
        sharedPrefixLength: 4,
        promotedHeads: 2,
        promotedLayerStart: 20,
        promotedLayerEnd: 28,
        layerBoostMultiplier: 1.3,
        sramBudget: 6,
        dmaBandwidth: 72,
        dmaSlots: 2,
        topologyType: "1d",
        fabricType: "pcie-like",
        distributedPlacementPolicy: "local-first",
        deviceCount: 4,
        pooledMemoryNodes: 0,
        topologyWidth: 2,
        fabricBandwidth: 120,
        fabricLinkLatency: 10,
        remoteLatencyMultiplier: 1.8,
        pooledSpillPercent: 8,
        multicastFanout: 1,
        energyMode: "conservative",
        costMode: "memory-optimized",
        draftTokens: 1,
        draftAcceptRate: 0.74,
        executionWindowDuration: 7,
        pinningDuration: 5,
        sharedPoolPercent: 18,
      });
    });
    document.getElementById("presetAggressive").addEventListener("click", () => {
      applyPreset({
        promotionGranularity: "per-head-layer",
        evictionPolicy: "pinned-shared-prefix",
        executionPolicy: "aggressive-promotion",
        partitionPolicy: "shared-prefix-reserved-pool",
        compressionMode: "quantized-hbm",
        compactionMode: "enabled",
        promptLength: 24,
        decodeSteps: 20,
        decodeConcurrency: 6,
        tenantCount: 6,
        sharedPrefixLength: 6,
        promotedHeads: 4,
        promotedLayerStart: 12,
        promotedLayerEnd: 36,
        layerBoostMultiplier: 2.1,
        sramBudget: 12,
        dmaBandwidth: 144,
        dmaSlots: 4,
        topologyType: "fat-tree",
        fabricType: "nvlink-like",
        distributedPlacementPolicy: "topology-aware",
        deviceCount: 8,
        pooledMemoryNodes: 2,
        topologyWidth: 3,
        fabricBandwidth: 280,
        fabricLinkLatency: 5,
        remoteLatencyMultiplier: 1.2,
        pooledSpillPercent: 24,
        multicastFanout: 4,
        energyMode: "performance",
        costMode: "throughput-optimized",
        draftTokens: 3,
        draftAcceptRate: 0.62,
        executionWindowDuration: 10,
        pinningDuration: 7,
        sharedPoolPercent: 28,
      });
    });
    document.getElementById("playTimeline").addEventListener("click", () => sim.timeline.play(rerenderTimelineLinkedViews));
    document.getElementById("pauseTimeline").addEventListener("click", () => {
      sim.timeline.pause();
      rerenderTimelineLinkedViews();
    });
    document.getElementById("stepTimeline").addEventListener("click", () => sim.timeline.step(rerenderTimelineLinkedViews));
    document.getElementById("addSession").addEventListener("click", addSession);
    document.getElementById("attachShared").addEventListener("click", () => attachSharedPrefix(true));
    document.getElementById("detachShared").addEventListener("click", () => attachSharedPrefix(false));
    document.getElementById("generateSnapshot").addEventListener("click", () => sim.exporter.exportSnapshot());
    document.getElementById("generatePaperFigures").addEventListener("click", generatePaperFigures);
    document.getElementById("generateAttention").addEventListener("click", runSimulation);
    document.getElementById("computeSinkScores").addEventListener("click", runSimulation);
    document.getElementById("verifySplitMerge").addEventListener("click", runSimulation);
    document.getElementById("toggleThesisMode").addEventListener("click", () => {
      sim.thesis.toggle();
      runSimulation();
    });
    document.getElementById("prevThesisStep").addEventListener("click", () => {
      sim.thesis.prev();
      runSimulation();
    });
    document.getElementById("nextThesisStep").addEventListener("click", () => {
      sim.thesis.next();
      runSimulation();
    });

    document.getElementById("queueExperiment").addEventListener("click", queueCurrentExperiment);
    document.getElementById("runExperiment").addEventListener("click", runCurrentExperiment);
    document.getElementById("runBatchExperiments").addEventListener("click", runQueuedExperiments);
    document.getElementById("comparePolicies").addEventListener("click", comparePolicies);
    document.getElementById("verifyDeterministicReplay").addEventListener("click", verifyDeterministicReplay);
    document.getElementById("runSweep").addEventListener("click", runSweep);
    document.getElementById("loadTrace").addEventListener("click", loadTrace);
    document.getElementById("replayTrace").addEventListener("click", replayTrace);
    document.getElementById("saveNotebookNote").addEventListener("click", saveNotebookNote);
    document.getElementById("exportNotebookMarkdown").addEventListener("click", () => sim.notebook.exportMarkdown(document.getElementById("notebookNote").value.trim()));
    document.getElementById("exportNotebookHtml").addEventListener("click", () => sim.notebook.exportHtml(document.getElementById("notebookNote").value.trim()));

    [
      ["eventSramExhaustion", "sram-exhaustion"],
      ["eventDmaCongestion", "dma-congestion"],
      ["eventSpeculativeCollapse", "speculative-collapse"],
      ["eventEvictionStorm", "eviction-storm"],
      ["eventTenantBurst", "tenant-burst"],
      ["eventPrefixInvalidation", "prefix-invalidation"],
      ["eventBandwidthSaturation", "bandwidth-saturation"],
      ["eventDeviceLoss", "device-loss"],
      ["eventPooledExhaustion", "pooled-memory-exhaustion"],
      ["eventRemoteLatencySpike", "remote-latency-spike"],
    ].forEach(([id, eventName]) => {
      const el = document.getElementById(id);
      el.addEventListener("click", () => injectStressEvent(eventName));
    });
  }

  sim.captureSnapshotForConfig = computeSnapshot;
  sim.ensureHeadEligibility();
  bindControls();
  syncControlValues();
  renderTraceStatus(null);
  runSimulation();
})();
