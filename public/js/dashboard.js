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

  const { labels, series, assets, methods, contracts } = data;

  const realUsageCtx = getContext('chart-real-usage');
  if (realUsageCtx) {
    new Chart(realUsageCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Real usage',
            data: series.realUsage,
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
    new Chart(typeCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Swaps',
            data: series.swaps,
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
          },
          {
            label: 'Transfers',
            data: series.transfers,
            backgroundColor: 'rgba(14, 165, 164, 0.7)',
          },
          {
            label: 'Gas claims',
            data: series.gasClaims,
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
    new Chart(addressCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Active addresses',
            data: series.activeAddresses,
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

  const assetCtx = getContext('chart-assets');
  if (assetCtx) {
    new Chart(assetCtx, {
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

  const methodCtx = getContext('chart-methods');
  if (methodCtx) {
    new Chart(methodCtx, {
      type: 'bar',
      data: {
        labels: methods.map((entry) => entry.key),
        datasets: [
          {
            label: 'Invocations',
            data: methods.map((entry) => entry.count),
            backgroundColor: 'rgba(14, 165, 164, 0.7)',
            borderRadius: 8,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { beginAtZero: true },
        },
      },
    });
  }

  const contractCtx = getContext('chart-contracts');
  if (contractCtx) {
    new Chart(contractCtx, {
      type: 'bar',
      data: {
        labels: contracts.map((entry) => entry.key),
        datasets: [
          {
            label: 'Invocations',
            data: contracts.map((entry) => entry.count),
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
            borderRadius: 8,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { beginAtZero: true },
        },
      },
    });
  }
})();
