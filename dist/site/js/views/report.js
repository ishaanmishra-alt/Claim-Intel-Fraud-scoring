import { renderShell } from '../components.js';
import {
  ROLE_LABELS,
  BRANCHES,
  WORKFLOW_STAGES,
  getClaimWorkflowStage,
  getPendingExceptions,
} from '../data.js';
import { formatAED, tierLabel, canAccess, useCaseFailStats } from '../scoring.js';
import {
  PERIOD_PRESETS,
  CLAIM_TYPE_OPTIONS,
  LEDGER_CHANGE_TYPES,
  filterClaimUniverse,
  describeClaimScope,
  resolvePeriodRange,
  formatRangeLabel,
  snapshotMetrics,
  flattenClaimLedger,
  filterLedgerRows,
  ledgerRangeState,
  capLedgerRows,
  claimTypeLabel,
} from '../filters.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sampleNote(claim) {
  const pending = getPendingExceptions(claim).length;
  if (pending) return `${pending} pending exception${pending === 1 ? '' : 's'}`;
  if (claim.forcedRed) return 'Critical fail override';
  if (claim.hasOverride) return 'Override (waived)';
  if (claim.summary?.cantEvaluateCount) return `${claim.summary.cantEvaluateCount} can't evaluate`;
  return '—';
}

function exceptionSample(universe, state) {
  let rows = universe;
  if (state.sampleCheckId) {
    const id = Number(state.sampleCheckId);
    rows = rows.filter((c) => (c.results || []).some((r) => r.checkId === id && r.state === 'fail'));
    if (state.sampleTier === 'red') rows = rows.filter((c) => c.tier === 'red');
    if (state.sampleTier === 'yellow') rows = rows.filter((c) => c.tier === 'yellow');
    if (state.sampleTier === 'green') rows = rows.filter((c) => c.tier === 'green');
  } else {
    rows = rows.filter((c) => c.tier === 'red' || c.forcedRed);
  }
  if (state.samplePendingOnly) rows = rows.filter((c) => getPendingExceptions(c).length > 0);
  rows = [...rows].sort((a, b) => b.amount - a.amount);
  return { total: rows.length, rows: rows.slice(0, 20) };
}

function sampleCaption(state, shown, total) {
  if (state.sampleCheckId) {
    return `${shown} of ${total} claims where this check failed in this slice · sorted by value`;
  }
  return `${shown} of ${total} high-risk claims in this slice · sorted by value`;
}

function groupLedgerByDay(rows) {
  const groups = [];
  const byDay = new Map();
  rows.forEach((row) => {
    if (!byDay.has(row.date)) {
      byDay.set(row.date, []);
      groups.push(row.date);
    }
    byDay.get(row.date).push(row);
  });
  return groups.map((date) => ({ date, rows: byDay.get(date) }));
}

