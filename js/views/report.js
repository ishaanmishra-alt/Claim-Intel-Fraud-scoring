import { renderShell } from '../components.js';
import {
  ROLE_LABELS,
  BRANCHES,
  WORKFLOW_STAGES,
  getClaimWorkflowStage,
  formatClaimRef,
  getClaimVersions,
  stageDisplayName,
} from '../data.js';
import { formatAED, formatDate, formatClaimScore, canAccess, useCaseFailStats } from '../scoring.js';
import {
  PERIOD_PRESETS,
  CLAIM_TYPE_OPTIONS,
  filterClaimUniverse,
  describeClaimScope,
  resolvePeriodRange,
  snapshotMetrics,
} from '../filters.js';
import { bindVersionPopup, renderOpenVersionPopup, versionHistoryModalHtml } from '../claim-versions-ui.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function versionChangeSummary(version) {
  return version?.summary || version?.comments || version?.action || '—';
}

let keepVersionSearchFocus = false;

function claimVersionGroups(claims) {
  return [...claims]
    .map((claim) => {
      const versions = getClaimVersions(claim);
      const latest = versions[versions.length - 1] || null;
      return { claim, versions, latest };
    })
    .filter((g) => g.versions.length)
    .sort((a, b) => {
      const key = (g) => `${g.latest?.date || ''}T${g.latest?.time || '00:00'}`;
      const byWhen = key(b).localeCompare(key(a));
      if (byWhen) return byWhen;
      return String(a.claim.id).localeCompare(String(b.claim.id));
    });
}

