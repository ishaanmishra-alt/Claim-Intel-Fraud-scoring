import { renderShell, iconCheck, iconX, iconAlert, iconBack, iconClose } from '../components.js';
import { ROLE_LABELS, CLAIM_STAGES, checkCode } from '../data.js';
import { formatAED, formatDate, tierLabel, sortChecksForDisplay } from '../scoring.js';

function stateIcon(state) {
  if (state === 'pass') return iconCheck();
  if (state === 'fail') return iconX();
  return iconAlert();
}

function claimInfoDrawer(claim) {
  return `
    <div class="drawer-backdrop" data-action="close-drawer">
      <aside class="claim-drawer" role="dialog" aria-label="Claim details" onclick="event.stopPropagation()">
        <div class="drawer-header">
          <div>
            <h2>Claim details</h2>
            <p class="drawer-sub">${claim.id}</p>
          </div>
          <button type="button" class="btn btn-ghost icon-btn" data-action="close-drawer" aria-label="Close">${iconClose()}</button>
        </div>
        <div class="drawer-body">
          <div class="drawer-grid">
            <div class="meta-item"><label>Claim number</label><div class="value">${claim.id}</div></div>
            <div class="meta-item"><label>Policy number</label><div class="value">${claim.policyNumber}</div></div>
            <div class="meta-item"><label>Claimant</label><div class="value">${claim.claimant}</div></div>
            <div class="meta-item"><label>Claim amount</label><div class="value">${formatAED(claim.amount)}</div></div>
            <div class="meta-item"><label>Sum insured / IDV</label><div class="value">${formatAED(claim.sumInsured)}</div></div>
            <div class="meta-item"><label>Loss date</label><div class="value">${formatDate(claim.lossDate)}</div></div>
            <div class="meta-item"><label>Reported</label><div class="value">${formatDate(claim.filedAt)}</div></div>
            <div class="meta-item"><label>Branch</label><div class="value">${claim.branch}</div></div>
            <div class="meta-item"><label>Plate</label><div class="value">${claim.plate}</div></div>
            <div class="meta-item"><label>Vehicle</label><div class="value">${claim.vehicle}</div></div>
            <div class="meta-item"><label>Loss location</label><div class="value">${claim.lossLocation}</div></div>
            <div class="meta-item"><label>Garage</label><div class="value">${claim.garage}</div></div>
            <div class="meta-item"><label>Assigned to</label><div class="value">${claim.assignedName}</div></div>
            <div class="meta-item"><label>Due in</label><div class="value">${claim.dueInDays} day(s)</div></div>
            <div class="meta-item"><label>Risk score</label><div class="value">${claim.score} / 10 · ${tierLabel(claim.tier)}</div></div>
          </div>
          <h3 class="drawer-section-title">Stage scores</h3>
          <div class="stage-score-list">
            ${(claim.stageScores || [])
              .map(
                (s) => `
              <div class="stage-score-row">
                <span>${s.stageName}</span>
                <strong class="claim-tier ${s.tier}">${s.score}/10</strong>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </aside>
    </div>
  `;
}

export function renderClaimDetail(root, session, claim, filter, onFilter, { drawerOpen = false } = {}) {
  if (!claim) {
    root.innerHTML = renderShell(
      session,
      '#/queue',
      `<div class="empty-state">Claim not found. <a href="#/queue">Back to queue</a></div>`
    );
    root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];
    return;
  }

  const isClaimUser = session.role === 'claim_user';
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
    s.cantEvaluateCount ? `${s.cantEvaluateCount} could not be evaluated` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const hardFailNames = claim.hardFails.map((h) => `${checkCode(h.checkId)} ${h.name}`).join('; ');

  const checksByStage = CLAIM_STAGES.map((stage) => {
    const items = filtered.filter((r) => r.stage === stage.id);
    return { stage, items };
  }).filter((g) => g.items.length > 0);

  const content = `
    <button type="button" class="back-link" data-action="back">${iconBack()} Back to claims</button>

    <div class="claim-detail-header">
      <div class="claim-detail-grid">
        <div class="meta-item">
          <label>Claim number</label>
          <div class="value">
            <button type="button" class="claim-link" data-action="open-drawer">${claim.id}</button>
          </div>
        </div>
        <div class="meta-item">
          <label>Policy number</label>
          <div class="value">${claim.policyNumber}</div>
        </div>
        <div class="meta-item">
          <label>Claimant</label>
          <div class="value">${claim.claimant}</div>
        </div>
        <div class="meta-item">
          <label>Claim amount</label>
          <div class="value">${formatAED(claim.amount)}</div>
        </div>
        ${
          isClaimUser
            ? ''
            : `<div class="meta-item">
          <label>Assigned to</label>
          <div class="value">${claim.assignedName}</div>
        </div>`
        }
        <div class="meta-item">
          <label>Loss date</label>
          <div class="value">${formatDate(claim.lossDate)}</div>
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

    <div class="stage-chips">
      ${(claim.stageScores || [])
        .map(
          (st) => `
        <div class="stage-chip">
          <span class="stage-chip-name">${st.stageName}</span>
          <span class="score-circle xs ${st.tier}">${st.score}</span>
        </div>
      `
        )
        .join('')}
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

    <div class="checks-by-stage">
      ${
        checksByStage.length === 0
          ? `<div class="empty-state">No checks in this result state.</div>`
          : checksByStage
              .map(({ stage, items }) => {
                const stageScore = (claim.stageScores || []).find((x) => x.stageId === stage.id);
                return `
            <section class="stage-block">
              <div class="stage-block-header">
                <div>
                  <h3>${stage.name}</h3>
                  <p>${stage.description}</p>
                </div>
                ${
                  stageScore
                    ? `<div class="stage-block-score"><span class="score-circle sm ${stageScore.tier}">${stageScore.score}</span></div>`
                    : ''
                }
              </div>
              <div class="checks-list">
                ${items
                  .map((r) => {
                    const metaLabel = r.hardFail ? 'Hard-fail' : '';
                    return `
                  <div class="check-row ${r.state}">
                    <div class="check-state-icon ${r.state}">${stateIcon(r.state)}</div>
                    <div class="check-body">
                      <div class="check-name">
                        <span class="check-code">${checkCode(r.checkId)}</span>
                        ${r.name}
                        ${r.hardFail && r.state === 'fail' ? `<span class="tag critical">Critical</span>` : ''}
                        ${r.hardFail && r.state !== 'fail' ? `<span class="tag knockout">Hard-fail</span>` : ''}
                      </div>
                      <p class="evidence">${r.evidence}</p>
                    </div>
                    <div class="check-weight">${metaLabel}</div>
                  </div>
                `;
                  })
                  .join('')}
              </div>
            </section>
          `;
              })
              .join('')
      }
    </div>

    ${drawerOpen ? claimInfoDrawer(claim) : ''}
  `;

  root.innerHTML = renderShell(session, '#/queue', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    location.hash = '#/queue';
  });
  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => onFilter(btn.dataset.filter, { drawerOpen: false }));
  });
  root.querySelectorAll('[data-action="open-drawer"]').forEach((btn) => {
    btn.addEventListener('click', () => onFilter(filter, { drawerOpen: true }));
  });
  root.querySelectorAll('[data-action="close-drawer"]').forEach((btn) => {
    btn.addEventListener('click', () => onFilter(filter, { drawerOpen: false }));
  });
}
