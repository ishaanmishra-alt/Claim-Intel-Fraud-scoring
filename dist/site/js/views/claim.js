import { renderShell, iconCheck, iconX, iconAlert, iconBack, iconClose } from '../components.js';
import {
  ROLE_LABELS,
  CLAIM_STAGES,
  checkCode,
  stageDisplayName,
  getStageDocumentRows,
  getStageDocCompleteness,
  mockUploadClaimDocument,
  hasPassedPriorStages,
  hasStageDocsComplete,
  submitSurveyorAssessment,
} from '../data.js';
import { formatAED, formatDate, tierLabel, sortChecksForDisplay } from '../scoring.js';

function stateIcon(state) {
  if (state === 'pass') return iconCheck();
  if (state === 'fail') return iconX();
  return iconAlert();
}

function requiredTag(def) {
  if (def.required === 'optional') return `<span class="tag doc-optional">Optional</span>`;
  if (def.required === 'conditional') return `<span class="tag doc-conditional">Conditional</span>`;
  return `<span class="tag doc-required">Required</span>`;
}

function docStatusLabel(status) {
  if (status === 'uploaded') return 'Uploaded';
  if (status === 'rejected') return 'Rejected';
  if (status === 'waived') return 'Waived';
  if (status === 'already_on_file') return 'Already on file';
  return 'Missing';
}

function docThumb(row) {
  const { def, rec, displayStatus } = row;
  if (displayStatus === 'already_on_file') {
    return `<div class="doc-chip on-file" title="Already on file">On file</div>`;
  }
  if (displayStatus === 'waived') {
    return `<div class="doc-chip waived">Waived</div>`;
  }
  if (displayStatus === 'missing') {
    return `<div class="doc-chip missing">${def.kind === 'pdf' ? 'PDF' : 'IMG'}</div>`;
  }
  const isPdf = def.kind === 'pdf' || (rec.filename && rec.filename.toLowerCase().endsWith('.pdf'));
  if (isPdf) {
    return `<div class="doc-chip pdf" title="${rec.filename || ''}"><span>PDF</span><span class="doc-chip-name">${rec.filename || 'Document.pdf'}</span></div>`;
  }
  return `<div class="doc-thumb" title="${rec.filename || rec.thumb || ''}"><span>${rec.thumb || 'Photo'}</span></div>`;
}

