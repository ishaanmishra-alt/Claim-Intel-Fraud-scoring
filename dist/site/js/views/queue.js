import { renderShell, iconChevron } from '../components.js';
import {
  ROLE_LABELS,
  WORKFLOW_STAGES,
  getClaimWorkflowStage,
  stageDisplayName,
  canViewClaimAudit,
  formatClaimRef,
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

export function renderQueue(root, session, claims, state, onChange) {
  const canAudit = canViewClaimAudit(session.role);
  const { stage = 'all', period = '30', from, to, auditClaimId = null, versionKey = null } = state;
  const range = resolvePeriodRange(period, { from, to });
  const list = filterClaimUniverse(claims, {
    period,
    from: range.from,
    to: range.to,
    stage,
  });

  const sorted = [...list].sort((a, b) => {
    const byFiled = String(b.filedAt || '').localeCompare(String(a.filedAt || ''));
    if (byFiled) return byFiled;
    return a.dueInDays - b.dueInDays;
  });

  const counts = {
    red: list.filter((c) => c.tier === 'red').length,
    yellow: list.filter((c) => c.tier === 'yellow').length,
    green: list.filter((c) => c.tier === 'green').length,
  };

  const content = `
    <div class="page-header">
      <div>
        <h1>Claims <span style="color:var(--text-muted);font-weight:500;font-size:1.1rem">(${list.length})</span></h1>
        <p class="page-subtitle">${list.length} claim${list.length === 1 ? '' : 's'} in the selected date range</p>
      </div>
    </div>

    <div class="tier-strip">
      <div class="tier-stat"><span class="dot red"></span><strong>${counts.red}</strong> High risk</div>
      <div class="tier-stat"><span class="dot yellow"></span><strong>${counts.yellow}</strong> Medium risk</div>
      <div class="tier-stat"><span class="dot green"></span><strong>${counts.green}</strong> Pass</div>
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

    <div class="claims-list ${canAudit ? 'has-audit' : ''}">
      <div class="claims-list-head" aria-hidden="true">
        ${canAudit ? '<span class="h-audit"></span>' : ''}
        <span class="h-score"></span>
        <span class="h-claim">Claim</span>
        <span class="h-amount">Amount</span>
        <span class="h-risk">Risk</span>
        <span class="h-stage">Claim Stage</span>
        <span class="h-due">Deadline</span>
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
                const row = `
              <div class="score-circle sm ${c.tier}${c.forcedRed ? ' is-fail-text' : ''}">${formatClaimScore(c)}</div>
              <div class="claim-main">
                <div class="claim-id-line">
                  <span class="claim-id">${formatClaimRef(c)}</span>
                  ${c.forcedRed ? `<span class="tag critical">Stage fail</span>` : ''}
                  ${c.hasOverride ? `<span class="tag override">Bypassed</span>` : ''}
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

  root.querySelector('#queue-period')?.addEventListener('change', (e) => {
    const nextPeriod = e.target.value;
    const nextRange = resolvePeriodRange(nextPeriod, { from: state.from, to: state.to });
    onChange({ ...state, period: nextPeriod, from: nextRange.from, to: nextRange.to });
  });
  root.querySelector('#queue-from')?.addEventListener('change', (e) => {
    onChange({ ...state, from: e.target.value, period: 'custom' });
  });
  root.querySelector('#queue-to')?.addEventListener('change', (e) => {
    onChange({ ...state, to: e.target.value, period: 'custom' });
  });
  root.querySelector('#queue-stage-filter')?.addEventListener('change', (e) => {
    onChange({ ...state, stage: e.target.value });
  });
  root.querySelectorAll('[data-audit-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.auditToggle;
      onChange({ ...state, auditClaimId: state.auditClaimId === id ? null : id, versionKey: null });
    });
  });
  root.querySelectorAll('[data-claim-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/claim/${btn.dataset.claimId}`;
    });
  });
  if (canAudit) {
    bindVersionPopup(root, claims, (partial) => onChange({ ...state, ...partial }), 'versionKey');
  }
}
