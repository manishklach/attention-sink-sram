(function () {
  const sim = window.AttentionSinkSim;

  function valueAt(scale, start, end, index, steps) {
    if (steps <= 1) {
      return start;
    }
    const t = index / (steps - 1);
    if (scale === "logarithmic") {
      const logStart = Math.log(Math.max(0.0001, start));
      const logEnd = Math.log(Math.max(0.0001, end));
      return Math.exp(logStart + (logEnd - logStart) * t);
    }
    return start + (end - start) * t;
  }

  function normalizeParamValue(param, value) {
    if (["sramBudget", "promotedHeads", "tenantCount", "decodeConcurrency", "executionWindowDuration"].includes(param)) {
      return Math.max(1, Math.round(value));
    }
    return Number(value.toFixed(4));
  }

  sim.sweeps = {
    buildSweep(config) {
      const primary = [];
      for (let index = 0; index < config.steps; index += 1) {
        primary.push(normalizeParamValue(config.param, valueAt(config.scale, config.start, config.end, index, config.steps)));
      }
      if (!config.secondaryParam) {
        return primary.map((value) => ({ [config.param]: value }));
      }

      const secondary = [];
      for (let index = 0; index < config.secondarySteps; index += 1) {
        secondary.push(normalizeParamValue(config.secondaryParam, valueAt(config.secondaryScale, config.secondaryStart, config.secondaryEnd, index, config.secondarySteps)));
      }

      const matrix = [];
      primary.forEach((left) => {
        secondary.forEach((right) => {
          matrix.push({
            [config.param]: left,
            [config.secondaryParam]: right,
          });
        });
      });
      return matrix;
    },
  };
})();
