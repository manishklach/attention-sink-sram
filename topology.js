(function () {
  const sim = window.AttentionSinkSim;

  function deviceTypeFor(index, total, pooledCount) {
    if (index < Math.max(1, total - pooledCount - 2)) {
      return index % 2 === 0 ? "GPU" : "accelerator";
    }
    if (index === total - pooledCount - 2) {
      return "CPU-attached SRAM";
    }
    if (index === total - pooledCount - 1) {
      return "SmartNIC/DPU";
    }
    if (index < total - 1) {
      return "pooled memory node";
    }
    return "storage offload node";
  }

  function nodePosition(index, total, topologyType, width) {
    if (topologyType === "star") {
      const angle = (Math.PI * 2 * index) / Math.max(1, total);
      return { x: 420 + Math.cos(angle) * 220, y: 220 + Math.sin(angle) * 150 };
    }
    if (topologyType === "fat-tree") {
      const level = index < 2 ? 0 : index < Math.ceil(total / 2) ? 1 : 2;
      const levelCount = level === 0 ? 2 : level === 1 ? Math.max(2, Math.ceil((total - 2) / 2)) : Math.max(2, total - 2 - Math.ceil((total - 2) / 2));
      const position = level === 0 ? index : level === 1 ? index - 2 : index - 2 - Math.ceil((total - 2) / 2);
      return { x: 160 + (position * 620) / Math.max(1, levelCount - 1), y: 80 + level * 140 };
    }
    const cols = Math.max(2, width);
    return { x: 140 + (index % cols) * 210, y: 80 + Math.floor(index / cols) * 140 };
  }

  function baseLinks(nodes, topologyType, width) {
    const links = [];
    if (topologyType === "star") {
      for (let index = 1; index < nodes.length; index += 1) {
        links.push({ from: nodes[0].id, to: nodes[index].id });
      }
      return links;
    }
    if (topologyType === "fat-tree") {
      const spines = nodes.slice(0, 2);
      const leaves = nodes.slice(2, Math.ceil(nodes.length / 2) + 1);
      const endpoints = nodes.slice(Math.ceil(nodes.length / 2) + 1);
      leaves.forEach((leaf) => spines.forEach((spine) => links.push({ from: spine.id, to: leaf.id })));
      endpoints.forEach((endpoint, index) => {
        links.push({ from: leaves[index % leaves.length].id, to: endpoint.id });
      });
      return links;
    }
    if (topologyType === "mesh" || topologyType === "custom") {
      const cols = Math.max(2, width);
      nodes.forEach((node, index) => {
        if ((index + 1) % cols !== 0 && index + 1 < nodes.length) {
          links.push({ from: node.id, to: nodes[index + 1].id });
        }
        if (index + cols < nodes.length) {
          links.push({ from: node.id, to: nodes[index + cols].id });
        }
        if (topologyType === "custom" && index + cols + 1 < nodes.length && index % 2 === 0) {
          links.push({ from: node.id, to: nodes[index + cols + 1].id });
        }
      });
      return links;
    }
    for (let index = 0; index < nodes.length - 1; index += 1) {
      links.push({ from: nodes[index].id, to: nodes[index + 1].id });
    }
    return links;
  }

  sim.topology = {
    build(model, sessions) {
      const nodes = Array.from({ length: sim.state.deviceCount }, (_, index) => {
        const type = deviceTypeFor(index, sim.state.deviceCount, sim.state.pooledMemoryNodes);
        const profile = sim.deviceProfiles[type];
        const position = nodePosition(index, sim.state.deviceCount, sim.state.topologyType, sim.state.topologyWidth);
        return {
          id: `D${index + 1}`,
          type,
          x: position.x,
          y: position.y,
          sramCapacity: profile.sram * 1024 * 1024,
          hbmCapacity: profile.hbm * 1024 * 1024,
          dmaEngines: profile.dma,
          bandwidth: profile.bandwidth,
          latency: profile.latency,
          computeCapacity: profile.compute,
          assignedSessions: [],
        };
      });

      sessions.forEach((session, index) => {
        const target = nodes[index % Math.max(1, nodes.length - sim.state.pooledMemoryNodes)];
        if (target) {
          target.assignedSessions.push(session.sessionId);
        }
      });

      const links = baseLinks(nodes, sim.state.topologyType, sim.state.topologyWidth).map((link, index) => ({
        id: `L${index + 1}`,
        ...link,
      }));

      return {
        nodes,
        links,
        pooledNodes: nodes.filter((node) => node.type === "pooled memory node"),
        summary: {
          totalSram: nodes.reduce((sum, node) => sum + node.sramCapacity, 0),
          totalHbm: nodes.reduce((sum, node) => sum + node.hbmCapacity, 0),
          totalCompute: nodes.reduce((sum, node) => sum + node.computeCapacity, 0),
        },
      };
    },
  };
})();
