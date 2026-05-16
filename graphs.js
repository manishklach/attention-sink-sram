(function () {
  const sim = window.AttentionSinkSim;

  function buildPath(points, width, height, minValue, maxValue) {
    if (!points.length) {
      return "";
    }
    const span = Math.max(0.0001, maxValue - minValue);
    return points
      .map((point, index) => {
        const x = 60 + (index / Math.max(1, points.length - 1)) * (width - 120);
        const y = height - 40 - ((point.value - minValue) / span) * (height - 90);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  function exportSvgAsPng(svgElement, filename) {
    const source = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function onLoad() {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 520;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdfa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  sim.graphs = {
    renderSeries(containerId, title, series, yLabel) {
      const svg = document.getElementById(containerId);
      if (!svg) {
        return;
      }
      const width = 1200;
      const height = 320;
      const values = series.flatMap((line) => line.points.map((point) => point.value));
      const minValue = values.length ? Math.min(...values) : 0;
      const maxValue = values.length ? Math.max(...values) : 1;
      svg.innerHTML = `
        <rect x="24" y="18" width="${width - 48}" height="${height - 36}" rx="18" fill="#fffdfa" stroke="#ddd2c4"></rect>
        <text x="48" y="48" font-size="22" font-weight="700" fill="#191613">${title}</text>
        <text x="48" y="74" font-size="13" fill="#615a54">${yLabel}</text>
        <line x1="60" y1="${height - 40}" x2="${width - 40}" y2="${height - 40}" stroke="#c9bbab"></line>
        <line x1="60" y1="90" x2="60" y2="${height - 40}" stroke="#c9bbab"></line>
        ${series
          .map((line, index) => `<path d="${buildPath(line.points, width, height, minValue, maxValue)}" fill="none" stroke="${line.color || ["#0e5f66", "#1c7a51", "#8b4a2e", "#aa4038", "#5a4d8c", "#0c7cba"][index % 6]}" stroke-width="3"></path>`)
          .join("")}
        ${series
          .map((line, index) => `<text x="${70 + index * 180}" y="${height - 12}" font-size="13" fill="${line.color || ["#0e5f66", "#1c7a51", "#8b4a2e", "#aa4038", "#5a4d8c", "#0c7cba"][index % 6]}">${line.label}</text>`)
          .join("")}
      `;
    },

    exportFigure(svgId, baseName, csvRows) {
      const svg = document.getElementById(svgId);
      if (!svg) {
        return;
      }
      const source = svg.outerHTML;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
      link.download = `${baseName}.svg`;
      link.click();
      if (csvRows) {
        const csv = csvRows.map((row) => row.join(",")).join("\n");
        const csvLink = document.createElement("a");
        csvLink.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        csvLink.download = `${baseName}.csv`;
        csvLink.click();
      }
      exportSvgAsPng(svg, `${baseName}.png`);
    },
  };
})();
