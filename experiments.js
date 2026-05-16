(function () {
  const sim = window.AttentionSinkSim;

  sim.experiments = {
    queue: [],
    lastSweep: [],
    lastComparison: [],

    makeDefinition(overrides) {
      return {
        name: overrides.name || `Experiment ${new Date().toLocaleTimeString()}`,
        workload: overrides.workload || sim.state.workloadPreset,
        runtimePolicy: overrides.runtimePolicy || sim.state.executionPolicy,
        memoryPolicy: overrides.memoryPolicy || sim.state.partitionPolicy,
        evictionPolicy: overrides.evictionPolicy || sim.state.evictionPolicy,
        promotionPolicy: overrides.promotionPolicy || sim.state.promotionGranularity,
        seed: overrides.seed || sim.state.seed,
        duration: overrides.duration || sim.state.decodeSteps,
        parameters: overrides.parameters || {},
      };
    },

    queueExperiment(definition) {
      this.queue.push(definition);
      sim.persistence.saveExperiment(definition);
      return this.queue;
    },

    runExperiment(definition, runner) {
      const config = {
        workloadPreset: definition.workload,
        executionPolicy: definition.runtimePolicy,
        partitionPolicy: definition.memoryPolicy,
        evictionPolicy: definition.evictionPolicy,
        promotionGranularity: definition.promotionPolicy,
        seed: definition.seed,
        decodeSteps: definition.duration,
        ...definition.parameters,
      };
      const snapshot = runner(config, { persistTelemetry: false, persistResult: false });
      const checksums = sim.reproducibility.buildChecksums(config, snapshot);
      const result = {
        name: definition.name,
        config,
        checksums,
        metrics: snapshot.metricsSummary,
        benchmark: snapshot.benchmarkComparison,
        orchestrator: snapshot.orchestrator,
        createdAt: new Date().toISOString(),
      };
      sim.persistence.saveResult(result);
      return result;
    },

    runBatch(runner) {
      return this.queue.map((definition) => this.runExperiment(definition, runner));
    },

    comparePolicies(policyNames, runner) {
      const list = policyNames.slice(0, 6).map((policy) => this.runExperiment(this.makeDefinition({
        name: `Policy ${policy}`,
        runtimePolicy: policy,
      }), runner));
      this.lastComparison = list;
      return list;
    },

    runSweep(sweepConfig, runner) {
      const configs = sim.sweeps.buildSweep(sweepConfig);
      const results = configs.map((parameters, index) => this.runExperiment(this.makeDefinition({
        name: `${sweepConfig.name || "Sweep"} ${index + 1}`,
        parameters,
      }), runner));
      this.lastSweep = results;
      return results;
    },
  };
})();
