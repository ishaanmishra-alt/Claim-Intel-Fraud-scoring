import { renderShell, iconChevron } from '../components.js';
import {
  ROLE_LABELS,
  WORKFLOW_STAGES,
  getClaimWorkflowStage,
  stageDisplayName,
  canViewClaimAudit,
  formatClaimRef,
  hasPendingBypass,
} from '../data.js';
import { formatClaimAmount, formatClaimScore, tierLabel } from '../scoring.js';
import { versionTableHtml, bindVersionPopup, renderOpenVersionPopup } from '../claim-versions-ui.js';
import { DAY_RANGE_PRESETS, resolvePeriodRange, filterClaimUniverse } from '../filters.js';

function auditTableHtml(claim) {
  return versionTableHtml(claim);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STAGE_ORDER = Object.fromEntries(WORKFLOW_STAGES.map((s, i) => [s.id, i]));
const TIER_ORDER = { red: 0, yellow: 1, green: 2 };

function sortArrows(active, dir) {
  return `<span class="sort-arrows" aria-hidden="true"><span class="sort-up${
    active && dir === 'asc' ? ' is-on' : ''
  }">▲</span><span class="sort-down${active && dir === 'desc' ? ' is-on' : ''}">▼</span></span>`;
}

function sortHead(key, label, state, alignClass = '') {
  const active = state.sortKey === key;
  const dir = active ? state.sortDir : null;
  return `<button type="button" class="col-sort ${alignClass} ${active ? `is-active is-${dir}` : ''}" data-sort-key="${key}">${label}${sortArrows(active, dir)}</button>`;
}

function compareClaims(a, b, key) {
  if (key === 'score') {
    if (a.forcedRed !== b.forcedRed) return Number(b.forcedRed) - Number(a.forcedRed);
    return (a.score || 0) - (b.score || 0);
  }
  if (key === 'claim') return String(a.id).localeCompare(String(b.id));
  if (key === 'amount') return (a.amount || 0) - (b.amount || 0);
  if (key === 'risk') return (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
  if (key === 'stage') {
    return (STAGE_ORDER[getClaimWorkflowStage(a)] ?? 9) - (STAGE_ORDER[getClaimWorkflowStage(b)] ?? 9);
  }
  if (key === 'deadline') return (a.dueInDays || 0) - (b.dueInDays || 0);
  return String(b.filedAt || '').localeCompare(String(a.filedAt || ''));
}

let keepQueueSearchFocus = false;

export function renderQueue(root, session, claims, state, onChange) {
  const canAudit = canViewClaimAudit(session.role);
  const {
    stage = 'all',
    period = '30',
    from,
    to,
    query = '',
    tier = 'all',
    sortKey = 'filed',
    sortDir = 'desc',
    garage = '',
    assignedTo = '',
    attention = '',
    branch = 'All branches',
    auditClaimId = null,
    versionKey = null,
  } = state;
  const range = resolvePeriodRange(period, { from, to });
  const sharedFilters = {
    period,
    from: range.from,
    to: range.to,
    stage,
    query,
    garage,
    assignedTo,
    attention,
    branch,
  };
  const baseList = filterClaimUniverse(claims, { ...sharedFilters, tier: 'all' });
  const list = filterClaimUniverse(claims, { ...sharedFilters, tier });

  const sorted = [...list].sort((a, b) => {
    const cmp = compareClaims(a, b, sortKey);
    if (cmp) return sortDir === 'asc' ? cmp : -cmp;
    return String(b.filedAt || '').localeCompare(String(a.filedAt || ''));
  });

  const counts = {
    all: baseList.length,
    red: baseList.filter((c) => c.tier === 'red').length,
    yellow: baseList.filter((c) => c.tier === 'yellow').length,
    green: baseList.filter((c) => c.tier === 'green').length,
  };

  const content = `
    <div class="page-header">
      <div>
        <h1>Claims <span style="color:var(--text-muted);font-weight:500;font-size:1.1rem">(${list.length})</span></h1>
        <p class="page-subtitle">${list.length} claim${list.length === 1 ? '' : 's'} in this view</p>
      </div>
    </div>

    <div class="queue-priority-filters">
      <div class="filter-group queue-search-group">
        <label for="queue-search">Search</label>
        <input id="queue-search" type="search" placeholder="Claim, FNOL, claimant, garage…" value="${esc(query)}" />
      </div>
      <div class="filter-group">
        <span class="toolbar-label" style="margin:0 0 6px;display:block">Risk band</span>
        <div class="tier-strip is-filter" role="group" aria-label="Risk band">
          <button type="button" class="tier-stat ${tier === 'all' ? 'is-active' : ''}" data-tier="all">All <strong>${counts.all}</strong></button>
          <button type="button" class="tier-stat ${tier === 'red' ? 'is-active' : ''}" data-tier="red"><span class="dot red"></span>High risk <strong>${counts.red}</strong></button>
          <button type="button" class="tier-stat ${tier === 'yellow' ? 'is-active' : ''}" data-tier="yellow"><span class="dot yellow"></span>Medium <strong>${counts.yellow}</strong></button>
          <button type="button" class="tier-stat ${tier === 'green' ? 'is-active' : ''}" data-tier="green"><span class="dot green"></span>Pass <strong>${counts.green}</strong></button>
        </div>
      </div>
    </div>

    <div class="filters-bar queue-filters">
      <div class="filter-group">
        <label for="queue-period">Date range</label>
        <select id="queue-period">
          ${DAY_RANGE_PRESETS.map(
            (p) => `<option value="${p.id}" ${period === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
          <option value="custom" ${period === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="queue-from">Start date</label>
        <input id="queue-from" type="date" value="${esc(from || range.from)}" />
      </div>
      <div class="filter-group">
        <label for="queue-to">End date</label>
        <input id="queue-to" type="date" value="${esc(to || range.to)}" />
      </div>
      <div class="filter-group">
        <label for="queue-stage-filter">Claim stage</label>
        <select id="queue-stage-filter">
          <option value="all" ${stage === 'all' ? 'selected' : ''}>All stages</option>
          ${WORKFLOW_STAGES.map(
            (s) => `<option value="${s.id}" ${stage === s.id ? 'selected' : ''}>${s.name}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    ${
      garage || assignedTo || attention || (branch && branch !== 'All branches')
        ? `<p class="scope-line">${[
            branch && branch !== 'All branches' ? esc(branch) : '',
            garage ? esc(garage) : '',
            assignedTo ? esc(assignedTo) : '',
            attention === 'aging' ? 'Aging high-risk' : '',
            attention === 'bypass' ? 'Bypass in approval' : '',
          ]
            .filter(Boolean)
            .join(' · ')} · <button type="button" class="linkish" data-clear-launch>Clear launch filter</button></p>`
        : ''
    }

    <div class="claims-list ${canAudit ? 'has-audit' : ''}">
      <div class="claims-list-head">
        ${canAudit ? '<span class="h-audit"></span>' : ''}
        <span class="h-score">${sortHead('score', 'Score', state)}</span>
        <span class="h-claim">${sortHead('claim', 'Claim', state)}</span>
        <span class="h-amount">${sortHead('amount', 'Amount', state, 'is-right')}</span>
        <span class="h-risk">${sortHead('risk', 'Risk', state, 'is-center')}</span>
        <span class="h-stage">${sortHead('stage', 'Claim Stage', state, 'is-center')}</span>
        <span class="h-due">${sortHead('deadline', 'Deadline', state, 'is-right')}</span>
      </div>
      ${
        sorted.length === 0
          ? `<div class="empty-state">No claims in this view.</div>`
          : sorted
              .map((c) => {
                const dueClass = c.dueInDays <= 2 ? 'urgent' : '';
                const dueText =
                  c.dueInDays < 0
                    ? `overdue ${Math.abs(c.dueInDays)}d`
                    : c.dueInDays === 0
                      ? 'due today'
                      : `due in ${c.dueInDays}d`;
                const workflow = getClaimWorkflowStage(c);
                const open = canAudit && auditClaimId === c.id;
                const pending = hasPendingBypass(c);
                const row = `
              <div class="score-circle sm ${c.tier}${c.forcedRed ? ' is-fail-text' : ''}">${formatClaimScore(c)}</div>
              <div class="claim-main">
                <div class="claim-id-line">
                  <span class="claim-id">${formatClaimRef(c)}</span>
                  ${c.forcedRed ? `<span class="tag critical">Stage fail</span>` : ''}
                  ${pending ? `<span class="tag pending">In approval</span>` : ''}
                  ${!pending && c.hasOverride ? `<span class="tag override">Bypassed</span>` : ''}
                </div>
                <div class="claim-name">${c.claimant}</div>
              </div>
              <div class="claim-amount">${formatClaimAmount(c)}</div>
              <div class="claim-tier ${c.tier}">${tierLabel(c.tier, c)}</div>
              <div class="claim-stage-cell">${stageDisplayName(workflow)}</div>
              <div class="due-badge ${dueClass}">${dueText}</div>
            `;
                if (!canAudit) {
                  return `<button type="button" class="claim-row" data-claim-id="${c.id}">${row}</button>`;
                }
                return `
            <article class="claim-item ${open ? 'is-open' : ''}">
              <div class="claim-row-line">
                <button
                  type="button"
                  class="audit-toggle ${open ? 'is-open' : ''}"
                  data-audit-toggle="${c.id}"
                  aria-expanded="${open ? 'true' : 'false'}"
                  aria-controls="audit-${c.id}"
                  aria-label="Version audit for ${c.id}"
                >${iconChevron()}</button>
                <button type="button" class="claim-row" data-claim-id="${c.id}">${row}</button>
              </div>
              ${
                open
                  ? `<div class="claim-audit" id="audit-${c.id}">${auditTableHtml(c)}</div>`
                  : `<div class="claim-audit" id="audit-${c.id}" hidden></div>`
              }
            </article>
          `;
              })
              .join('')
      }
    </div>
    ${canAudit ? renderOpenVersionPopup(claims, versionKey) : ''}
  `;

  root.innerHTML = renderShell(session, '#/queue', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  const patch = (partial) => onChange({ ...state, ...partial });
  root.querySelector('#queue-search')?.addEventListener('input', (e) => {
    keepQueueSearchFocus = true;
    patch({ query: e.target.value });
  });
  if (keepQueueSearchFocus) {
    keepQueueSearchFocus = false;
    const search = root.querySelector('#queue-search');
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
  root.querySelectorAll('[data-tier]').forEach((btn) => {
    btn.addEventListener('click', () => patch({ tier: btn.dataset.tier }));
  });
  root.querySelectorAll('[data-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sortKey;
      if (state.sortKey === key) {
        patch({ sortDir: state.sortDir === 'desc' ? 'asc' : 'desc' });
      } else {
        patch({ sortKey: key, sortDir: 'desc' });
      }
    });
  });
  root.querySelector('#queue-period')?.addEventListener('change', (e) => {
    const nextPeriod = e.target.value;
    const nextRange = resolvePeriodRange(nextPeriod, { from: state.from, to: state.to });
    patch({ period: nextPeriod, from: nextRange.from, to: nextRange.to });
  });
  root.querySelector('#queue-from')?.addEventListener('change', (e) => {
    patch({ from: e.target.value, period: 'custom' });
  });
  root.querySelector('#queue-to')?.addEventListener('change', (e) => {
    patch({ to: e.target.value, period: 'custom' });
  });
  root.querySelector('#queue-stage-filter')?.addEventListener('change', (e) => {
    patch({ stage: e.target.value });
  });
  root.querySelector('[data-clear-launch]')?.addEventListener('click', () => {
    patch({ garage: '', assignedTo: '', attention: '', branch: 'All branches' });
  });
  root.querySelectorAll('[data-audit-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.auditToggle;
      patch({ auditClaimId: state.auditClaimId === id ? null : id, versionKey: null });
    });
  });
  root.querySelectorAll('[data-claim-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/claim/${btn.dataset.claimId}`;
    });
  });
  if (canAudit) {
    bindVersionPopup(root, claims, (partial) => patch(partial), 'versionKey');
  }
}
