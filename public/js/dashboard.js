(() => {
  const data = window.__DASHBOARD__;
  if (!data || !window.Chart) {

    return;
  }

  Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';
  Chart.defaults.color = '#3d342a';
  Chart.defaults.borderColor = 'rgba(31, 27, 22, 0.12)';

  const getContext = (id) => {
    const canvas = document.getElementById(id);
    if (!canvas) {

      return null;
    }

    return canvas.getContext('2d');
  };

  const palette = ['#f97316', '#0ea5a4', '#f59e0b', '#2563eb', '#d946ef', '#16a34a'];
  const buildPalette = (count) => {
    const colors = [];
    for (let i = 0; i < count; i += 1) {
      colors.push(palette[i % palette.length]);
    }

    return colors;
  };

  const toNumberSafe = (value) => {
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

  const normalizeSeries = (value, labelsCount, fallback) => {
    if (Array.isArray(value)) {

      return value.map((entry) => toNumberSafe(entry));
    }

    if (typeof fallback === 'function') {

      return normalizeSeries(fallback(), labelsCount);
    }

    return Array.from({ length: labelsCount }, () => 0);
  };

  const createChart = (ctx, config) => {
    const existing = Chart.getChart(ctx.canvas);
    if (existing) {
      existing.destroy();
    }

    return new Chart(ctx, config);
  };

  const { labels, series, assets } = data;

  const realUsageCtx = getContext('chart-real-usage');
  if (realUsageCtx) {
    createChart(realUsageCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Real usage',
            data: normalizeSeries(series.realUsage, labels.length),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.2)',
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

  const typeCtx = getContext('chart-types');
  if (typeCtx) {
    createChart(typeCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Swaps',
            data: normalizeSeries(series.swaps, labels.length),
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
          },
          {
            label: 'Transfers',
            data: normalizeSeries(series.transfers, labels.length),
            backgroundColor: 'rgba(14, 165, 164, 0.7)',
          },
          {
            label: 'Gas claims',
            data: normalizeSeries(series.gasClaims, labels.length),
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
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
            borderColor: '#0ea5a4',
            backgroundColor: 'rgba(14, 165, 164, 0.2)',
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

  const totalTxCtx = getContext('chart-total-txs');
  if (totalTxCtx) {
    const fallbackTotalTxs = () =>
      labels.map((_, index) => {
        const realUsage = toNumberSafe(series.realUsage?.[index]);
        const gasClaims = toNumberSafe(series.gasClaims?.[index]);

        return realUsage + gasClaims;
      });

    createChart(totalTxCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total transactions',
            data: normalizeSeries(series.totalTxs, labels.length, fallbackTotalTxs),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.18)',
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
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.18)',
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

  const assetCtx = getContext('chart-assets');
  if (assetCtx) {
    createChart(assetCtx, {
      type: 'doughnut',
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
          legend: { position: 'bottom' },
        },
        cutout: '65%',
      },
    });
  }
})();
