import { renderShell } from '../components.js';
import { ROLE_LABELS, BRANCHES, TREND_HISTORY } from '../data.js';
import { formatAED, formatDate, canAccess } from '../scoring.js';

let chartInstance = null;

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function filterClaims(claims, period, branch) {
  const today = new Date('2026-08-11T12:00:00');
  let days = 30;
  if (period === '7') days = 7;
  if (period === 'quarter') days = 90;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  return claims.filter((c) => {
    const filed = new Date(c.filedAt + 'T12:00:00');
    if (filed < cutoff) return false;
    if (branch !== 'All branches' && c.branch !== branch) return false;
    return true;
  });
}

function drawChart(canvas, mode) {
  destroyChart();
  if (!window.Chart || !canvas) return;

  if (!TREND_HISTORY.length) {
    return;
  }

  const labels = TREND_HISTORY.map((p) => formatDate(p.date));

  if (mode === 'share') {
    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'High risk %',
            data: TREND_HISTORY.map((p) => p.redPct),
            borderColor: '#b91c1c',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 3,
          },
          {
            label: 'Medium risk %',
            data: TREND_HISTORY.map((p) => p.yellowPct),
            borderColor: '#d97706',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 3,
          },
          {
            label: 'Pass %',
            data: TREND_HISTORY.map((p) => p.greenPct),
            borderColor: '#15803d',
            backgroundColor: 'transparent',
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'IBM Plex Sans', size: 12 } } },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: (v) => v + '%' },
            grid: { color: '#eef2f6' },
          },
          x: { grid: { display: false } },
        },
      },
    });
  } else {
    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Claims scored',
            data: TREND_HISTORY.map((p) => p.volume),
            borderColor: '#0b3a5b',
            backgroundColor: 'rgba(11, 58, 91, 0.08)',
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'IBM Plex Sans', size: 12 } } },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: '#eef2f6' },
          },
          x: { grid: { display: false } },
        },
      },
    });
  }
}

export function renderDashboard(root, session, claims, state, onChange) {
  if (!canAccess(session.role, 'dashboard')) {
    location.hash = '#/queue';
    return;
  }

  const { period, branch, chartMode } = state;
  const filtered = filterClaims(claims, period, branch);

  const totalCount = filtered.length;
  const totalValue = filtered.reduce((s, c) => s + c.amount, 0);
  const red = filtered.filter((c) => c.tier === 'red');
  const yellow = filtered.filter((c) => c.tier === 'yellow');
  const green = filtered.filter((c) => c.tier === 'green');
  const cantEvalClaims = filtered.filter((c) => c.summary.cantEvaluateCount > 0);

  const redValue = red.reduce((s, c) => s + c.amount, 0);
  const yellowValue = yellow.reduce((s, c) => s + c.amount, 0);
  const greenValue = green.reduce((s, c) => s + c.amount, 0);

  const flaggedPct = totalCount ? Math.round((red.length / totalCount) * 100) : 0;
  const cantEvalPct = totalCount ? Math.round((cantEvalClaims.length / totalCount) * 100) : 0;

  const maxCount = Math.max(red.length, yellow.length, green.length, 1);
  const maxValue = Math.max(redValue, yellowValue, greenValue, 1);

  const hasTrend = TREND_HISTORY.length >= 2;

  const content = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p class="page-subtitle">Portfolio risk overview · high-level only</p>
      </div>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label for="period">Time period</label>
        <select id="period">
          <option value="7" ${period === '7' ? 'selected' : ''}>Last 7 days</option>
          <option value="30" ${period === '30' ? 'selected' : ''}>Last 30 days</option>
          <option value="quarter" ${period === 'quarter' ? 'selected' : ''}>This quarter</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="branch">Branch / region</label>
        <select id="branch">
          ${BRANCHES.map((b) => `<option value="${b}" ${branch === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="stat-tiles">
      <div class="stat-tile">
        <div class="label">Claims scored</div>
        <div class="value">${totalCount}</div>
        <div class="sub">In selected period</div>
      </div>
      <div class="stat-tile">
        <div class="label">Total claim value</div>
        <div class="value" style="font-size:1.2rem">${formatAED(totalValue)}</div>
        <div class="sub">Sum of claim amounts</div>
      </div>
      <div class="stat-tile">
        <div class="label">Flagged high-risk</div>
        <div class="value">${flaggedPct}%</div>
        <div class="sub">${formatAED(redValue)} exposed</div>
      </div>
      <div class="stat-tile">
        <div class="label">Couldn't evaluate</div>
        <div class="value">${cantEvalPct}%</div>
        <div class="sub">Data-quality indicator</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Risk breakdown</h2>
      </div>
      <div class="risk-breakdown">
        ${[
          { key: 'red', label: 'High risk', count: red.length, value: redValue },
          { key: 'yellow', label: 'Medium risk', count: yellow.length, value: yellowValue },
          { key: 'green', label: 'Pass', count: green.length, value: greenValue },
        ]
          .map(
            (row) => `
          <div class="risk-row">
            <div class="risk-row-label"><span class="dot ${row.key}"></span>${row.label}</div>
            <div class="risk-metrics">
              <div class="risk-numbers">
                <span><strong>${row.count}</strong> claims</span>
                <span><strong>${formatAED(row.value)}</strong></span>
              </div>
              <div class="bar-track"><div class="bar-fill ${row.key}" style="width:${Math.round((row.value / maxValue) * 100)}%"></div></div>
              <div class="bar-track" style="height:5px;opacity:0.65"><div class="bar-fill ${row.key}" style="width:${Math.round((row.count / maxCount) * 100)}%;opacity:0.55"></div></div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <p style="margin:12px 0 0;font-size:0.75rem;color:var(--text-muted)">Bars: claim value (primary) · count (secondary)</p>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Risk trend</h2>
        <div class="segmented" role="group" aria-label="Chart mode">
          <button type="button" data-chart="share" class="${chartMode === 'share' ? 'active' : ''}">Risk share %</button>
          <button type="button" data-chart="volume" class="${chartMode === 'volume' ? 'active' : ''}">Claim volume</button>
        </div>
      </div>
      ${
        hasTrend
          ? `<div class="chart-wrap"><canvas id="trend-chart"></canvas></div>`
          : `<div class="chart-empty">Not enough history yet to show a reliable trend.</div>`
      }
    </div>
  `;

  root.innerHTML = renderShell(session, '#/dashboard', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  root.querySelector('#period').addEventListener('change', (e) => {
    onChange({ ...state, period: e.target.value });
  });
  root.querySelector('#branch').addEventListener('change', (e) => {
    onChange({ ...state, branch: e.target.value });
  });
  root.querySelectorAll('[data-chart]').forEach((btn) => {
    btn.addEventListener('click', () => onChange({ ...state, chartMode: btn.dataset.chart }));
  });

  if (hasTrend) {
    requestAnimationFrame(() => {
      const canvas = root.querySelector('#trend-chart');
      drawChart(canvas, chartMode);
    });
  } else {
    destroyChart();
  }
}

export { destroyChart };
