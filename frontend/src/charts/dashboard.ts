import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  type ChartConfiguration,
  type ChartType,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { Theme } from '../app/theme';
import type { DashboardChartData } from '../app/types';

Chart.register(
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const getCssVar = (name: string, fallback: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) {
    return fallback;
  }

  return value;
};

const withAlpha = (rgbValue: string, alpha: number) => `rgba(${rgbValue}, ${alpha})`;

const getContext = (id: string) => {
  const canvas = document.getElementById(id) as HTMLCanvasElement | null;
  if (!canvas) {
    return null;
  }

  return canvas.getContext('2d');
};

const toNumberSafe = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const normalizeSeries = (value: unknown, labelsCount: number, fallback?: () => number[]) => {
  if (Array.isArray(value)) {
    return value.map((entry) => toNumberSafe(entry));
  }

  if (fallback) {
    return normalizeSeries(fallback(), labelsCount);
  }

  return Array.from({ length: labelsCount }, () => 0);
};

const formatPercent = (value: number, decimals = 1) => {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  const rounded = Number(value.toFixed(decimals));

  return `${rounded}%`;
};

const createChart = <TType extends ChartType>(
  ctx: CanvasRenderingContext2D,
  config: ChartConfiguration<TType>,
) => {
  const existing = Chart.getChart(ctx.canvas);
  if (existing) {
    existing.destroy();
  }

  return new Chart(ctx, config);
};

