import {
  Chart,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
} from 'chart.js';
import type { DefiChartData } from '../app/types';

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

export const initDefiCharts = (data: DefiChartData) => {
  if (!data) {
    return;
  }

  Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';
  Chart.defaults.color = '#3d342a';
  Chart.defaults.borderColor = 'rgba(31, 27, 22, 0.12)';
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.point.hitRadius = 12;
  Chart.defaults.elements.point.borderWidth = 2;
  Chart.defaults.elements.point.backgroundColor = '#fffdfa';

  const accent = getCssVar('--accent', '#16a34a');
  const accentRgb = getCssVar('--accent-rgb', '22, 163, 74');
  const accent2 = getCssVar('--accent-2', '#0ea5a4');
  const accent2Rgb = getCssVar('--accent-2-rgb', '14, 165, 164');
  const { labels, series } = data;

  const swapUsdCtx = getContext('chart-defi-swap-usd');
  if (swapUsdCtx) {
    createChart(swapUsdCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Estimated swap USD value',
            data: series.swapUsdValue,
            borderColor: accent,
            backgroundColor: withAlpha(accentRgb, 0.2),
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

  const swapsCtx = getContext('chart-defi-swaps');
  if (swapsCtx) {
    createChart(swapsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Swap transactions',
            data: series.swaps,
            borderColor: accent2,
            backgroundColor: withAlpha(accent2Rgb, 0.18),
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
};