export function renderReport(root, session, claims, state, onChange) {
  if (!canAccess(session.role, 'report')) {
    location.hash = '#/queue';
    return;
  }

  const barFilters = {
    period: state.period,
    branch: state.branch,
    claimType: state.claimType,
    stage: state.stage,
    from: state.from,
    to: state.to,
  };
  const universe = filterClaimUniverse(claims, barFilters);
  const range = resolvePeriodRange(state.period, { from: state.from, to: state.to });
  const metrics = snapshotMetrics(universe);
  const empty = universe.length === 0;

  const byStage = WORKFLOW_STAGES.map((st) => {
    const rows = universe.filter((c) => getClaimWorkflowStage(c) === st.id);
    const red = rows.filter((c) => c.tier === 'red').length;
    return {
      ...st,
      count: rows.length,
      highRiskPct: rows.length ? Math.round((red / rows.length) * 100) : 0,
    };
  });

  const byType = CLAIM_TYPE_OPTIONS.filter((t) => t.id !== 'all').map((t) => {
    const rows = universe.filter((c) => c.claimType === t.id);
    return {
      ...t,
      count: rows.length,
      value: rows.reduce((sum, c) => sum + c.amount, 0),
    };
  });

  const showBranchBreak = state.branch === 'All branches';
  const byBranch = showBranchBreak
    ? BRANCHES.filter((b) => b !== 'All branches').map((name) => {
        const rows = universe.filter((c) => c.branch === name);
        return { name, count: rows.length, value: rows.reduce((sum, c) => sum + c.amount, 0) };
      })
    : [];

  let failStats = useCaseFailStats(universe);
  if (state.ucStage && state.ucStage !== 'all') {
    failStats = failStats.filter((s) => s.stage === state.ucStage);
  }
  if (state.ucHardFailOnly) failStats = failStats.filter((s) => s.hardFail);
  const ranked = failStats.filter((s) => s.fail > 0).slice(0, 15);

  const versionGroups = claimVersionGroups(universe);
  const versionQuery = String(state.versionQuery || '').trim().toLowerCase();
  const visibleGroups = versionQuery
    ? versionGroups.filter(({ claim }) => {
        const blob = `${claim.id} ${claim.fnolNumber || ''} ${claim.claimant || ''} ${claim.branch || ''}`.toLowerCase();
        return blob.includes(versionQuery);
      })
    : versionGroups;
  const historyClaim = state.historyClaimId
    ? claims.find((c) => c.id === state.historyClaimId) || null
    : null;

  const scope = describeClaimScope(universe, barFilters, { includeValue: true });

  const content = `
    <div class="page-header">
      <div>
        <h1>Report</h1>
        <p class="page-subtitle">Filtered management snapshot · prototype today ${formatDate('2026-08-11')}</p>
      </div>
      <button type="button" class="btn btn-secondary" data-action="export-report">Export report</button>
    </div>

    <div class="report-sticky-bar">
      <div class="filters-bar">
        <div class="filter-group">
          <label for="report-period">Date range</label>
          <select id="report-period">
            ${PERIOD_PRESETS.map(
              (p) => `<option value="${p.id}" ${state.period === p.id ? 'selected' : ''}>${p.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="report-from">Start date</label>
          <input id="report-from" type="date" value="${esc(state.from || range.from)}" />
        </div>
        <div class="filter-group">
          <label for="report-to">End date</label>
          <input id="report-to" type="date" value="${esc(state.to || range.to)}" />
        </div>
        <div class="filter-group">
          <label for="report-branch">Branch</label>
          <select id="report-branch">
            ${BRANCHES.map((b) => `<option value="${b}" ${state.branch === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="report-type">Claim type</label>
          <select id="report-type">
            ${CLAIM_TYPE_OPTIONS.map(
              (t) => `<option value="${t.id}" ${state.claimType === t.id ? 'selected' : ''}>${t.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="report-stage">Stage</label>
          <select id="report-stage">
            <option value="all" ${state.stage === 'all' ? 'selected' : ''}>All stages</option>
            ${WORKFLOW_STAGES.map(
              (s) => `<option value="${s.id}" ${state.stage === s.id ? 'selected' : ''}>${s.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <p class="scope-line">${esc(scope)}</p>
    </div>

    <div class="stat-tiles report-scorecard">
      <div class="stat-tile">
        <div class="label">Claims scored</div>
        <div class="value">${metrics.count}</div>
        <div class="sub">Report universe</div>
      </div>
      <div class="stat-tile">
        <div class="label">Total value</div>
        <div class="value" style="font-size:1.2rem">${formatAED(metrics.value)}</div>
        <div class="sub">Sum of claim amounts</div>
      </div>
      <div class="stat-tile">
        <div class="label">High-risk rate</div>
        <div class="value">${metrics.highRiskRate}%</div>
        <div class="sub">${formatAED(metrics.redValue)} · ${metrics.redCount} claims</div>
      </div>
      <div class="stat-tile">
        <div class="label">Failed checks</div>
        <div class="value">${metrics.failRate}%</div>
        <div class="sub">${metrics.failCount} claims with a fail</div>
      </div>
      <div class="stat-tile">
        <div class="label">Critical fails</div>
        <div class="value">${metrics.hardFails}</div>
        <div class="sub">Failed critical use-cases</div>
      </div>
      <div class="stat-tile">
        <div class="label">Bypassed</div>
        <div class="value">${metrics.bypassed}</div>
        <div class="sub">Use-cases excluded after bypass</div>
      </div>
    </div>

    ${
      empty
        ? `<div class="empty-state">No claims in this slice</div>`
        : `
    <div class="panel">
      <div class="panel-header"><h2>Composition</h2></div>
      <div class="report-compose">
        <div>
          <h3 class="compose-title">By stage</h3>
          ${byStage
            .map(
              (st) => `
            <div class="compose-row">
              <span>${st.name}</span>
              <strong>${st.count}</strong>
              <span class="muted">${st.highRiskPct}% high risk</span>
            </div>`
            )
            .join('')}
        </div>
        <div>
          <h3 class="compose-title">By claim type</h3>
          ${byType
            .map(
              (t) => `
            <div class="compose-row">
              <span>${t.label}</span>
              <strong>${t.count}</strong>
              <span class="muted">${formatAED(t.value)}</span>
            </div>`
            )
            .join('')}
        </div>
        ${
          showBranchBreak
            ? `<div>
          <h3 class="compose-title">By branch</h3>
          ${byBranch
            .map(
              (b) => `
            <div class="compose-row">
              <span>${b.name}</span>
              <strong>${b.count}</strong>
              <span class="muted">${formatAED(b.value)}</span>
            </div>`
            )
            .join('')}
        </div>`
            : ''
        }
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Use-case fail ranking</h2>
        <button type="button" class="btn btn-sm btn-ghost" data-action="reset-uc">Reset section</button>
      </div>
      <div class="section-chips">
        <button type="button" class="chip ${state.ucStage === 'all' ? 'active' : ''}" data-uc-stage="all">All stages</button>
        ${WORKFLOW_STAGES.map(
          (s) =>
            `<button type="button" class="chip ${state.ucStage === s.id ? 'active' : ''}" data-uc-stage="${s.id}">${s.name}</button>`
        ).join('')}
        <button type="button" class="chip ${state.ucHardFailOnly ? 'active' : ''}" data-uc-hard="1">Critical only</button>
      </div>
      ${
        ranked.length === 0
          ? `<div class="chart-empty">No failed use-cases in this slice.</div>`
          : `<div class="sample-table-wrap">
        <table class="sample-table usecase-fail-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Use-case</th>
              <th>Stage</th>
              <th>Failed claims</th>
              <th>Fail rate</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            ${ranked
              .map(
                (row, i) => `
              <tr>
                <td class="mono">${i + 1}</td>
                <td>
                  <span class="check-code">${row.code}</span>
                  ${esc(row.name)}
                </td>
                <td>${esc(row.stageName)}</td>
                <td class="mono">${row.fail} of ${row.total}</td>
                <td class="mono">${row.failRate}%</td>
                <td>${row.hardFail ? '<span class="tag critical">Critical</span>' : 'Standard'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
      }
    </div>
    `
    }

    <div class="panel">
      <div class="panel-header">
        <h2>Claim versions</h2>
        <button type="button" class="btn btn-sm btn-secondary" data-action="export-tx" ${versionGroups.length ? '' : 'disabled'}>Export versions</button>
      </div>
      <p class="page-subtitle" style="margin:0 0 12px">One row per claim. Open versions to inspect V0–V5 without listing every change on the page.</p>
      <div class="filters-bar" style="margin-bottom:12px">
        <div class="filter-group" style="min-width:240px;flex:1">
          <label for="version-search">Find claim</label>
          <input id="version-search" type="search" placeholder="Registration, FNOL, or claimant" value="${esc(state.versionQuery || '')}" />
        </div>
      </div>
      <p class="scope-line">${visibleGroups.length} of ${versionGroups.length} claim${versionGroups.length === 1 ? '' : 's'} · sorted by last change</p>
      ${
        empty || versionGroups.length === 0
          ? `<div class="chart-empty">No claims in this snapshot.</div>`
          : visibleGroups.length === 0
            ? `<div class="chart-empty">No claims match that search.</div>`
            : `<div class="sample-table-wrap version-claim-scroll">
        <table class="sample-table version-claim-table">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Claimant</th>
              <th>Stage</th>
              <th>Score</th>
              <th>Latest version</th>
              <th>Last change</th>
              <th>Changed by</th>
              <th>Versions</th>
            </tr>
          </thead>
          <tbody>
            ${visibleGroups
              .map(({ claim, versions, latest }) => {
                const stage = stageDisplayName(getClaimWorkflowStage(claim));
                const first = versions[0]?.version || 'V0';
                const last = latest?.version || first;
                const rangeLabel = first === last ? last : `${first}–${last}`;
                return `
              <tr>
                <td>
                  <a href="#/claim/${claim.id}">${formatClaimRef(claim)}</a>
                </td>
                <td>${esc(claim.claimant)}</td>
                <td>${esc(stage)}</td>
                <td class="mono">${formatClaimScore(claim)}</td>
                <td class="mono">
                  ${
                    latest
                      ? `<button type="button" class="version-link" data-open-version="${esc(claim.id)}" data-version="${esc(latest.version)}">${esc(latest.version)}</button>`
                      : '—'
                  }
                </td>
                <td>${esc(latest ? formatDate(latest.date) : '—')}</td>
                <td>${esc(latest?.user || '—')}</td>
                <td>
                  <button type="button" class="btn btn-sm btn-secondary" data-open-history="${esc(claim.id)}">${esc(rangeLabel)}</button>
                </td>
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`
      }
    </div>
    ${historyClaim ? versionHistoryModalHtml(historyClaim) : ''}
    ${renderOpenVersionPopup(claims, state.versionKey)}
  `;

  root.innerHTML = renderShell(session, '#/report', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  const patch = (partial) => onChange({ ...state, ...partial });
  root.querySelector('#report-period')?.addEventListener('change', (e) => {
    const period = e.target.value;
    const nextRange = resolvePeriodRange(period, { from: state.from, to: state.to });
    patch({ period, from: nextRange.from, to: nextRange.to });
  });
  root.querySelector('#report-from')?.addEventListener('change', (e) => patch({ from: e.target.value, period: 'custom' }));
  root.querySelector('#report-to')?.addEventListener('change', (e) => patch({ to: e.target.value, period: 'custom' }));
  root.querySelector('#report-branch')?.addEventListener('change', (e) => patch({ branch: e.target.value }));
  root.querySelector('#report-type')?.addEventListener('change', (e) => patch({ claimType: e.target.value }));
  root.querySelector('#report-stage')?.addEventListener('change', (e) => patch({ stage: e.target.value }));
  root.querySelectorAll('[data-uc-stage]').forEach((btn) => {
    btn.addEventListener('click', () => patch({ ucStage: btn.dataset.ucStage }));
  });
  root.querySelector('[data-uc-hard]')?.addEventListener('click', () => {
    patch({ ucHardFailOnly: !state.ucHardFailOnly });
  });
  root.querySelector('[data-action="reset-uc"]')?.addEventListener('click', () => {
    patch({ ucStage: 'all', ucHardFailOnly: false });
  });
  root.querySelector('#version-search')?.addEventListener('input', (e) => {
    keepVersionSearchFocus = true;
    patch({ versionQuery: e.target.value });
  });
  root.querySelectorAll('[data-open-history]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      patch({ historyClaimId: btn.dataset.openHistory, versionKey: null });
    });
  });
  root.querySelectorAll('[data-action="close-history-modal"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      patch({ historyClaimId: null, versionKey: null });
    });
  });
  bindVersionPopup(root, claims, patch, 'versionKey');
  if (keepVersionSearchFocus) {
    keepVersionSearchFocus = false;
    const search = root.querySelector('#version-search');
    if (search) {
      search.focus();
      const end = search.value.length;
      try {
        search.setSelectionRange(end, end);
      } catch {
        /* ignore */
      }
    }
  }

  root.querySelector('[data-action="export-report"]')?.addEventListener('click', () => {
    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Scorecard', 'Claims scored', metrics.count],
      ['Scorecard', 'Total value', formatAED(metrics.value)],
      ['Scorecard', 'High-risk rate', `${metrics.highRiskRate}%`],
      ['Scorecard', 'Failed-check claims', metrics.failCount],
      ['Scorecard', 'Critical fails', metrics.hardFails],
      ['Scorecard', 'Bypassed', metrics.bypassed],
      ['Scorecard', 'Scope', scope],
      ...byStage.map((st) => ['By stage', st.name, `${st.count} · ${st.highRiskPct}% high risk`]),
      ...byType.map((t) => ['By type', t.label, `${t.count} · ${formatAED(t.value)}`]),
      ...ranked.map((row) => [
        'Use-case fail ranking',
        `${row.code} ${row.name}`,
        `${row.fail} of ${row.total} claims failed (${row.failRate}%) · ${row.stageName}${row.hardFail ? ' · Critical' : ''}`,
      ]),
    ];
    downloadCsv(`claim-intel-report-${range.from}-to-${range.to}.csv`, rows);
  });

  root.querySelector('[data-action="export-tx"]')?.addEventListener('click', () => {
    const header = [
      'Registration no.',
      'FNOL no.',
      'Claimant',
      'Stage',
      'Score',
      'Version',
      'Date',
      'Changed by',
      'Change',
    ];
    const rows = [
      header,
      ...versionGroups.flatMap(({ claim, versions }) =>
        versions.map((r) => [
          claim.id,
          claim.fnolNumber || '',
          claim.claimant,
          stageDisplayName(getClaimWorkflowStage(claim)),
          formatClaimScore(claim),
          r.version,
          formatDate(r.date),
          r.user,
          versionChangeSummary(r),
        ])
      ),
    ];
    downloadCsv(`claim-intel-versions-${range.from}-to-${range.to}.csv`, rows);
  });
}
