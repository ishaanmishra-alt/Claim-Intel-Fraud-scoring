import { renderShell } from '../components.js';
import { ROLE_LABELS, formatClaimRef } from '../data.js';
import { canAccess, formatDate } from '../scoring.js';
import { getConfigAuditLog } from '../state.js';
import {
  DAY_RANGE_PRESETS,
  AUDIT_EVENT_TYPES,
  resolvePeriodRange,
  flattenClaimLedger,
  formatLedgerDelta,
  formatRangeLabel,
} from '../filters.js';

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

function isConsequential(row) {
  if (row.ledgerType === 'Score' || row.user === 'Claim Intel') return false;
  return true;
}

let keepAuditSearchFocus = false;

export function renderAudit(root, session, claims, state, onChange) {
  if (!canAccess(session.role, 'audit')) {
    location.hash = '#/queue';
    return;
  }

  const { period = '30', from, to, changeType = 'all', user = 'all', query = '' } = state;
  const range = resolvePeriodRange(period, { from, to });
  const claimRows = flattenClaimLedger(claims);
  const configRows = getConfigAuditLog().map((entry) => ({
    ...entry,
    claimId: entry.claimId || '—',
    fnolNumber: entry.fnolNumber || '—',
    registrationNo: entry.registrationNo || '—',
    workflowStageName: '—',
    ledgerType: 'Config',
    userAction: entry.action,
    delta: formatLedgerDelta(entry),
  }));
  const merged = [...claimRows, ...configRows];
  const actors = [...new Set(merged.map((r) => r.user).filter(Boolean))].sort();

  let list = merged.filter((r) => r.date && r.date >= range.from && r.date <= range.to);
  if (changeType === 'all') list = list.filter(isConsequential);
  else list = list.filter((r) => r.ledgerType === changeType);
  if (user && user !== 'all') list = list.filter((r) => r.user === user);
  if (query) {
    const q = query.trim().toLowerCase();
    list = list.filter((r) => {
      const blob = `${r.claimId} ${r.fnolNumber} ${r.registrationNo} ${r.user} ${r.action} ${r.field} ${r.comments || ''} ${r.delta || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }
  list.sort((a, b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`));

  const content = `
    <div class="page-header">
      <div>
        <h1>Audit trail</h1>
        <p class="page-subtitle">Immutable log of bypass, config, disposition, and evidence actions · ${formatRangeLabel(range)}</p>
      </div>
      <button type="button" class="btn btn-secondary" data-action="export-audit" ${list.length ? '' : 'disabled'}>Export CSV</button>
    </div>

    <div class="filters-bar">
      <div class="filter-group" style="min-width:220px;flex:1">
        <label for="audit-search">Search</label>
        <input id="audit-search" type="search" placeholder="Claim, actor, reason…" value="${esc(query)}" />
      </div>
      <div class="filter-group">
        <label for="audit-type">Event type</label>
        <select id="audit-type">
          ${AUDIT_EVENT_TYPES.map(
            (t) => `<option value="${t}" ${changeType === t ? 'selected' : ''}>${t === 'all' ? 'Consequential (default)' : t}</option>`
          ).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label for="audit-user">Actor</label>
        <select id="audit-user">
          <option value="all" ${user === 'all' ? 'selected' : ''}>All actors</option>
          ${actors.map((name) => `<option value="${esc(name)}" ${user === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label for="audit-period">Date range</label>
        <select id="audit-period">
          ${DAY_RANGE_PRESETS.map(
            (p) => `<option value="${p.id}" ${period === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
          <option value="custom" ${period === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="audit-from">Start date</label>
        <input id="audit-from" type="date" value="${esc(from || range.from)}" />
      </div>
      <div class="filter-group">
        <label for="audit-to">End date</label>
        <input id="audit-to" type="date" value="${esc(to || range.to)}" />
      </div>
    </div>
    <p class="scope-line">${list.length} event${list.length === 1 ? '' : 's'} · actor, timestamp, and reason on every row</p>

    ${
      list.length === 0
        ? `<div class="chart-empty">No audit events in this filter.</div>`
        : `<div class="sample-table-wrap audit-scroll">
      <table class="sample-table audit-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Claim</th>
            <th>Type</th>
            <th>Change</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (row) => `
            <tr>
              <td class="mono">${formatDate(row.date)} ${esc(row.time || '')}</td>
              <td>${esc(row.user || '—')}</td>
              <td>${esc(row.userAction || row.action || '—')}</td>
              <td>${
                row.claimId && row.claimId !== '—'
                  ? `<a href="#/claim/${esc(row.claimId)}">${formatClaimRef({ id: row.claimId, fnolNumber: row.fnolNumber })}</a>`
                  : 'Configuration'
              }</td>
              <td><span class="tag">${esc(row.ledgerType)}</span></td>
              <td>${esc(row.delta || '—')}</td>
              <td>${esc(row.comments || row.summary || '—')}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`
    }
  `;

  root.innerHTML = renderShell(session, '#/audit', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  const patch = (partial) => onChange({ ...state, ...partial });
  root.querySelector('#audit-search')?.addEventListener('input', (e) => {
    keepAuditSearchFocus = true;
    patch({ query: e.target.value });
  });
  if (keepAuditSearchFocus) {
    keepAuditSearchFocus = false;
    const search = root.querySelector('#audit-search');
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
  root.querySelector('#audit-type')?.addEventListener('change', (e) => patch({ changeType: e.target.value }));
  root.querySelector('#audit-user')?.addEventListener('change', (e) => patch({ user: e.target.value }));
  root.querySelector('#audit-period')?.addEventListener('change', (e) => {
    const nextPeriod = e.target.value;
    const nextRange = resolvePeriodRange(nextPeriod, { from: state.from, to: state.to });
    patch({ period: nextPeriod, from: nextRange.from, to: nextRange.to });
  });
  root.querySelector('#audit-from')?.addEventListener('change', (e) => patch({ from: e.target.value, period: 'custom' }));
  root.querySelector('#audit-to')?.addEventListener('change', (e) => patch({ to: e.target.value, period: 'custom' }));
  root.querySelector('[data-action="export-audit"]')?.addEventListener('click', () => {
    const rows = [
      ['When', 'Actor', 'Action', 'Claim', 'FNOL', 'Type', 'Field', 'Old value', 'New value', 'Reason'],
      ...list.map((row) => [
        `${row.date} ${row.time || ''}`.trim(),
        row.user || '',
        row.userAction || row.action || '',
        row.claimId || '',
        row.fnolNumber || '',
        row.ledgerType || '',
        row.field || '',
        row.oldValue || '',
        row.newValue || '',
        row.comments || row.summary || '',
      ]),
    ];
    downloadCsv(`claim-intel-audit-${range.from}-to-${range.to}.csv`, rows);
  });
}
