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
  getClaimWorkflowStage,
  submitSurveyorAssessment,
  requestCoreBypass,
  formatClaimRef,
  latestExceptionForCheck,
} from '../data.js';
import { formatAED, formatClaimAmount, formatDate, formatClaimScore, formatStageScore, tierLabel, sortChecksForDisplay } from '../scoring.js';

function stateIcon(state) {
  if (state === 'pass') return iconCheck();
  if (state === 'fail') return iconX();
  if (state === 'waived' || state === 'bypassed') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  }
  return iconAlert();
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function weightCellHtml(r, stageHasExcluded) {
  if (r.state === 'bypassed' || r.state === 'waived') {
    return `<span class="check-weight-excluded" title="Excluded from this stage’s score">—</span>`;
  }
  if (r.hardFail) {
    return `<span class="check-weight-gate" title="Critical use-cases are pass / fail only">Pass / fail</span>`;
  }
  const shown = r.displayWeight ?? r.weight ?? 0;
  const configured = r.configuredWeight ?? r.weight ?? 0;
  if (stageHasExcluded && shown !== configured) {
    return `${shown}% <span class="check-weight-was">was ${configured}%</span>`;
  }
  return `${shown}%`;
}

function exceptionBlockHtml(result, session, claim) {
  if (session.role === 'surveyor') return '';
  const bits = [];
  const pending = latestExceptionForCheck(claim, result.checkId);
  const awaitingCore = pending?.type === 'bypass' && pending.status === 'pending';
  if (result.state === 'bypassed') {
    bits.push(`<span class="tag override">Bypassed</span>`);
    bits.push(
      session.role === 'claim_user'
        ? `<p class="exception-note">Excluded from this stage.</p>`
        : `<p class="exception-note">Excluded from this stage. Remaining use-case weights are normalised to 100%.</p>`
    );
  } else if (awaitingCore) {
    bits.push(`<span class="tag pending">In approval</span>`);
    bits.push(
      `<p class="exception-note">Bypass requested. Waiting for the core system to approve. Scoring is unchanged until then.</p>`
    );
  }
  const buttons = [];
  if (result.state === 'fail' && !awaitingCore) {
    buttons.push(
      `<button type="button" class="btn btn-sm btn-primary" data-action="request-bypass" data-check-id="${result.checkId}">Request Bypass</button>`
    );
  }
  if (!bits.length && !buttons.length) return '';
  return `
    <div class="exception-block">
      ${bits.join('')}
      ${buttons.length ? `<div class="exception-actions">${buttons.join('')}</div>` : ''}
    </div>
  `;
}

function requiredTag(def) {
  if (def.required === 'optional') return `<span class="tag doc-optional">Optional</span>`;
  if (def.required === 'conditional') return `<span class="tag doc-conditional">Conditional</span>`;
  return `<span class="tag doc-required">Required</span>`;
}

function docStatusLabel(status) {
  if (status === 'uploaded') return 'Uploaded';
  if (status === 'rejected') return 'Rejected';
  if (status === 'waived' || status === 'bypassed') return 'Bypassed';
  if (status === 'already_on_file') return 'Already on file';
  return 'Missing';
}

