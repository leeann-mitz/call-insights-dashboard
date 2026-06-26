/* charts.js — Chart.js wrapper */

const Charts = (() => {

  const instances = {};

  const OUTCOME_COLORS = {
    'Sale':       '#16a34a',
    'Booked':     '#2563eb',
    'Saved':      '#7c3aed',
    'Declined':   '#dc2626',
    'Refunded':   '#ea580c',
    'No Contact': '#9ca3af',
  };

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1D1A1A',
        titleColor: '#FCFAFA',
        bodyColor: '#B3AAA3',
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    animation: { duration: 300 },
  };

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  /* Timeline line chart */
  function updateTimeline(data) {
    destroy('timeline');
    const ctx = document.getElementById('chart-timeline');
    if (!ctx || !data.length) return;

    instances.timeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => {
          const [,m,day] = d.date.split('-');
          return `${Number(m)}/${Number(day)}`;
        }),
        datasets: [{
          data: data.map(d => d.count),
          borderColor: '#FD3300',
          backgroundColor: 'rgba(253,51,0,0.08)',
          borderWidth: 2,
          pointRadius: data.length > 30 ? 0 : 3,
          pointBackgroundColor: '#FD3300',
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: {
            grid: { color: '#ECE9E4' },
            ticks: { color: '#7B726C', font: { size: 10, family: 'JetBrains Mono, monospace' }, maxTicksLimit: 10 },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#ECE9E4' },
            ticks: { color: '#7B726C', font: { size: 10 }, precision: 0 },
          },
        },
      },
    });
  }

  /* Outcomes doughnut */
  function updateOutcomes(data) {
    destroy('outcomes');
    const ctx = document.getElementById('chart-outcomes');
    if (!ctx || !data.length) return;

    instances.outcomes = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.outcome),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => OUTCOME_COLORS[d.outcome] || '#9ca3af'),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        cutout: '62%',
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            display: true,
            position: 'right',
            labels: {
              font: { size: 11 },
              color: '#7B726C',
              boxWidth: 10,
              padding: 10,
            },
          },
        },
      },
    });
  }

  /* Agent QA bar chart */
  function updateAgents(data) {
    destroy('agents');
    const ctx = document.getElementById('chart-agents');
    if (!ctx || !data.length) return;

    const top = data.slice(0, 8);
    instances.agents = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(a => a.agent.split(' ')[0]),
        datasets: [{
          data: top.map(a => a.avgQA),
          backgroundColor: top.map(a =>
            a.avgQA >= 80 ? 'rgba(22,163,74,0.85)' :
            a.avgQA >= 60 ? 'rgba(202,138,4,0.85)' :
                            'rgba(220,38,38,0.75)'
          ),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true, max: 100,
            grid: { color: '#ECE9E4' },
            ticks: { color: '#7B726C', font: { size: 10 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#7B726C', font: { size: 10 } },
          },
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: ctx => ` QA: ${ctx.raw}/100  (${data[ctx.dataIndex]?.calls || 0} calls)`,
            },
          },
        },
      },
    });
  }

  /* LOB calls bar chart */
  function updateLob(data) {
    destroy('lob');
    const ctx = document.getElementById('chart-lob');
    if (!ctx || !data.length) return;

    instances.lob = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.lob),
        datasets: [{
          label: 'Calls',
          data: data.map(d => d.calls),
          backgroundColor: 'rgba(37,99,235,0.75)',
          borderRadius: 6,
          borderSkipped: false,
        }, {
          label: 'Sales',
          data: data.map(d => d.sales),
          backgroundColor: 'rgba(22,163,74,0.75)',
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#7B726C', font: { size: 10 }, maxRotation: 30 },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#ECE9E4' },
            ticks: { color: '#7B726C', font: { size: 10 }, precision: 0 },
          },
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: true, position: 'top',
            labels: { font: { size: 11 }, color: '#7B726C', boxWidth: 10, padding: 14 } },
        },
      },
    });
  }

  function updateAll(filteredCalls, period) {
    updateTimeline(Analytics.timeline(filteredCalls, period));
    updateOutcomes(Analytics.outcomes(filteredCalls));
    updateAgents(Analytics.agentStats(filteredCalls));
    updateLob(Analytics.lobStats(filteredCalls));
  }

  return { updateAll };

})();