function documentChecklistHtml(claim, stageId, { readOnly = false } = {}) {
  const rows = getStageDocumentRows(claim, stageId);
  if (!rows.length) return '';
  return `
    <div class="doc-checklist">
      <div class="doc-checklist-label">Documents</div>
      ${rows
        .map((row) => {
          const clickable =
            !readOnly && (row.displayStatus === 'missing' || row.displayStatus === 'rejected');
          const statusNote =
            row.displayStatus === 'already_on_file'
              ? 'Captured at an earlier stage — not requested again.'
              : row.rec.note || '';
          return `
            <${clickable ? 'button type="button"' : 'div'}
              class="doc-row ${row.displayStatus}${clickable ? ' is-action' : ''}"
              ${clickable ? `data-action="upload-doc" data-doc-id="${row.def.id}"` : ''}
            >
              <div class="doc-row-main">
                <div class="doc-row-title">
                  <span class="doc-name">${row.def.name}${
                    row.def.minCount > 1 ? ` <span class="doc-min">(min ${row.def.minCount})</span>` : ''
                  }</span>
                  ${requiredTag(row.def)}
                  <span class="doc-status ${row.displayStatus}">${docStatusLabel(row.displayStatus)}</span>
                </div>
                ${statusNote ? `<p class="doc-note">${statusNote}</p>` : ''}
                <p class="doc-why">Why we need this: ${row.def.why}</p>
              </div>
              ${docThumb(row)}
            </${clickable ? 'button' : 'div'}>
          `;
        })
        .join('')}
    </div>
  `;
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
            <div class="meta-item"><label>Claim type</label><div class="value">${
              { own_damage: 'Own damage', tp: 'Third party', theft: 'Theft', total_loss: 'Total loss' }[
                claim.claimType
              ] || 'Own damage'
            }</div></div>
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

export function renderClaimDetail(
  root,
  session,
  claim,
  filter,
  onFilter,
  { drawerOpen = false, selectedStage = null } = {}
) {
  if (!claim) {
    root.innerHTML = renderShell(
      session,
      '#/queue',
      `<div class="empty-state">Claim not found. <a href="#/queue">Back to queue</a></div>`
    );
    root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];
    return;
  }

  const isSurveyor = session.role === 'surveyor';
  const isClaimUser = session.role === 'claim_user' || isSurveyor;
  const stageTab = isSurveyor ? selectedStage || 'assessment' : null;
  const surveyorCanWork =
    isSurveyor &&
    stageTab === 'assessment' &&
    hasPassedPriorStages(claim, ['fnol', 'intimation']) &&
    !claim.surveyorSubmitted;
  const surveyorSubmitted = isSurveyor && !!claim.surveyorSubmitted;

  const displayStages = isSurveyor
    ? CLAIM_STAGES.filter((s) => !stageTab || s.id === stageTab)
    : CLAIM_STAGES;
  const stageResults = stageTab
    ? claim.results.filter((r) => r.stage === stageTab)
    : claim.results;
  const sorted = sortChecksForDisplay(stageResults);
  const counts = {
    all: stageResults.length,
    pass: stageResults.filter((r) => r.state === 'pass').length,
    fail: stageResults.filter((r) => r.state === 'fail').length,
    cant_evaluate: stageResults.filter((r) => r.state === 'cant_evaluate').length,
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

  const checksByStage = displayStages.map((stage) => {
    const items = filtered.filter((r) => r.stage === stage.id);
    return { stage, items };
  });

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
        <div class="meta-item">
          <label>Claim type</label>
          <div class="value">${
            { own_damage: 'Own damage', tp: 'Third party', theft: 'Theft', total_loss: 'Total loss' }[
              claim.claimType
            ] || claim.claimType || 'Own damage'
          }</div>
        </div>
      </div>
    </div>

    ${
      surveyorCanWork
        ? `<div class="surveyor-banner">
        <strong>Surveyor stage</strong>
        <p>Upload your documents below and submit to run further scoring. Switch to FNOL, Intimation, or Settlement to review earlier or later stages.</p>
      </div>`
        : isSurveyor && stageTab === 'assessment' && !surveyorSubmitted
          ? `<div class="surveyor-banner">
        <strong>Surveyor stage</strong>
        <p>This claim has not completed FNOL and Intimation yet. You can review this stage; submit is available after those stages pass. Switch tabs to inspect FNOL, Intimation, or Settlement.</p>
      </div>`
          : ''
    }
    ${
      surveyorSubmitted
        ? `<div class="surveyor-banner is-done">
        <strong>Submitted for further scoring</strong>
        <p>Surveyor documents are on file. Assessment scoring is now included and the claim has moved to the next stage.</p>
      </div>`
        : ''
    }
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

    <div class="stage-chips ${isSurveyor ? 'is-tabs' : ''}">
      ${(isSurveyor ? CLAIM_STAGES : claim.stageScores || [])
        .map((st) => {
          const stageId = st.stageId || st.id;
          const stageScore = (claim.stageScores || []).find((x) => x.stageId === stageId);
          const docs = getStageDocCompleteness(claim, stageId);
          const active = isSurveyor && stageTab === stageId;
          const inner = `
          <span class="stage-chip-name">${stageDisplayName(stageId)}</span>
          ${stageScore ? `<span class="score-circle xs ${stageScore.tier}">${stageScore.score}</span>` : ''}
          ${docs.total ? `<span class="doc-complete-chip">${docs.done}/${docs.total} docs</span>` : ''}
        `;
          return isSurveyor
            ? `<button type="button" class="stage-chip ${active ? 'is-active' : ''}" data-stage-tab="${stageId}">${inner}</button>`
            : `<div class="stage-chip">${inner}</div>`;
        })
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
      ${checksByStage
              .map(({ stage, items }) => {
                const stageScore = (claim.stageScores || []).find((x) => x.stageId === stage.id);
                const docs = getStageDocCompleteness(claim, stage.id);
                return `
            <section class="stage-block">
              <div class="stage-block-header">
                <div>
                  <h3>${stageDisplayName(stage.id)}</h3>
                  <p>${stage.id === 'assessment' ? 'Surveyor inspection, repair photos & damage assessment' : stage.description}</p>
                </div>
                <div class="stage-block-score">
                  ${docs.total ? `<span class="doc-complete-chip">${docs.done}/${docs.total} docs</span>` : ''}
                  ${
                    stageScore
                      ? `<span class="score-circle sm ${stageScore.tier}">${stageScore.score}</span>`
                      : ''
                  }
                </div>
              </div>
              <div class="checks-list">
                ${
                  items.length === 0
                    ? filter === 'all'
                      ? ''
                      : `<div class="empty-checks">No checks in this result state.</div>`
                    : items
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
                        .join('')
                }
              </div>
              ${documentChecklistHtml(claim, stage.id, {
                readOnly: isSurveyor && (stage.id !== 'assessment' || surveyorSubmitted),
              })}
              ${
                stage.id === 'assessment' && surveyorCanWork
                  ? `
                <div class="surveyor-submit">
                  <p>${
                    hasStageDocsComplete(claim, 'assessment')
                      ? 'Required Surveyor documents are on file. Submit to run further scoring and move this claim to the next stage.'
                      : 'Upload every required Surveyor document, then submit for further scoring.'
                  }</p>
                  <button type="button" class="btn btn-primary" data-action="submit-surveyor" ${
                    hasStageDocsComplete(claim, 'assessment') ? '' : 'disabled'
                  }>Submit for further scoring</button>
                </div>`
                  : ''
              }
            </section>
          `;
              })
              .join('')}
    </div>

    ${drawerOpen ? claimInfoDrawer(claim) : ''}
  `;

  root.innerHTML = renderShell(session, '#/queue', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    location.hash = '#/queue';
  });
  const persist = (nextFilter, extra = {}) =>
    onFilter(nextFilter, { drawerOpen, selectedStage: stageTab, ...extra });
  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => persist(btn.dataset.filter, { drawerOpen: false }));
  });
  root.querySelectorAll('[data-stage-tab]').forEach((btn) => {
    btn.addEventListener('click', () => persist('all', { selectedStage: btn.dataset.stageTab }));
  });
  root.querySelectorAll('[data-action="open-drawer"]').forEach((btn) => {
    btn.addEventListener('click', () => persist(filter, { drawerOpen: true }));
  });
  root.querySelectorAll('[data-action="close-drawer"]').forEach((btn) => {
    btn.addEventListener('click', () => persist(filter, { drawerOpen: false }));
  });
  root.querySelectorAll('[data-action="upload-doc"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      mockUploadClaimDocument(claim.id, btn.dataset.docId);
      persist(filter);
    });
  });
  root.querySelector('[data-action="submit-surveyor"]')?.addEventListener('click', () => {
    const result = submitSurveyorAssessment(claim.id);
    persist(filter, { surveyorMessage: result.message });
  });
}
