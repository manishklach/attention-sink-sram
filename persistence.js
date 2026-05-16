(function () {
  const sim = window.AttentionSinkSim;
  const KEY = "attention-sink-sram-research-db";

  function readDb() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { experiments: [], results: [], notes: [], traces: [] };
    } catch (error) {
      return { experiments: [], results: [], notes: [], traces: [] };
    }
  }

  function writeDb(next) {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }

  sim.persistence = {
    load() {
      return readDb();
    },

    saveExperiment(experiment) {
      const db = readDb();
      db.experiments.unshift(experiment);
      db.experiments = db.experiments.slice(0, 40);
      writeDb(db);
    },

    saveResult(result) {
      const db = readDb();
      db.results.unshift(result);
      db.results = db.results.slice(0, 80);
      writeDb(db);
    },

    saveNote(note) {
      const db = readDb();
      db.notes.unshift(note);
      db.notes = db.notes.slice(0, 60);
      writeDb(db);
    },

    saveTrace(trace) {
      const db = readDb();
      db.traces.unshift(trace);
      db.traces = db.traces.slice(0, 20);
      writeDb(db);
    },
  };
})();
