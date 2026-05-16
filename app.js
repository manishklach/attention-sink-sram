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
        ${status.summary ? `<span>${status.summary.eventCount} events | ${status.summary.sessionCount} sessions | avg sink ${status.summary.averageSink.toFixed(3)}</span>` : ""}
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
    const scheduler = sim.scheduler.build(topology, fabric, pooling, sessions, distributedRouting);
    const migration = sim.migration.build(topology, fabric, directory, scheduler);
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
    const economics = sim.economics.build({
      topology,
      fabric,
      routing,
      distributedRouting,
      pooling,
      metricsSummary: { effectiveSramAmplification: directory.entries.length ? sim.computeKvBytes(model) / Math.max(1, directory.entries.reduce((sum, entry) => sum + entry.bytes, 0)) : 0 },
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
    });

    const snapshot = {
      model,
      sessions,
      layerBuckets,
      headProfiles,
      promotedHeads,
      directory,
      sharedMetrics,
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
      scheduler,
      migration,
      orchestrator,
      energy,
      economics,
      timeline,
      architectureState,
      telemetry,
      metricsSummary,
      workload: sim.workloads.getActiveWorkload(),
      state: sim.utils.cloneState(),
    };

    Object.assign(sim.state, baseState);
    sim.memory.stressEvents = { ...baseStress };
    sim.memory.policyRuntime = sim.policies.applyPolicyToState(sim.state);
    return snapshot;
  }

  function renderSnapshot(snapshot) {
    fillSessionSelector(snapshot.sessions);
    renderDistributedTopology(snapshot.topology, snapshot.fabric);
    renderFabricAndDistributedRouting(snapshot.fabric, snapshot.distributedRouting);
    renderPoolingAndScheduler(snapshot.pooling, snapshot.scheduler, snapshot.migration);
    renderEnergyAndEconomics(snapshot.energy, snapshot.economics);
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
      "speculative-heavy",
      "sink-stability-optimized",
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
    const status = sim.replay.importTrace(text);
    if (status.valid) {
      status.summary = sim.replay.buildReplaySummary(sim.memory.importedTrace);
    }
    renderTraceStatus(status);
    renderResultHistory();
  }

  function replayTrace() {
    if (!sim.memory.importedTrace) {
      renderTraceStatus({ valid: false, message: "Load a trace first." });
      return;
    }
    sim.memory.overrideTimeline = sim.replay.toTimeline(sim.memory.importedTrace);
    sim.memory.timelineCursor = 0;
    renderTraceStatus({
      valid: true,
      message: "Trace replay timeline loaded.",
      summary: sim.replay.buildReplaySummary(sim.memory.importedTrace),
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
    const downloadSvg = (element, name) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([element.outerHTML], { type: "image/svg+xml" }));
      link.download = name;
      link.click();
    };
    downloadSvg(arch, "paper-figure-architecture.svg");
    downloadSvg(micro, "paper-figure-microarchitecture.svg");
    downloadSvg(topo, "paper-figure-distributed-topology.svg");
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
