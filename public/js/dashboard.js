(() => {
  // Theme management
  let colorProbe = null;

  const getColorProbe = () => {
    if (colorProbe) {
      return colorProbe;
    }

    colorProbe = document.createElement("span");
    colorProbe.style.position = "absolute";
    colorProbe.style.width = "0";
    colorProbe.style.height = "0";
    colorProbe.style.overflow = "hidden";
    colorProbe.style.pointerEvents = "none";
    colorProbe.style.opacity = "0";
    document.documentElement.appendChild(colorProbe);

    return colorProbe;
  };

  const resolveCssColorVar = (name, fallback) => {
    const probe = getColorProbe();
    probe.style.color = `var(${name}, ${fallback})`;

    return getComputedStyle(probe).color.trim() || fallback;
  };

  const readCssVar = (name, fallback) => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (value) {
      return value;
    }

    return fallback;
  };

  const getThemeColors = () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

    return {
      textColor: resolveCssColorVar(
        "--chart-text-color",
        isDark ? "#ffffff" : "#1f1b16"
      ),
      gridColor: resolveCssColorVar(
        "--chart-grid-color",
        isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(31, 27, 22, 0.12)"
      ),
      legendColor: resolveCssColorVar(
        "--chart-legend-color",
        isDark ? "#ffffff" : "#1f1b16"
      ),
      tickColor: resolveCssColorVar(
        "--chart-tick-color",
        isDark ? "#ffffff" : "#1f1b16"
      ),
      tickFontWeight: readCssVar("--chart-tick-weight", isDark ? "600" : "500"),
      legendFontWeight: readCssVar(
        "--chart-legend-weight",
        isDark ? "600" : "500"
      ),
      tooltipBg: resolveCssColorVar(
        "--chart-tooltip-bg",
        isDark ? "rgba(10, 15, 24, 0.98)" : "rgba(255, 255, 255, 0.95)"
      ),
      tooltipText: resolveCssColorVar(
        "--chart-tooltip-text",
        isDark ? "#ffffff" : "#1e293b"
      ),
      tooltipBorder: resolveCssColorVar(
        "--chart-tooltip-border",
        isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.1)"
      ),
    };
  };

  const updateChartDefaults = () => {
    if (!window.Chart) {
      return;
    }
    const colors = getThemeColors();
    Chart.defaults.color = colors.textColor;
    Chart.defaults.borderColor = colors.gridColor;

    // Update tooltip defaults
    Chart.defaults.plugins.tooltip.backgroundColor = colors.tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor = colors.tooltipText;
    Chart.defaults.plugins.tooltip.bodyColor = colors.tooltipText;
    Chart.defaults.plugins.tooltip.borderColor = colors.tooltipBorder;
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    // Update legend defaults
    Chart.defaults.plugins.legend.labels.color = colors.legendColor;
    Chart.defaults.plugins.legend.labels.font =
      Chart.defaults.plugins.legend.labels.font || {};
    Chart.defaults.plugins.legend.labels.font.weight = colors.legendFontWeight;
  };

  const updateAllCharts = () => {
    if (!window.Chart) {
      return;
    }
    const colors = getThemeColors();

    const instances = Chart.instances;
    const charts = Array.isArray(instances)
      ? instances
      : typeof instances?.forEach === "function"
      ? (() => {
          const collected = [];
          instances.forEach((chart) => {
            collected.push(chart);
          });

          return collected;
        })()
      : Object.values(instances || {});

    charts.forEach((chart) => {
      if (chart?.options?.scales) {
        Object.values(chart.options.scales).forEach((scale) => {
          if (!scale) {
            return;
          }

          scale.ticks = scale.ticks || {};
          scale.ticks.color = colors.tickColor;
          scale.ticks.font = scale.ticks.font || {};
          scale.ticks.font.weight = colors.tickFontWeight;
          scale.grid = scale.grid || {};
          scale.grid.color = colors.gridColor;
          if (scale.title) {
            scale.title.color = colors.textColor;
          }
        });
      }
      if (chart?.options?.plugins) {
        if (chart.options.plugins.legend) {
          chart.options.plugins.legend.labels =
            chart.options.plugins.legend.labels || {};
          chart.options.plugins.legend.labels.color = colors.legendColor;
          chart.options.plugins.legend.labels.font =
            chart.options.plugins.legend.labels.font || {};
          chart.options.plugins.legend.labels.font.weight =
            colors.legendFontWeight;
        }
        if (chart.options.plugins.tooltip) {
          chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
          chart.options.plugins.tooltip.titleColor = colors.tooltipText;
          chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
          chart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
        }
      }
      chart.update("none");
    });
  };

  // Theme toggle handler
  const initThemeToggle = () => {
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const isDark =
          document.documentElement.getAttribute("data-theme") === "dark";
        const newTheme = isDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("neo-theme", newTheme);
        requestAnimationFrame(() => {
          updateChartDefaults();
          updateAllCharts();
        });
      });
    }
  };

  initThemeToggle();

  const data = window.__DASHBOARD__;
  if (!data || !window.Chart) {
    return;
  }

  // Apply theme colors on initial load
  updateChartDefaults();

  Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';

  const getContext = (id) => {
    const canvas = document.getElementById(id);
    if (!canvas) {
      return null;
    }

    return canvas.getContext("2d");
  };

  const palette = [
    "#f97316",
    "#0ea5a4",
    "#f59e0b",
    "#2563eb",
    "#d946ef",
    "#16a34a",
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

  const createChart = (ctx, config) => {
    const existing = Chart.getChart(ctx.canvas);
    if (existing) {
      existing.destroy();
    }

    // Apply current theme colors to scales
    const colors = getThemeColors();
    if (config.options && config.options.scales) {
      Object.keys(config.options.scales).forEach((key) => {
        const scale = config.options.scales[key];
        scale.ticks = scale.ticks || {};
        scale.ticks.color = colors.tickColor;
        scale.ticks.font = scale.ticks.font || {};
        scale.ticks.font.weight = colors.tickFontWeight;
        scale.grid = scale.grid || {};
        scale.grid.color = colors.gridColor;
        if (scale.title) {
          scale.title.color = colors.textColor;
        }
      });
    }

    // Apply theme colors to legend
    if (
      config.options &&
      config.options.plugins &&
      config.options.plugins.legend
    ) {
      config.options.plugins.legend.labels =
        config.options.plugins.legend.labels || {};
      config.options.plugins.legend.labels.color = colors.legendColor;
      config.options.plugins.legend.labels.font =
        config.options.plugins.legend.labels.font || {};
      config.options.plugins.legend.labels.font.weight =
        colors.legendFontWeight;
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
            label: "Real usage",
            data: normalizeSeries(series.realUsage, labels.length),
            borderColor: "#f97316",
            backgroundColor: "rgba(249, 115, 22, 0.2)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
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
    createChart(typeCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Swaps",
            data: normalizeSeries(series.swaps, labels.length),
            backgroundColor: "rgba(249, 115, 22, 0.7)",
          },
          {
            label: "Transfers",
            data: normalizeSeries(series.transfers, labels.length),
            backgroundColor: "rgba(14, 165, 164, 0.7)",
          },
          {
            label: "Gas claims",
            data: normalizeSeries(series.gasClaims, labels.length),
            backgroundColor: "rgba(245, 158, 11, 0.7)",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
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
            borderColor: "#0ea5a4",
            backgroundColor: "rgba(14, 165, 164, 0.2)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
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
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.18)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
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
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.18)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
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
    createChart(assetCtx, {
      type: "doughnut",
      data: {
        labels: assets.labels,
        datasets: [
          {
            data: assets.values,
            backgroundColor: buildPalette(assets.values.length),
            borderWidth: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
        },
        cutout: "65%",
      },
    });
  }

  updateAllCharts();
})();
