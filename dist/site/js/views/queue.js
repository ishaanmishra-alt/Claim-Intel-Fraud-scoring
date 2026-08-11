import { renderShell } from '../components.js';
import { ROLE_LABELS } from '../data.js';
import { formatAED, tierLabel } from '../scoring.js';

export function renderQueue(root, session, claims, state, onChange) {
  const { scope, sort } = state;
  const mine = claims.filter((c) => c.assignedTo === session.userId);
  const list = scope === 'mine' ? mine : claims;

  const sorted = [...list].sort((a, b) => {
    if (sort === 'deadline') {
      if (a.dueInDays !== b.dueInDays) return a.dueInDays - b.dueInDays;
      return a.score - b.score;
    }
    // Highest risk: red first, then yellow, then green; within tier lower score first
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

  const title = scope === 'mine' ? 'My claims' : 'All claims';
  const subtitle =
    scope === 'mine'
      ? `${mine.length} assigned to you · already scored`
      : `${claims.length} claims in portfolio · already scored`;

  const content = `
    <div class="page-header">
      <div>
        <h1>${title} <span style="color:var(--text-muted);font-weight:500;font-size:1.1rem">(${list.length})</span></h1>
        <p class="page-subtitle">${subtitle}</p>
      </div>
      <div class="segmented" role="group" aria-label="Claim scope">
        <button type="button" data-scope="mine" class="${scope === 'mine' ? 'active' : ''}">My claims</button>
        <button type="button" data-scope="all" class="${scope === 'all' ? 'active' : ''}">All claims</button>
      </div>
    </div>

    <div class="tier-strip">
      <div class="tier-stat"><span class="dot red"></span><strong>${counts.red}</strong> High risk</div>
      <div class="tier-stat"><span class="dot yellow"></span><strong>${counts.yellow}</strong> Unverified</div>
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
    </div>

    <div class="claims-list">
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
                return `
            <button type="button" class="claim-row" data-claim-id="${c.id}">
              <div class="score-circle sm ${c.tier}">${c.score}</div>
              <div class="claim-main">
                <div class="claim-id-line">
                  <span class="claim-id">${c.id}</span>
                  ${c.forcedRed ? `<span class="tag critical">Critical fail</span>` : ''}
                </div>
                <div class="claim-name">${c.claimant}</div>
              </div>
              <div class="claim-amount">${formatAED(c.amount)}</div>
              <div class="claim-tier ${c.tier}">${tierLabel(c.tier)}</div>
              <div class="due-badge ${dueClass}">${dueText}</div>
            </button>
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
  root.querySelectorAll('[data-claim-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/claim/${btn.dataset.claimId}`;
    });
  });
}