export const initDashboardCharts = (data: DashboardChartData, theme: Theme = 'light') => {
  if (!data) {
    return;
  }

  const chartInk = getCssVar('--ink', theme === 'dark' ? '#f3f6fb' : '#0a1f14');
  const chartBorder = getCssVar(
    '--chart-border',
    theme === 'dark' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(10, 31, 20, 0.12)',
  );
  const chartCard = getCssVar('--card', theme === 'dark' ? '#111827' : '#ffffff');
  const tooltipBackground = getCssVar(
    '--tooltip-bg',
    theme === 'dark' ? 'rgba(2, 6, 23, 0.94)' : 'rgba(10, 31, 20, 0.92)',
  );
  const tooltipInk = getCssVar('--tooltip-ink', theme === 'dark' ? '#f3f6fb' : '#ffffff');

  Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';
  Chart.defaults.color = chartInk;
  Chart.defaults.borderColor = chartBorder;
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.point.hitRadius = 12;
  Chart.defaults.elements.point.borderWidth = 2;
  Chart.defaults.elements.point.backgroundColor = chartCard;
  Chart.defaults.plugins.legend.labels.color = chartInk;
  Chart.defaults.plugins.tooltip.backgroundColor = tooltipBackground;
  Chart.defaults.plugins.tooltip.titleColor = tooltipInk;
  Chart.defaults.plugins.tooltip.bodyColor = tooltipInk;
  Chart.defaults.plugins.tooltip.borderColor = chartBorder;
  Chart.defaults.plugins.tooltip.borderWidth = 1;

  const accent = getCssVar('--accent', '#16a34a');

  const swapColor = '#f97316';
  const swapRgb = '249, 115, 22';
  const oracleColor = '#8b5cf6';
  const oracleRgb = '139, 92, 246';
  const transferColor = '#0ea5a4';
  const transferRgb = '14, 165, 164';
  const gasColor = '#f59e0b';
  const gasRgb = '245, 158, 11';
  const othersRgb = '100, 116, 139';
  const totalTxColor = '#2563eb';
  const totalTxRgb = '37, 99, 235';

  const palette = [swapColor, oracleColor, transferColor, gasColor, totalTxColor, '#d946ef', accent];
  const buildPalette = (count: number) => {
    const colors: string[] = [];
    for (let i = 0; i < count; i += 1) {
      colors.push(palette[i % palette.length]);
    }

    return colors;
  };

  const { labels, series, assets } = data;

  const activityCtx = getContext('chart-activity');
  if (activityCtx) {
    createChart(activityCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Transactions excluding GAS claims',
            data: normalizeSeries(series.transactionsExcludingGasClaims, labels.length),
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
          mode: 'index',
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

  const typeCtx = getContext('chart-types');
  if (typeCtx) {
    const swapSeries = normalizeSeries(series.swaps, labels.length);
    const oracleSeries = normalizeSeries(series.oracle, labels.length);
    const transferSeries = normalizeSeries(series.transfers, labels.length);
    const gasSeries = normalizeSeries(series.gasClaims, labels.length);
    const othersSeries = normalizeSeries(series.others, labels.length);
    const typeTotals = labels.map((_, index) => {
      return (
        swapSeries[index] +
        oracleSeries[index] +
        transferSeries[index] +
        gasSeries[index] +
        othersSeries[index]
      );
    });
    const swapPercent = swapSeries.map((value, index) => {
      const total = typeTotals[index];
      if (total <= 0) {
        return 0;
      }

      return (value / total) * 100;
    });
    const oraclePercent = oracleSeries.map((value, index) => {
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
    const othersPercent = othersSeries.map((value, index) => {
      const total = typeTotals[index];
      if (total <= 0) {
        return 0;
      }

      return (value / total) * 100;
    });

    createChart(typeCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Swaps',
            data: swapPercent,
            backgroundColor: withAlpha(swapRgb, 0.7),
          },
          {
            label: 'Oracle',
            data: oraclePercent,
            backgroundColor: withAlpha(oracleRgb, 0.7),
          },
          {
            label: 'Transfers',
            data: transferPercent,
            backgroundColor: withAlpha(transferRgb, 0.7),
          },
          {
            label: 'Gas claims',
            data: gasPercent,
            backgroundColor: withAlpha(gasRgb, 0.7),
          },
          {
            label: 'Others',
            data: othersPercent,
            backgroundColor: withAlpha(othersRgb, 0.7),
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context: {
                datasetIndex?: number;
                dataIndex?: number;
                dataset: { label?: string };
              }) => {
                const datasetIndex = context.datasetIndex ?? 0;
                const dataIndex = context.dataIndex ?? 0;
                const total = typeTotals[dataIndex] ?? 0;
                const label = context.dataset.label ?? '';
                const counts = [swapSeries, oracleSeries, transferSeries, gasSeries, othersSeries];
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
              callback: (value: number | string) => `${value}%`,
            },
          },
        },
      },
    });
  }

  const addressCtx = getContext('chart-addresses');
  if (addressCtx) {
    createChart(addressCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Active addresses',
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
          mode: 'index',
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

  const totalTxCtx = getContext('chart-total-txs');
  if (totalTxCtx) {
    const fallbackTotalTxs = () =>
      labels.map((_, index) => {
        const transactionsExcludingGasClaims = toNumberSafe(
          series.transactionsExcludingGasClaims?.[index],
        );
        const gasClaims = toNumberSafe(series.gasClaims?.[index]);

        return transactionsExcludingGasClaims + gasClaims;
      });

    createChart(totalTxCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total transactions',
            data: normalizeSeries(series.totalTxs, labels.length, fallbackTotalTxs),
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
          mode: 'index',
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

  const swapsCtx = getContext('chart-swaps');
  if (swapsCtx) {
    createChart(swapsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Swaps',
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
          mode: 'index',
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

  const assetCtx = getContext('chart-assets');
  if (assetCtx) {
    const assetValues = (assets?.values ?? []).map((value) => toNumberSafe(value));
    const rawLabels = Array.isArray(assets?.labels) ? assets.labels : [];
    const assetLabels = assetValues.map((_, index) => {
      const label = rawLabels[index];
      if (typeof label === 'string' && label.trim()) {
        return label;
      }

      return `Unknown ${index + 1}`;
    });
    const assetTotal = assetValues.reduce((total, value) => total + value, 0);
    const buildLegendItems = (chartInstance: Chart) => {
      const meta = chartInstance.getDatasetMeta(0);
      const controller = meta?.controller;

      return assetLabels.map((label, index) => {
        const style = controller?.getStyle(index, false) ?? {};

        return {
          text: label,
          fillStyle: style.backgroundColor,
          strokeStyle: style.borderColor,
          lineWidth: style.borderWidth,
          hidden: !chartInstance.getDataVisibility(index),
          index,
        };
      });
    };

    createChart(assetCtx, {
      type: 'doughnut',
      data: {
        labels: assetLabels,
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
            position: 'bottom',
            labels: {
              color: chartInk,
              generateLabels: (chartInstance: Chart) => {
                const baseLabels =
                  Chart.defaults.plugins.legend.labels.generateLabels(chartInstance);
                if (baseLabels.length !== assetLabels.length) {
                  return buildLegendItems(chartInstance).map((item) => ({
                    ...item,
                    fontColor: chartInk,
                  }));
                }

                return baseLabels.map((item, index) => {
                  const itemIndex =
                    typeof item.index === 'number' && Number.isFinite(item.index)
                      ? item.index
                      : index;
                  const label = assetLabels[itemIndex] ?? `Unknown ${itemIndex + 1}`;

                  return {
                    ...item,
                    fontColor: chartInk,
                    text: label,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (context: { dataIndex?: number; label?: string }) => {
                const dataIndex = Number.isFinite(context.dataIndex)
                  ? (context.dataIndex as number)
                  : 0;
                const value = assetValues[dataIndex] ?? 0;
                const percent = assetTotal > 0 ? (value / assetTotal) * 100 : 0;
                const label = assetLabels[dataIndex] ?? context.label ?? `Unknown ${dataIndex + 1}`;

                return `${label}: ${value} (${formatPercent(percent)})`;
              },
            },
          },
        },
        cutout: '65%',
      },
    });
  }
};
