import { renderShell, iconCheck, iconX, iconAlert, iconBack } from '../components.js';
import { ROLE_LABELS, CHECK_CATEGORIES } from '../data.js';
import { formatAED, formatDate, tierLabel, sortChecksForDisplay } from '../scoring.js';

function stateIcon(state) {
  if (state === 'pass') return iconCheck();
  if (state === 'fail') return iconX();
  return iconAlert();
}

export function renderClaimDetail(root, session, claim, filter, onFilter) {
  if (!claim) {
    root.innerHTML = renderShell(
      session,
      '#/queue',
      `<div class="empty-state">Claim not found. <a href="#/queue">Back to queue</a></div>`
    );
    root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];
    return;
  }

  const sorted = sortChecksForDisplay(claim.results);
  const counts = {
    all: claim.results.length,
    pass: claim.results.filter((r) => r.state === 'pass').length,
    fail: claim.results.filter((r) => r.state === 'fail').length,
    cant_evaluate: claim.results.filter((r) => r.state === 'cant_evaluate').length,
  };

  const filtered =
    filter === 'all' ? sorted : sorted.filter((r) => r.state === filter);

  const s = claim.summary;
  const summaryLine = [
    s.hardFailCount
      ? `${s.hardFailCount} critical fail${s.hardFailCount > 1 ? 's' : ''}`
      : null,
    `${s.softFailCount} of ${s.softTotal} soft checks failed`,
    s.cantEvaluateCount
      ? `${s.cantEvaluateCount} could not be evaluated`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const hardFailNames = claim.hardFails.map((h) => h.name).join('; ');

  const content = `
    <button type="button" class="back-link" data-action="back">${iconBack()} Back to claims</button>

    <div class="claim-detail-header">
      <div class="claim-detail-grid">
        <div class="meta-item">
          <label>Claim ID</label>
          <div class="value">${claim.id}</div>
        </div>
        <div class="meta-item">
          <label>Claimant</label>
          <div class="value">${claim.claimant}</div>
        </div>
        <div class="meta-item">
          <label>Claim amount</label>
          <div class="value">${formatAED(claim.amount)}</div>
        </div>
        <div class="meta-item">
          <label>Assigned to</label>
          <div class="value">${claim.assignedName}</div>
        </div>
        <div class="meta-item">
          <label>Filed</label>
          <div class="value">${formatDate(claim.filedAt)}</div>
        </div>
        <div class="meta-item">
          <label>Vehicle</label>
          <div class="value">${claim.vehicle}</div>
        </div>
      </div>
    </div>

    ${
      claim.forcedRed
        ? `
      <div class="hardfail-banner">
        <div class="banner-icon">${iconAlert()}</div>
        <div>
          <strong>Critical check failed — routed to red</strong>
          <p>${hardFailNames}. The score below is a context score only; the hard fail overrides the tier.</p>
        </div>
      </div>
    `
        : ''
    }

    <div class="score-panel">
      <div class="score-circle lg ${claim.tier}">${claim.score}</div>
      <div class="score-panel-text">
        <h2>Fraud risk score <span style="font-weight:500;color:var(--text-muted);font-size:0.9rem">/ 10</span></h2>
        <div class="tier-label ${claim.tier}" style="color:var(--${claim.tier === 'yellow' ? 'amber' : claim.tier})">${tierLabel(claim.tier)}</div>
        <p class="summary-line">${summaryLine}</p>
      </div>
    </div>

    <div class="result-filters">
      <button type="button" class="result-filter ${filter === 'all' ? 'active' : ''}" data-filter="all">
        All <span class="count">${counts.all}</span>
      </button>
      <button type="button" class="result-filter ${filter === 'pass' ? 'active' : ''}" data-filter="pass">
        Passed <span class="count">${counts.pass}</span>
      </button>
      <button type="button" class="result-filter ${filter === 'fail' ? 'active' : ''}" data-filter="fail">
        Failed <span class="count">${counts.fail}</span>
      </button>
      <button type="button" class="result-filter ${filter === 'cant_evaluate' ? 'active' : ''}" data-filter="cant_evaluate">
        Can't evaluate <span class="count">${counts.cant_evaluate}</span>
      </button>
    </div>

    <div class="checks-list">
      ${
        filtered.length === 0
          ? `<div class="empty-state">No checks in this result state.</div>`
          : filtered
              .map((r) => {
                // Weights live on Config (Admin only) — never on the claim breakdown
                const metaLabel = r.hardFail ? 'Hard-fail' : '';
                return `
            <div class="check-row ${r.state}">
              <div class="check-state-icon ${r.state}">${stateIcon(r.state)}</div>
              <div class="check-body">
                <div class="check-name">
                  ${r.name}
                  ${r.hardFail && r.state === 'fail' ? `<span class="tag critical">Critical</span>` : ''}
                  ${r.hardFail && r.state !== 'fail' ? `<span class="tag knockout">Hard-fail</span>` : ''}
                </div>
                <p class="evidence">${r.evidence}</p>
                <p class="evidence" style="margin-top:2px;font-size:0.75rem;color:var(--text-muted)">${CHECK_CATEGORIES[r.category]}</p>
              </div>
              <div class="check-weight">${metaLabel}</div>
            </div>
          `;
              })
              .join('')
      }
    </div>
  `;

  root.innerHTML = renderShell(session, '#/queue', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    location.hash = '#/queue';
  });
  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => onFilter(btn.dataset.filter));
  });
}
