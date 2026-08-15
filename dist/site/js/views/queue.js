import { renderShell, iconChevron } from '../components.js';
import {
  ROLE_LABELS,
  WORKFLOW_STAGES,
  getClaimWorkflowStage,
  stageDisplayName,
  canViewClaimAudit,
  getClaimAuditLog,
  getPendingExceptions,
  formatClaimRef,
} from '../data.js';
import { formatClaimAmount, formatDate, formatScore, tierLabel } from '../scoring.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAuditDate(iso) {
  return formatDate(iso);
}

function auditTableHtml(claim) {
  const rows = getClaimAuditLog(claim);
  if (!rows.length) {
    return `<div class="claim-audit-empty">No version history recorded for this claim.</div>`;
  }
  return `
    <div class="claim-audit-head">
      <strong>Version audit</strong>
      <span>${rows.length} change${rows.length === 1 ? '' : 's'}</span>
    </div>
    <div class="claim-audit-scroll">
      <table class="claim-audit-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Date</th>
            <th>Time</th>
            <th>User</th>
            <th>Action</th>
            <th>Change type</th>
            <th>Entity</th>
            <th>Field</th>
            <th>Old value</th>
            <th>New value</th>
            <th>Status</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td class="mono">${esc(r.version)}</td>
              <td>${esc(formatAuditDate(r.date))}</td>
              <td class="mono">${esc(r.time)}</td>
              <td>${esc(r.user)}</td>
              <td>${esc(r.action)}</td>
              <td>${esc(r.changeType)}</td>
              <td>${esc(r.entity)}</td>
              <td>${esc(r.field)}</td>
              <td>${esc(r.oldValue)}</td>
              <td>${esc(r.newValue)}</td>
              <td><span class="audit-status">${esc(r.status)}</span></td>
              <td class="audit-comment">${esc(r.comments)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderQueue(root, session, claims, state, onChange) {
  const isSurveyor = session.role === 'surveyor';
  const canAudit = canViewClaimAudit(session.role);
  const { scope, sort, stage = 'all', auditClaimId = null } = state;
  const pool = claims;
  const mine = pool.filter((c) => c.assignedTo === session.userId);
  const scoped = isSurveyor || scope === 'all' ? pool : mine;
  const list = stage === 'all' ? scoped : scoped.filter((c) => getClaimWorkflowStage(c) === stage);

  const sorted = [...list].sort((a, b) => {
    if (sort === 'deadline') {
      if (a.dueInDays !== b.dueInDays) return a.dueInDays - b.dueInDays;
      return a.score - b.score;
    }
    const tierRank = { red: 0, yellow: 1, green: 2 };
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    if (a.score !== b.score) return a.score - b.score;
    return a.dueInDays - b.dueInDays;
  });

  const counts = {
    red: list.filter((c) => c.tier === 'red').length,
    yellow: list.filter((c) => c.tier === 'yellow').length,
    green: list.filter((c) => c.tier === 'green').length,
  };

  const title = isSurveyor ? 'Claims' : scope === 'mine' ? 'My claims' : 'All claims';
  const subtitle = isSurveyor
    ? `${list.length} claim${list.length === 1 ? '' : 's'} · filter by claim stage`
    : scope === 'mine'
      ? `${list.length} assigned to you · already scored`
      : `${list.length} claims in portfolio · already scored`;

  const content = `
    <div class="page-header">
      <div>
        <h1>${title} <span style="color:var(--text-muted);font-weight:500;font-size:1.1rem">(${list.length})</span></h1>
        <p class="page-subtitle">${subtitle}</p>
      </div>
      ${
        isSurveyor
          ? ''
          : `<div class="segmented" role="group" aria-label="Claim scope">
        <button type="button" data-scope="mine" class="${scope === 'mine' ? 'active' : ''}">My claims</button>
        <button type="button" data-scope="all" class="${scope === 'all' ? 'active' : ''}">All claims</button>
      </div>`
      }
    </div>

    <div class="tier-strip">
      <div class="tier-stat"><span class="dot red"></span><strong>${counts.red}</strong> High risk</div>
      <div class="tier-stat"><span class="dot yellow"></span><strong>${counts.yellow}</strong> Medium risk</div>
      <div class="tier-stat"><span class="dot green"></span><strong>${counts.green}</strong> Pass</div>
    </div>

    <div class="toolbar">
      <div>
        <span class="toolbar-label">Sort</span>
        <div class="segmented" role="group" aria-label="Sort mode">
          <button type="button" data-sort="risk" class="${sort === 'risk' ? 'active' : ''}">Highest risk</button>
          <button type="button" data-sort="deadline" class="${sort === 'deadline' ? 'active' : ''}">Deadline</button>
        </div>
      </div>
      <div>
        <span class="toolbar-label">Claim stage</span>
        <select id="queue-stage-filter" aria-label="Filter by claim stage">
          <option value="all" ${stage === 'all' ? 'selected' : ''}>All stages</option>
          ${WORKFLOW_STAGES.map(
            (s) =>
              `<option value="${s.id}" ${stage === s.id ? 'selected' : ''}>${s.name}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="claims-list ${canAudit ? 'has-audit' : ''}">
      <div class="claims-list-head" aria-hidden="true">
        ${canAudit ? '<span class="audit-col"></span>' : ''}
        <span></span>
        <span>Claim</span>
        <span>Amount</span>
        <span>Risk</span>
        <span>Claim Stage</span>
        <span>Deadline</span>
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
              <div class="score-circle sm ${c.tier}">${formatScore(c.score)}</div>
              <div class="claim-main">
                <div class="claim-id-line">
                  <span class="claim-id">${formatClaimRef(c)}</span>
                  ${c.forcedRed ? `<span class="tag critical">Critical fail</span>` : ''}
                  ${getPendingExceptions(c).length ? `<span class="tag override">Pending exceptions</span>` : ''}
                </div>
                <div class="claim-name">${c.claimant}</div>
              </div>
              <div class="claim-amount">${formatClaimAmount(c)}</div>
              <div class="claim-tier ${c.tier}">${tierLabel(c.tier)}</div>
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
  `;

  root.innerHTML = renderShell(session, '#/queue', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  root.querySelectorAll('[data-scope]').forEach((btn) => {
    btn.addEventListener('click', () => onChange({ ...state, scope: btn.dataset.scope }));
  });
  root.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => onChange({ ...state, sort: btn.dataset.sort }));
  });
  root.querySelector('#queue-stage-filter')?.addEventListener('change', (e) => {
    onChange({ ...state, stage: e.target.value });
  });
  root.querySelectorAll('[data-audit-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.auditToggle;
      onChange({ ...state, auditClaimId: state.auditClaimId === id ? null : id });
    });
  });
  root.querySelectorAll('[data-claim-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/claim/${btn.dataset.claimId}`;
    });
  });
}