function ledgerUsers(rows) {
  return [...new Set(rows.map((r) => r.user).filter(Boolean))].sort();
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
    tier: state.tier,
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

  const sample = exceptionSample(universe, state);

  const reportRange = range;
  const txRange =
    state.txPeriod === 'yesterday' || state.txPeriod === '7'
      ? resolvePeriodRange(state.txPeriod)
      : reportRange;
  const txGate = ledgerRangeState(txRange);
  const allLedger = flattenClaimLedger(claims);
  const ledgerInRange = txGate.ok ? filterLedgerRows(allLedger, { range: txRange }) : [];
  const ledgerFiltered = txGate.ok
    ? filterLedgerRows(allLedger, {
        range: txRange,
        changeType: state.txChangeType,
        user: state.txUser,
      })
    : [];
  const capped = capLedgerRows(ledgerFiltered);
  const typeCounts = {};
  LEDGER_CHANGE_TYPES.forEach((t) => {
    typeCounts[t] = ledgerInRange.filter((r) => r.ledgerType === t).length;
  });
  const distinctClaims = new Set(ledgerFiltered.map((r) => r.claimId)).size;
  const dayGroups = groupLedgerByDay(capped.shown);
  const userOptions = ledgerUsers(ledgerInRange);

  const scope = describeClaimScope(universe, barFilters, { includeValue: true });

  const content = `
    <div class="page-header">
      <div>
        <h1>Report</h1>
        <p class="page-subtitle">Filtered management snapshot · prototype today ${formatRangeLabel({ from: '2026-08-11', to: '2026-08-11' })}</p>
      </div>
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
        ${
          state.period === 'custom'
            ? `<div class="filter-group">
          <label for="report-from">From</label>
          <input id="report-from" type="date" value="${esc(state.from || range.from)}" />
        </div>
        <div class="filter-group">
          <label for="report-to">To</label>
          <input id="report-to" type="date" value="${esc(state.to || range.to)}" />
        </div>`
            : ''
        }
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
        <div class="filter-group">
          <label for="report-tier">Tier</label>
          <select id="report-tier">
            <option value="all" ${state.tier === 'all' ? 'selected' : ''}>All</option>
            <option value="red" ${state.tier === 'red' ? 'selected' : ''}>High risk</option>
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
        <div class="label">Can't evaluate</div>
        <div class="value">${metrics.cantEvalRate}%</div>
        <div class="sub">${metrics.cantEvalCount} incomplete-doc claims</div>
      </div>
      <div class="stat-tile">
        <div class="label">Exceptions</div>
        <div class="value" style="font-size:1.05rem">${metrics.hardFails} · ${metrics.waived} · ${metrics.pending}</div>
        <div class="sub">Hard-fail · waived · pending</div>
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
        <button type="button" class="chip ${state.ucHardFailOnly ? 'active' : ''}" data-uc-hard="1">Hard-fail only</button>
      </div>
      ${
        ranked.length === 0
          ? `<div class="chart-empty">No failed use-cases in this slice.</div>`
          : `<div class="usecase-fail-list">
        ${ranked
          .map(
            (row) => `
          <button type="button" class="usecase-fail-row is-button ${Number(state.sampleCheckId) === row.checkId ? 'is-selected' : ''}" data-sample-check="${row.checkId}">
            <div class="usecase-fail-meta">
              <span class="check-code">${row.code}</span>
              <div>
                <strong>${row.name}</strong>
                <small>${row.stageName}${row.hardFail ? ' · Hard-fail' : ''} · ${row.failRate}% fail rate</small>
              </div>
            </div>
            <strong>${row.fail}</strong>
          </button>`
          )
          .join('')}
      </div>`
      }
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Exception sample</h2>
      </div>
      <div class="section-chips">
        ${
          state.sampleCheckId
            ? `<button type="button" class="chip ${state.sampleTier === 'all' ? 'active' : ''}" data-sample-tier="all">All tiers</button>`
            : ''
        }
        <button type="button" class="chip ${!state.sampleCheckId || state.sampleTier === 'red' ? 'active' : ''}" data-sample-tier="red">High risk</button>
        <button type="button" class="chip ${state.samplePendingOnly ? 'active' : ''}" data-sample-pending="1">Pending exceptions only</button>
      </div>
      <p class="scope-line">${esc(sampleCaption(state, sample.rows.length, sample.total))}</p>
      ${
        sample.rows.length === 0
          ? `<div class="chart-empty">No claims in this sample.</div>`
          : `<div class="sample-table-wrap">
        <table class="sample-table">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Branch</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Score</th>
              <th>Tier</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${sample.rows
              .map(
                (c) => `
              <tr>
                <td><a href="#/claim/${c.id}">${c.id}</a></td>
                <td>${esc(c.branch)}</td>
                <td>${esc(claimTypeLabel(c.claimType))}</td>
                <td>${formatAED(c.amount)}</td>
                <td class="mono">${c.score}</td>
                <td class="claim-tier ${c.tier}">${tierLabel(c.tier)}</td>
                <td class="muted">${esc(sampleNote(c))}</td>
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
        <h2>Transactions</h2>
      </div>
      <p class="page-subtitle" style="margin:0 0 12px">Cross-claim ledger · does not change the scorecard</p>
      <div class="filters-bar">
        <div class="filter-group">
          <label for="tx-period">Ledger dates</label>
          <select id="tx-period">
            <option value="inherit" ${state.txPeriod === 'inherit' ? 'selected' : ''}>Match report (${esc(formatRangeLabel(reportRange))})</option>
            <option value="yesterday" ${state.txPeriod === 'yesterday' ? 'selected' : ''}>Yesterday</option>
            <option value="7" ${state.txPeriod === '7' ? 'selected' : ''}>Last 7 days</option>
          </select>
        </div>
        ${
          txGate.ok
            ? `
        <div class="filter-group">
          <label for="tx-type">Change type</label>
          <select id="tx-type">
            <option value="all" ${state.txChangeType === 'all' ? 'selected' : ''}>All types</option>
            ${LEDGER_CHANGE_TYPES.map(
              (t) => `<option value="${t}" ${state.txChangeType === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="tx-user">User</label>
          <select id="tx-user">
            <option value="all" ${state.txUser === 'all' ? 'selected' : ''}>All users</option>
            ${userOptions
              .map((u) => `<option value="${esc(u)}" ${state.txUser === u ? 'selected' : ''}>${esc(u)}</option>`)
              .join('')}
          </select>
        </div>`
            : ''
        }
      </div>
      ${
        !txGate.ok
          ? `<div class="empty-state">${
              txGate.reason === 'too-wide'
                ? 'Narrow the dates. Transactions can show at most 31 days.'
                : 'Set a date range to load the ledger.'
            }</div>`
          : `
      <p class="scope-line">${ledgerFiltered.length} transactions · ${distinctClaims} distinct claims · ${LEDGER_CHANGE_TYPES.map((t) => `${typeCounts[t]} ${t.toLowerCase()}`).join(' · ')}</p>
      ${
        capped.total > capped.cap
          ? `<p class="scope-line">Showing ${capped.shown.length} of ${capped.total} in this range.</p>`
          : ''
      }
      ${
        capped.shown.length === 0
          ? `<div class="chart-empty">No transactions in this range.</div>`
          : dayGroups
              .map(
                (g) => `
          <div class="ledger-day">
            <h3 class="ledger-day-title">${esc(formatRangeLabel({ from: g.date, to: g.date }))}</h3>
            ${g.rows
              .map(
                (r) => `
              <div class="ledger-row">
                <span class="ledger-time">${esc(r.time)}</span>
                <a class="ledger-claim" href="#/claim/${r.claimId}">${r.claimId}</a>
                <span class="ledger-user">${esc(r.user)}</span>
                <span class="ledger-delta">${esc(r.delta)}</span>
                <span class="ledger-chip">${esc(r.ledgerType)}</span>
                <span class="audit-status">${esc(r.status || 'Completed')}</span>
                ${r.comments ? `<span class="ledger-comment">${esc(r.comments)}</span>` : ''}
              </div>`
              )
              .join('')}
          </div>`
              )
              .join('')
      }`
      }
    </div>
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
  root.querySelector('#report-tier')?.addEventListener('change', (e) => patch({ tier: e.target.value }));
  root.querySelectorAll('[data-uc-stage]').forEach((btn) => {
    btn.addEventListener('click', () => patch({ ucStage: btn.dataset.ucStage }));
  });
  root.querySelector('[data-uc-hard]')?.addEventListener('click', () => {
    patch({ ucHardFailOnly: !state.ucHardFailOnly });
  });
  root.querySelector('[data-action="reset-uc"]')?.addEventListener('click', () => {
    patch({ ucStage: 'all', ucHardFailOnly: false, sampleCheckId: null });
  });
  root.querySelectorAll('[data-sample-check]').forEach((btn) => {
    btn.addEventListener('click', () => patch({ sampleCheckId: Number(btn.dataset.sampleCheck) }));
  });
  root.querySelectorAll('[data-sample-tier]').forEach((btn) => {
    btn.addEventListener('click', () => patch({ sampleTier: btn.dataset.sampleTier }));
  });
  root.querySelector('[data-sample-pending]')?.addEventListener('click', () => {
    patch({ samplePendingOnly: !state.samplePendingOnly });
  });
  root.querySelector('#tx-period')?.addEventListener('change', (e) => patch({ txPeriod: e.target.value }));
  root.querySelector('#tx-type')?.addEventListener('change', (e) => patch({ txChangeType: e.target.value }));
  root.querySelector('#tx-user')?.addEventListener('change', (e) => patch({ txUser: e.target.value }));
}
