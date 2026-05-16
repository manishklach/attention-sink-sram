(function () {
  const sim = window.AttentionSinkSim;

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function next() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  sim.reproducibility = {
    seededRng(seed) {
      return mulberry32(seed);
    },

    stableStringify,

    hashObject(value) {
      return hashString(stableStringify(value));
    },

    buildChecksums(config, snapshot) {
      return {
        configHash: this.hashObject(config),
        traceHash: this.hashObject(snapshot.timeline),
        snapshotHash: this.hashObject({
          benchmark: snapshot.benchmarkComparison,
          routing: snapshot.routing.rows.slice(0, 40),
          telemetry: snapshot.telemetry.current,
        }),
      };
    },

    verifyReplay(config, runner) {
      const left = runner(config, { persistTelemetry: false, persistResult: false });
      const right = runner(config, { persistTelemetry: false, persistResult: false });
      const leftHash = this.hashObject(left.timeline);
      const rightHash = this.hashObject(right.timeline);
      return {
        deterministic: leftHash === rightHash,
        leftHash,
        rightHash,
      };
    },
  };
})();
