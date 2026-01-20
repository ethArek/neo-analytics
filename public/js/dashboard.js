(() => {
  const data = window.__DASHBOARD__;
  if (!data || !window.Chart) {
    return;
  }

  const getCssVar = (name, fallback) => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!value) {
      return fallback;
    }

    return value;
  };

  const withAlpha = (rgbValue, alpha) => `rgba(${rgbValue}, ${alpha})`;

  Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';
  Chart.defaults.color = "#3d342a";
  Chart.defaults.borderColor = "rgba(31, 27, 22, 0.12)";
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.point.hitRadius = 12;
  Chart.defaults.elements.point.borderWidth = 2;
  Chart.defaults.elements.point.backgroundColor = "#fffdfa";

  const getContext = (id) => {
    const canvas = document.getElementById(id);
    if (!canvas) {
      return null;
    }

    return canvas.getContext("2d");
  };

  const accent = getCssVar("--accent", "#16a34a");

  const swapColor = "#f97316";
  const swapRgb = "249, 115, 22";
  const transferColor = "#0ea5a4";
  const transferRgb = "14, 165, 164";
  const gasColor = "#f59e0b";
  const gasRgb = "245, 158, 11";
  const totalTxColor = "#2563eb";
  const totalTxRgb = "37, 99, 235";

  const palette = [
    swapColor,
    transferColor,
    gasColor,
    totalTxColor,
    "#d946ef",
    accent,
  ];
  const buildPalette = (count) => {
    const colors = [];
    for (let i = 0; i < count; i += 1) {
      colors.push(palette[i % palette.length]);
    }

    return colors;
  };

  const toNumberSafe = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  };

  const normalizeSeries = (value, labelsCount, fallback) => {
    if (Array.isArray(value)) {
      return value.map((entry) => toNumberSafe(entry));
    }

    if (typeof fallback === "function") {
      return normalizeSeries(fallback(), labelsCount);
    }

    return Array.from({ length: labelsCount }, () => 0);
  };

  const formatPercent = (value, decimals = 1) => {
    if (!Number.isFinite(value)) {
      return "0%";
    }

    const rounded = Number(value.toFixed(decimals));

    return `${rounded}%`;
  };

  const createChart = (ctx, config) => {
    const existing = Chart.getChart(ctx.canvas);
    if (existing) {
      existing.destroy();
    }

    return new Chart(ctx, config);
  };

  const { labels, series, assets } = data;

  const realUsageCtx = getContext("chart-real-usage");
  if (realUsageCtx) {
    createChart(realUsageCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Neo N3 activity",
            data: normalizeSeries(series.realUsage, labels.length),
            borderColor: swapColor,
            backgroundColor: withAlpha(swapRgb, 0.2),
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  const typeCtx = getContext("chart-types");
  if (typeCtx) {
    const swapSeries = normalizeSeries(series.swaps, labels.length);
    const transferSeries = normalizeSeries(series.transfers, labels.length);
    const gasSeries = normalizeSeries(series.gasClaims, labels.length);
    const typeTotals = labels.map((_, index) => {
      return swapSeries[index] + transferSeries[index] + gasSeries[index];
    });
    const swapPercent = swapSeries.map((value, index) => {
      const total = typeTotals[index];
      if (total <= 0) {
        return 0;
      }

      return (value / total) * 100;
    });
    const transferPercent = transferSeries.map((value, index) => {
      const total = typeTotals[index];
      if (total <= 0) {
        return 0;
      }

      return (value / total) * 100;
    });
    const gasPercent = gasSeries.map((value, index) => {
      const total = typeTotals[index];
      if (total <= 0) {
        return 0;
      }

      return (value / total) * 100;
    });

    createChart(typeCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Swaps",
            data: swapPercent,
            backgroundColor: withAlpha(swapRgb, 0.7),
          },
          {
            label: "Transfers",
            data: transferPercent,
            backgroundColor: withAlpha(transferRgb, 0.7),
          },
          {
            label: "Gas claims",
            data: gasPercent,
            backgroundColor: withAlpha(gasRgb, 0.7),
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (context) => {
                const datasetIndex = context.datasetIndex ?? 0;
                const dataIndex = context.dataIndex ?? 0;
                const total = typeTotals[dataIndex] ?? 0;
                const label = context.dataset.label ?? "";
                const counts = [swapSeries, transferSeries, gasSeries];
                const count = counts[datasetIndex]?.[dataIndex] ?? 0;
                const percent = total > 0 ? (count / total) * 100 : 0;

                return `${label}: ${count} (${formatPercent(percent)})`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
        },
      },
    });
  }

  const addressCtx = getContext("chart-addresses");
  if (addressCtx) {
    createChart(addressCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Active addresses",
            data: normalizeSeries(series.activeAddresses, labels.length),
            borderColor: transferColor,
            backgroundColor: withAlpha(transferRgb, 0.2),
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  const totalTxCtx = getContext("chart-total-txs");
  if (totalTxCtx) {
    const fallbackTotalTxs = () =>
      labels.map((_, index) => {
        const realUsage = toNumberSafe(series.realUsage?.[index]);
        const gasClaims = toNumberSafe(series.gasClaims?.[index]);

        return realUsage + gasClaims;
      });

    createChart(totalTxCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total transactions",
            data: normalizeSeries(
              series.totalTxs,
              labels.length,
              fallbackTotalTxs
            ),
            borderColor: totalTxColor,
            backgroundColor: withAlpha(totalTxRgb, 0.18),
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  const swapsCtx = getContext("chart-swaps");
  if (swapsCtx) {
    createChart(swapsCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Swaps",
            data: normalizeSeries(series.swaps, labels.length),
            borderColor: gasColor,
            backgroundColor: withAlpha(gasRgb, 0.18),
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  const assetCtx = getContext("chart-assets");
  if (assetCtx) {
    const assetValues = assets.values.map((value) => toNumberSafe(value));
    const assetTotal = assetValues.reduce((total, value) => total + value, 0);

    createChart(assetCtx, {
      type: "doughnut",
      data: {
        labels: assets.labels,
        datasets: [
          {
            data: assetValues,
            backgroundColor: buildPalette(assetValues.length),
            borderWidth: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              generateLabels: (chart) => {
                const baseLabels =
                  Chart.defaults.plugins.legend.labels.generateLabels(chart);

                return baseLabels.map((item) => {
                  const value = assetValues[item.index] ?? 0;
                  const percent = assetTotal > 0 ? (value / assetTotal) * 100 : 0;

                  return {
                    ...item,
                    text: `${item.text} (${formatPercent(percent)})`,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = assetValues[context.dataIndex] ?? 0;
                const percent = assetTotal > 0 ? (value / assetTotal) * 100 : 0;
                const label = context.label ?? "";

                return `${label}: ${value} (${formatPercent(percent)})`;
              },
            },
          },
        },
        cutout: "65%",
      },
    });
  }
})();
