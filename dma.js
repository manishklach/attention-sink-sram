(function () {
  const sim = window.AttentionSinkSim;

  sim.dma = {
    descriptorFromEntry(entry, sessionId, enqueueTime, reason) {
      const id = `DMA-${sessionId}-${entry.entryId}-${enqueueTime}`;
      const bytes = entry.bytes;
      const duration = Math.max(1, Math.ceil(bytes / (sim.state.dmaBandwidth * 256)));
      return {
        id,
        sessionId,
        tokenRange: entry.tokenRange,
        heads: entry.headRange,
        layers: entry.layerRange,
        bytes,
        source: "HBM",
        destination: "SRAM",
        enqueueTime,
        completionTime: enqueueTime + duration,
        latency: duration,
        reason,
      };
    },

    buildQueue(directory, sessions) {
      const descriptors = [];
      let clock = 0;

      sessions.forEach((session, sessionIndex) => {
        const sessionEntries = directory.entries.filter(
          (entry) => entry.sessionId === session.sessionId || (entry.shared && session.attachedSharedPrefix)
        );
        sessionEntries
          .filter((entry, index) => entry.shared || index < Math.max(1, sim.state.promotedHeads))
          .forEach((entry, index) => {
            descriptors.push(
              this.descriptorFromEntry(
                entry,
                session.sessionId,
                clock + sessionIndex * 2 + index,
                entry.shared ? "shared-prefix-attach" : "sink-promotion"
              )
            );
          });
      });

      descriptors.sort((a, b) => a.enqueueTime - b.enqueueTime);
      const active = [];
      const queued = [];
      const completed = [];
      let time = 0;
      let cursor = 0;

      while (cursor < descriptors.length || active.length > 0) {
        while (cursor < descriptors.length && descriptors[cursor].enqueueTime <= time) {
          queued.push(descriptors[cursor]);
          cursor += 1;
        }

        while (active.length < sim.state.dmaSlots && queued.length > 0) {
          const next = queued.shift();
          next.startTime = time;
          next.completionTime = Math.max(next.completionTime, time + next.latency);
          active.push(next);
        }

        const completedNow = active.filter((item) => item.completionTime <= time);
        completedNow.forEach((item) => {
          completed.push(item);
        });
        for (let index = active.length - 1; index >= 0; index -= 1) {
          if (active[index].completionTime <= time) {
            active.splice(index, 1);
          }
        }

        time += 1;
        if (time > 2000) {
          break;
        }
      }

      const totalBytes = descriptors.reduce((sum, descriptor) => sum + descriptor.bytes, 0);
      const utilization = Math.min(
        100,
        (totalBytes / Math.max(1, time * sim.state.dmaBandwidth * 256)) * 100 * sim.state.dmaSlots
      );

      return {
        descriptors,
        active,
        queued,
        completed: completed.slice(-12).reverse(),
        totalBytes,
        utilization,
      };
    },
  };
})();
