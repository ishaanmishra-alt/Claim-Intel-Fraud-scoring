import { renderShell } from '../components.js';
import { ROLE_LABELS, BRANCHES, TREND_HISTORY, CLAIM_STAGES, hasPendingBypass } from '../data.js';
import { formatAED, formatDate, canAccess, useCaseFailStats } from '../scoring.js';
import {
  PERIOD_PRESETS,
  CLAIM_TYPE_OPTIONS,
  filterClaimUniverse,
  describeClaimScope,
  resolvePeriodRange,
  previousPeriodRange,
} from '../filters.js';

let chartInstance = null;

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function queueHref(spec = {}) {
  const params = new URLSearchParams();
  Object.entries(spec).forEach(([k, v]) => {
    if (v == null || v === '' || v === 'all' || v === 'All branches') return;
    params.set(k, String(v));
  });
  const q = params.toString();
  return q ? `#/queue?${q}` : '#/queue';
}

function countBy(list, keyFn) {
  const map = new Map();
  list.forEach((c) => {
    const key = keyFn(c) || '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  });
  return [...map.entries()]
    .map(([name, rows]) => ({
      name,
      count: rows.length,
      red: rows.filter((c) => c.tier === 'red' || c.forcedRed).length,
      value: rows.reduce((s, c) => s + (c.amount || 0), 0),
    }))
    .sort((a, b) => b.red - a.red || b.count - a.count);
}

function drawChart(canvas, mode) {
  destroyChart();
  if (!window.Chart || !canvas) return;
  if (!TREND_HISTORY.length) return;

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
            ticks: { callback: (v) => `${v}%` },
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
            borderColor: '#16303D',
            backgroundColor: 'rgba(22, 48, 61, 0.08)',
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
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f6' } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}

function trendDelta(current, previous) {
  const delta = current - previous;
  if (!Number.isFinite(delta) || previous == null) return { delta: 0, label: 'No prior period', dir: 'flat' };
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '•';
  return {
    delta,
    dir,
    label: `${arrow} ${Math.abs(delta)} pt${Math.abs(delta) === 1 ? '' : 's'} vs last period`,
  };
}

export function renderDashboard(root, session, claims, state, onChange) {
  if (!canAccess(session.role, 'dashboard')) {
    location.hash = '#/queue';
    return;
  }

  const { period, branch, chartMode, claimType = 'all' } = state;
  const dashFilters = { period, branch, claimType };
  const filtered = filterClaimUniverse(claims, dashFilters);
  const range = resolvePeriodRange(period);
  const priorRange = previousPeriodRange(range);
  const prior = priorRange
    ? filterClaimUniverse(claims, { period: 'custom', from: priorRange.from, to: priorRange.to, branch, claimType })
    : [];
  const scopeLine = describeClaimScope(filtered, dashFilters);

  const totalCount = filtered.length;
  const totalValue = filtered.reduce((s, c) => s + c.amount, 0);
  const red = filtered.filter((c) => c.tier === 'red');
  const yellow = filtered.filter((c) => c.tier === 'yellow');
  const green = filtered.filter((c) => c.tier === 'green');
  const criticalClaims = filtered.filter((c) => (c.hardFails?.length || 0) > 0);
  const redValue = red.reduce((s, c) => s + c.amount, 0);
  const flaggedPct = totalCount ? Math.round((red.length / totalCount) * 100) : 0;
  const priorPct = prior.length ? Math.round((prior.filter((c) => c.tier === 'red').length / prior.length) * 100) : null;
  const lastTrend = TREND_HISTORY[TREND_HISTORY.length - 1];
  const prevTrend = TREND_HISTORY[TREND_HISTORY.length - 2];
  const weekly = trendDelta(lastTrend?.redPct, prevTrend?.redPct);
  const periodTrend = priorPct == null ? weekly : trendDelta(flaggedPct, priorPct);

  const aging = filtered
    .filter((c) => (c.tier === 'red' || c.forcedRed) && c.dueInDays <= 2)
    .sort((a, b) => a.dueInDays - b.dueInDays);
  const pendingBypass = filtered.filter((c) => hasPendingBypass(c));

  const byStage = CLAIM_STAGES.map((st) => {
    const stageRows = filtered.filter((c) => c.workflowStage === st.id);
    return {
      ...st,
      count: stageRows.length,
      red: stageRows.filter((c) => c.tier === 'red' || c.forcedRed).length,
    };
  });
  const byGarage = countBy(filtered, (c) => c.garage).slice(0, 5);
  const byRegion = countBy(filtered, (c) => c.branch);
  const byAdjuster = countBy(filtered, (c) => c.assignedName).slice(0, 5);

  const failStats = useCaseFailStats(filtered);
  const topFails = failStats.filter((s) => s.fail > 0).slice(0, 5);
  const hasTrend = TREND_HISTORY.length >= 2;
  const periodParam = period;

  const content = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p class="page-subtitle">Where risk sits · whether it is moving · what needs you now</p>
      </div>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label for="period">Time period</label>
        <select id="period">
          ${PERIOD_PRESETS.filter((p) => p.id !== 'custom')
            .map((p) => `<option value="${p.id}" ${period === p.id ? 'selected' : ''}>${p.label}</option>`)
            .join('')}
        </select>
      </div>
      <div class="filter-group">
        <label for="branch">Branch / region</label>
        <select id="branch">
          ${BRANCHES.map((b) => `<option value="${b}" ${branch === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label for="dash-type">Claim type</label>
        <select id="dash-type">
          ${CLAIM_TYPE_OPTIONS.map(
            (t) => `<option value="${t.id}" ${claimType === t.id ? 'selected' : ''}>${t.label}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <p class="scope-line">${scopeLine}</p>

    <div class="stat-tiles">
      <a class="stat-tile is-link" href="${queueHref({ period: periodParam, branch, claimType })}">
        <div class="label">Claims scored</div>
        <div class="value">${totalCount}</div>
        <div class="sub">Open the queue</div>
      </a>
      <a class="stat-tile is-link" href="${queueHref({ period: periodParam, branch, claimType, tier: 'red' })}">
        <div class="label">High-risk rate</div>
        <div class="value">${flaggedPct}%</div>
        <div class="sub">${formatAED(redValue)} · ${red.length} claims</div>
      </a>
      <a class="stat-tile is-link" href="${queueHref({ period: periodParam, branch, claimType, attention: 'aging' })}">
        <div class="label">Aging high-risk</div>
        <div class="value">${aging.length}</div>
        <div class="sub">Due in 2 days or overdue</div>
      </a>
      <a class="stat-tile is-link" href="${queueHref({ period: periodParam, branch, claimType, attention: 'bypass' })}">
        <div class="label">Bypass in approval</div>
        <div class="value">${pendingBypass.length}</div>
        <div class="sub">Waiting on the core system</div>
      </a>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Where is risk concentrated?</h2>
      </div>
      <div class="dash-concentrate">
        <div>
          <h3 class="compose-title">By stage</h3>
          ${byStage
            .map(
              (st) => `
            <a class="compose-row is-link" href="${queueHref({ period: periodParam, branch, claimType, stage: st.id, tier: 'red' })}">
              <span>${st.name}</span>
              <strong>${st.red}</strong>
              <span class="muted">${st.count} claims · high risk</span>
            </a>`
            )
            .join('')}
        </div>
        <div>
          <h3 class="compose-title">By garage</h3>
          ${byGarage
            .map(
              (g) => `
            <a class="compose-row is-link" href="${queueHref({ period: periodParam, branch, claimType, garage: g.name, tier: 'red' })}">
              <span>${g.name}</span>
              <strong>${g.red}</strong>
              <span class="muted">${g.count} claims · high risk</span>
            </a>`
            )
            .join('')}
        </div>
        <div>
          <h3 class="compose-title">By region</h3>
          ${byRegion
            .map(
              (g) => `
            <a class="compose-row is-link" href="${queueHref({ period: periodParam, branch: g.name, claimType, tier: 'red' })}">
              <span>${g.name}</span>
              <strong>${g.red}</strong>
              <span class="muted">${g.count} claims · high risk</span>
            </a>`
            )
            .join('')}
        </div>
        <div>
          <h3 class="compose-title">By adjuster</h3>
          ${byAdjuster
            .map(
              (g) => `
            <a class="compose-row is-link" href="${queueHref({ period: periodParam, branch, claimType, assignedTo: g.name, tier: 'red' })}">
              <span>${g.name}</span>
              <strong>${g.red}</strong>
              <span class="muted">${g.count} claims · high risk</span>
            </a>`
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Is risk trending up or down?</h2>
        <div class="segmented" role="group" aria-label="Chart mode">
          <button type="button" data-chart="share" class="${chartMode === 'share' ? 'active' : ''}">Risk share %</button>
          <button type="button" data-chart="volume" class="${chartMode === 'volume' ? 'active' : ''}">Claim volume</button>
        </div>
      </div>
      <a class="trend-banner is-${periodTrend.dir}" href="${queueHref({ period: periodParam, branch, claimType, tier: 'red' })}">
        <strong>High-risk share ${flaggedPct}%</strong>
        <span>${periodTrend.label}. Weekly series ${weekly.label.toLowerCase()}.</span>
      </a>
      ${
        hasTrend
          ? `<div class="chart-wrap"><canvas id="trend-chart"></canvas></div>`
          : `<div class="chart-empty">Not enough history yet to show a reliable trend.</div>`
      }
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>What needs my attention now?</h2>
      </div>
      <div class="dash-attention">
        <div>
          <div class="panel-header" style="padding:0;margin-bottom:8px">
            <h3 class="compose-title" style="margin:0">Aging high-risk</h3>
            <a class="btn btn-sm btn-secondary" href="${queueHref({ period: periodParam, branch, claimType, attention: 'aging' })}">${aging.length} in queue</a>
          </div>
          ${
            aging.length === 0
              ? `<p class="muted">No high-risk claims due within 2 days.</p>`
              : aging
                  .slice(0, 6)
                  .map(
                    (c) => `
            <a class="attention-row" href="#/claim/${c.id}">
              <span class="mono">${c.id}</span>
              <span>${c.claimant}</span>
              <span class="due-badge ${c.dueInDays <= 0 ? 'urgent' : ''}">${
                c.dueInDays < 0 ? `overdue ${Math.abs(c.dueInDays)}d` : c.dueInDays === 0 ? 'due today' : `due in ${c.dueInDays}d`
              }</span>
            </a>`
                  )
                  .join('')
          }
        </div>
        <div>
          <div class="panel-header" style="padding:0;margin-bottom:8px">
            <h3 class="compose-title" style="margin:0">Bypass approvals pending</h3>
            <a class="btn btn-sm btn-secondary" href="${queueHref({ period: periodParam, branch, claimType, attention: 'bypass' })}">${pendingBypass.length} in queue</a>
          </div>
          ${
            pendingBypass.length === 0
              ? `<p class="muted">No bypass requests waiting on core.</p>`
              : pendingBypass
                  .slice(0, 6)
                  .map(
                    (c) => `
            <a class="attention-row" href="#/claim/${c.id}">
              <span class="mono">${c.id}</span>
              <span>${c.claimant}</span>
              <span class="tag pending">In approval</span>
            </a>`
                  )
                  .join('')
          }
        </div>
      </div>
      ${
        topFails.length
          ? `<p class="scope-line" style="margin-top:16px">Most fails this slice: ${topFails
              .map((s) => `${s.code} ${s.name} (${s.fail})`)
              .join(' · ')}</p>`
          : ''
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
  root.querySelector('#dash-type').addEventListener('change', (e) => {
    onChange({ ...state, claimType: e.target.value });
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
