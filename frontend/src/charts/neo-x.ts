import {
  CategoryScale,
  Chart,
  type ChartConfiguration,
  type ChartType,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { Theme } from '../app/theme';
import type { NeoXChartData } from '../app/types';

Chart.register(
  CategoryScale,
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

export const initNeoXCharts = (data: NeoXChartData, theme: Theme = 'light') => {
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
  const accent = getCssVar('--accent', '#16a34a');

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

  const { labels, series } = data;
  const transactionsColor = '#2563eb';
  const transactionsRgb = '37, 99, 235';
  const rollingAverageColor = '#f97316';
  const rollingAverageRgb = '249, 115, 22';
  const cumulativeColor = accent;
  const cumulativeRgb = getCssVar('--accent-rgb', '22, 163, 74');

  const sharedLineOptions = {
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  const transactionsCtx = getContext('chart-neox-transactions');
  if (transactionsCtx) {
    createChart(transactionsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Transactions',
            data: series.transactions,
            borderColor: transactionsColor,
            backgroundColor: withAlpha(transactionsRgb, 0.16),
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
        ],
      },
      options: sharedLineOptions,
    });
  }

  const rollingAverageCtx = getContext('chart-neox-rolling-average');
  if (rollingAverageCtx) {
    createChart(rollingAverageCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '7-day rolling average',
            data: series.rollingAverage,
            borderColor: rollingAverageColor,
            backgroundColor: withAlpha(rollingAverageRgb, 0.18),
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
        ],
      },
      options: sharedLineOptions,
    });
  }

  const cumulativeCtx = getContext('chart-neox-cumulative');
  if (cumulativeCtx) {
    createChart(cumulativeCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Cumulative transactions',
            data: series.cumulativeTransactions,
            borderColor: cumulativeColor,
            backgroundColor: withAlpha(cumulativeRgb, 0.18),
            fill: true,
            tension: 0.2,
            borderWidth: 2,
          },
        ],
      },
      options: sharedLineOptions,
    });
  }
};
