(function () {
  const sim = window.AttentionSinkSim;

  const steps = [
    {
      title: "The Problem",
      body: "Transformer inference becomes memory-bound when hot KV state, decode scheduling, and tenant concurrency all compete for limited fast memory. Best-effort caching alone does not provide predictable decode behavior.",
      targets: ["telemetryCards", "routingTable"],
      callouts: ["Bandwidth pressure dominates once decode becomes long-lived.", "Stable serving needs more than opportunistic locality."],
    },
    {
      title: "Orchestration Over Caching",
      body: "This architecture treats promotion as scheduling, not as a passive cache fill. Residency is governed by explicit contracts, bounded windows, and replay-aware execution rules.",
      targets: ["abiTable", "executionWindows"],
      callouts: ["Promotion decisions are deliberate and scoped.", "Residency contracts replace best-effort placement."],
    },
    {
      title: "Compiler and Runtime Cooperation",
      body: "The compiler emits execution regions, replay checkpoints, and promotion windows. The runtime interprets those plans, adapts within legal boundaries, and coordinates launch and DMA behavior.",
      targets: ["compilerPlanSvg", "launchTable"],
      callouts: ["Planning shapes runtime freedom.", "Adaptation stays inside bounded regions."],
    },
    {
      title: "Deterministic Decode Windows",
      body: "Replay-safe execution windows bound where orchestration may change state. This preserves graph reuse, predictable launches, and stable residency across repeated decode steps.",
      targets: ["executionModelSvg", "timelineDetails"],
      callouts: ["Replay checkpoints define legal adaptation boundaries.", "Determinism is an execution property, not just a memory property."],
    },
    {
      title: "Topology-Aware Placement",
      body: "Once KV is distributed, orchestration must become topology-aware. Device placement, pooled memory, remote fetches, and DMA waves all shape the final decode path.",
      targets: ["topologySvg", "distributedRoutingTable", "schedulerPanel"],
      callouts: ["Topology changes residency semantics.", "Remote traffic is part of the memory model."],
    },
    {
      title: "Lifecycle and Infrastructure",
      body: "KV objects follow an orchestrated lifecycle: creation, classification, promotion, replay protection, sharing, migration, and reclamation. Memory becomes managed infrastructure rather than a passive substrate.",
      targets: ["lifetimeTable", "lifecycleSvg"],
      callouts: ["The lifecycle is explicit and observable.", "Reclamation happens when legality and replay safety allow it."],
    },
  ];

  sim.thesis = {
    steps,
    current() {
      return steps[Math.max(0, Math.min(steps.length - 1, sim.memory.thesisStep))];
    },
    next() {
      sim.memory.thesisStep = (sim.memory.thesisStep + 1) % steps.length;
    },
    prev() {
      sim.memory.thesisStep = (sim.memory.thesisStep - 1 + steps.length) % steps.length;
    },
    toggle() {
      sim.memory.thesisModeActive = !sim.memory.thesisModeActive;
    },
  };
})();