function docThumb(row) {
  const { def, rec, displayStatus } = row;
  if (displayStatus === 'already_on_file') {
    return `<div class="doc-chip on-file" title="Already on file">On file</div>`;
  }
  if (displayStatus === 'waived') {
    return `<div class="doc-chip waived">Bypassed</div>`;
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
    <details class="doc-disclosure">
      <summary>Documents</summary>
      <div class="doc-checklist">
      ${rows
        .map((row) => {
          const needsAttention =
            row.displayStatus === 'missing' || row.displayStatus === 'rejected';
          const clickable = !readOnly && needsAttention;
          const statusNote =
            row.displayStatus === 'already_on_file'
              ? 'Captured at an earlier stage — not requested again.'
              : row.rec.note || '';
          return `
            <${clickable ? 'button type="button"' : 'div'}
              class="doc-row ${row.displayStatus}${clickable ? ' is-action' : ''}${
                needsAttention ? ' is-highlight' : ''
              }"
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
    </details>
  `;
}

function stageHoldMessage(claim, stageId) {
  const scored = (claim.stageScores || []).some((s) => s.stageId === stageId);
  if (scored) return '';
  const heldName = stageDisplayName(claim.heldAtStage || claim.workflowStage);
  if (claim.holdReason === 'critical') {
    return `This stage is not scored. A critical use-case failed at ${heldName}. The claim cannot move on unless that check is bypassed and approved.`;
  }
  if (claim.holdReason === 'docs') {
    return `This stage is not scored until required ${heldName} documents are on file.`;
  }
  if (claim.holdReason === 'surveyor') {
    return `This stage is not scored until Assessment is submitted.`;
  }
  return `This stage is not scored yet. The claim is still at ${heldName}.`;
}

function claimInfoDrawer(claim) {
  return `
    <div class="drawer-backdrop" data-action="close-drawer">
      <aside class="claim-drawer" role="dialog" aria-label="Claim details" onclick="event.stopPropagation()">
        <div class="drawer-header">
          <div>
            <h2>Claim details</h2>
            <p class="drawer-sub">${formatClaimRef(claim)}</p>
          </div>
          <button type="button" class="btn btn-ghost icon-btn" data-action="close-drawer" aria-label="Close">${iconClose()}</button>
        </div>
        <div class="drawer-body">
          <div class="drawer-grid">
            <div class="meta-item"><label>Claim number</label><div class="value">${formatClaimRef(claim)}</div></div>
            <div class="meta-item"><label>Policy number</label><div class="value">${claim.policyNumber}</div></div>
            <div class="meta-item"><label>Claimant</label><div class="value">${claim.claimant}</div></div>
            <div class="meta-item"><label>Claim amount</label><div class="value">${formatClaimAmount(claim)}</div></div>
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
            <div class="meta-item"><label>${stageDisplayName(getClaimWorkflowStage(claim))} score</label><div class="value">${formatClaimScore(claim)} · ${tierLabel(claim.tier, claim)}</div></div>
          </div>
          <h3 class="drawer-section-title">Stage scores</h3>
          <div class="stage-score-list">
            ${(claim.stageScores || [])
              .map(
                (s) => `
              <div class="stage-score-row">
                <span>${s.stageName}</span>
                <strong class="claim-tier ${s.tier}">${formatStageScore(s)}</strong>
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
  { drawerOpen = false, selectedStage = null, exceptionNotice = null } = {}
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
  const isClaimUser = session.role === 'claim_user';
  const hideAssigned = isClaimUser || isSurveyor;
  const hideWeights = isClaimUser;
  const stageTab = isSurveyor ? selectedStage || 'assessment' : selectedStage || 'all';
  const surveyorCanWork =
    isSurveyor &&
    stageTab === 'assessment' &&
    hasPassedPriorStages(claim, ['fnol', 'intimation']) &&
    !claim.surveyorSubmitted;
  const surveyorSubmitted = isSurveyor && !!claim.surveyorSubmitted;
  const displayStages =
    stageTab && stageTab !== 'all'
      ? CLAIM_STAGES.filter((s) => s.id === stageTab)
      : CLAIM_STAGES;
  const stageResults =
    stageTab && stageTab !== 'all'
      ? (claim.results || []).filter((r) => r.stage === stageTab)
      : claim.results || [];
  const sorted = sortChecksForDisplay(stageResults);
  const counts = {
    all: stageResults.length,
    pass: stageResults.filter((r) => r.state === 'pass').length,
    fail: stageResults.filter((r) => r.state === 'fail' || r.state === 'cant_evaluate').length,
  };

  const filtered =
    filter === 'all'
      ? sorted
      : filter === 'fail'
        ? sorted.filter((r) => r.state === 'fail' || r.state === 'cant_evaluate')
        : sorted.filter((r) => r.state === filter);

  const s = claim.summary;
  const summaryLine = [
    s.hardFailCount
      ? `${s.hardFailCount} critical fail${s.hardFailCount > 1 ? 's' : ''}`
      : null,
    `${s.failCount ?? s.softFailCount} of ${s.softTotal + (s.hardFailCount || 0)} checks failed`,
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
            <button type="button" class="claim-link" data-action="open-drawer">${formatClaimRef(claim)}</button>
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
          <div class="value">${formatClaimAmount(claim)}</div>
        </div>
        ${
          hideAssigned
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
      exceptionNotice
        ? `<div class="surveyor-banner"><strong>Bypass requested</strong><p>${esc(exceptionNotice)}</p></div>`
        : ''
    }
    ${
      surveyorCanWork
        ? `<div class="surveyor-banner">
        <strong>Assessment stage</strong>
        <p>Upload your documents below and submit to run further scoring. Switch to FNOL, Registration, or Settlement to review earlier or later stages.</p>
      </div>`
        : isSurveyor && stageTab === 'assessment' && !surveyorSubmitted
          ? `<div class="surveyor-banner">
        <strong>Assessment stage</strong>
        <p>This claim has not completed FNOL and Registration yet. You can review this stage; submit is available after those stages pass. Switch tabs to inspect FNOL, Registration, or Settlement.</p>
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
          <strong>Critical use-case failed</strong>
          <p>${hardFailNames}. This stage is Fail and the claim cannot move to the next stage unless the check is bypassed or corrected.</p>
        </div>
      </div>
    `
        : ''
    }

    <div class="score-panel">
      <div class="score-circle lg ${claim.tier}${claim.forcedRed ? ' is-fail-text' : ''}">${formatClaimScore(claim)}</div>
      <div class="score-panel-text">
        <h2>${stageDisplayName(getClaimWorkflowStage(claim))} ${claim.forcedRed ? 'result' : 'score'}</h2>
        <div class="tier-label ${claim.tier}" style="color:var(--${claim.tier === 'yellow' ? 'amber' : claim.tier})">${tierLabel(claim.tier, claim)}${
          claim.hasOverride ? ` <span class="tag override">Override</span>` : ''
        }</div>
        <p class="summary-line">${summaryLine}</p>
      </div>
    </div>

    <div class="stage-chips is-tabs">
      ${
        isSurveyor
          ? ''
          : `<button type="button" class="stage-chip ${stageTab === 'all' ? 'is-active' : ''}" data-stage-tab="all">
          <span class="stage-chip-name">All</span>
        </button>`
      }
      ${CLAIM_STAGES.map((st) => {
          const stageId = st.id;
          const stageScore = (claim.stageScores || []).find((x) => x.stageId === stageId);
          const docs = getStageDocCompleteness(claim, stageId);
          const active = stageTab === stageId;
          const held = !stageScore && claim.heldAtStage && claim.heldAtStage !== stageId;
          const inner = `
          <span class="stage-chip-name">${stageDisplayName(stageId)}</span>
          ${stageScore ? `<span class="score-circle xs ${stageScore.tier}${stageScore.criticalFailed ? ' is-fail-text' : ''}">${formatStageScore(stageScore)}</span>` : ''}
          ${
            stageScore
              ? stageScore.criticalFailed
                ? `<span class="doc-complete-chip">Fail</span>`
                : `<span class="doc-complete-chip">${stageScore.passed ? 'Pass' : 'Fail'} at ${stageScore.passMark}%</span>`
              : held
                ? `<span class="doc-complete-chip">Held</span>`
                : ''
          }
          ${docs.total ? `<span class="doc-complete-chip">${docs.done}/${docs.total} docs</span>` : ''}
        `;
          return `<button type="button" class="stage-chip ${active ? 'is-active' : ''}" data-stage-tab="${stageId}">${inner}</button>`;
        }).join('')}
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
    </div>

    <div class="checks-by-stage">
      ${checksByStage
              .map(({ stage, items }) => {
                const stageScore = (claim.stageScores || []).find((x) => x.stageId === stage.id);
                const docs = getStageDocCompleteness(claim, stage.id);
                const stageHasExcluded = (claim.results || []).some(
                  (r) => r.stage === stage.id && !r.hardFail && (r.state === 'bypassed' || r.state === 'waived')
                );
                const stageHasCritical = (claim.results || []).some((r) => r.stage === stage.id && r.hardFail);
                const hints = [];
                if (!hideWeights && stageHasCritical) {
                  hints.push(
                    'Critical use-cases are pass / fail only. If they pass, remaining use-cases in this stage share 100%.'
                  );
                }
                if (!hideWeights && stageHasExcluded) {
                  hints.push('Bypassed use-cases are excluded. Remaining weights in this stage are normalised to 100%.');
                }
                const holdNote = stageHoldMessage(claim, stage.id);
                return `
            <section class="stage-block">
              <div class="stage-block-header">
                <div>
                  <h3>${stageDisplayName(stage.id)}</h3>
                  <p>${stage.description}</p>
                </div>
                <div class="stage-block-score">
                  ${docs.total ? `<span class="doc-complete-chip">${docs.done}/${docs.total} docs</span>` : ''}
                  ${
                    stageScore
                      ? `<span class="score-circle sm ${stageScore.tier}${stageScore.criticalFailed ? ' is-fail-text' : ''}">${formatStageScore(stageScore)}</span>`
                      : ''
                  }
                </div>
              </div>
              ${holdNote ? `<p class="stage-hold-note">${holdNote}</p>` : ''}
              <div class="checks-list">
                ${
                  items.length === 0
                    ? filter === 'all' || holdNote
                      ? ''
                      : `<div class="empty-checks">No checks in this result state.</div>`
                    : items
                        .map((r) => {
                          return `
                  <div class="check-row ${r.state}${hideWeights ? ' no-weight' : ''}">
                    <div class="check-state-icon ${r.state}">${stateIcon(r.state)}</div>
                    <div class="check-body">
                      <div class="check-name">
                        <span class="check-code">${checkCode(r.checkId)}</span>
                        ${r.name}
                        ${r.hardFail ? `<span class="tag critical">Critical</span>` : ''}
                      </div>
                      <p class="evidence">${r.evidence}</p>
                      ${exceptionBlockHtml(r, session, claim)}
                    </div>
                    ${hideWeights ? '' : `<div class="check-weight">${weightCellHtml(r, stageHasExcluded)}</div>`}
                  </div>
                `;
                        })
                        .join('')
                }
              </div>
              ${hints.map((h) => `<p class="stage-norm-hint">${h}</p>`).join('')}
              ${documentChecklistHtml(claim, stage.id, {
                readOnly: isClaimUser || (isSurveyor && (stage.id !== 'assessment' || surveyorSubmitted)),
              })}
              ${
                stage.id === 'assessment' && surveyorCanWork
                  ? `
                <div class="surveyor-submit">
                  <p>${
                    hasStageDocsComplete(claim, 'assessment')
                      ? 'Required Assessment documents are on file. Submit to run further scoring and move this claim to the next stage.'
                      : 'Upload every required Assessment document, then submit for further scoring.'
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
    onFilter(nextFilter, {
      drawerOpen,
      selectedStage: stageTab,
      exceptionNotice: null,
      ...extra,
    });
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
      mockUploadClaimDocument(claim.id, btn.dataset.docId, session);
      persist(filter);
    });
  });
  root.querySelector('[data-action="submit-surveyor"]')?.addEventListener('click', () => {
    const result = submitSurveyorAssessment(claim.id);
    persist(filter, { surveyorMessage: result.message });
  });
  root.querySelectorAll('[data-action="request-bypass"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = requestCoreBypass(claim.id, Number(btn.dataset.checkId), session);
      persist(filter, {
        exceptionNotice: result.message,
      });
    });
  });
}
