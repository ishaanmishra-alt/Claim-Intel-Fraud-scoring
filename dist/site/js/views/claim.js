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
  getPendingExceptions,
  latestExceptionForCheck,
  isCheckerRole,
  proposeCheckException,
  decideCheckException,
  formatClaimRef,
} from '../data.js';
import { formatAED, formatClaimAmount, formatDate, formatScore, tierLabel, sortChecksForDisplay } from '../scoring.js';

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

function exceptionPanelHtml(result, mode, claim, pending) {
  void claim;
  if (mode === 'bypass') {
    return `
      <form class="exception-panel" data-exception-form data-mode="bypass" data-check-id="${result.checkId}" data-hard-fail="${result.hardFail ? '1' : '0'}">
        <strong>Bypass ${checkCode(result.checkId)}</strong>
        <p class="exception-lead">Request a bypass for this failed use-case. After Claim Head approval it will not count toward this stage’s score or weightage. The same approval flow runs in the core system.</p>
        <label>Comment
          <textarea name="comment" rows="2" required placeholder="Why bypass this use-case?"></textarea>
        </label>
        <div class="exception-actions">
          <button type="submit" class="btn btn-sm btn-primary">Submit to Claim Head</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="exception-cancel">Cancel</button>
        </div>
      </form>
    `;
  }
  if (mode === 'send_back' && pending) {
    return `
      <form class="exception-panel" data-exception-form data-mode="send_back" data-exception-id="${pending.id}">
        <strong>Send back ${checkCode(result.checkId)}</strong>
        <p class="exception-lead">Return this request to the maker. A comment is required.</p>
        <label>Comment
          <textarea name="comment" rows="2" required placeholder="What should the maker change?"></textarea>
        </label>
        <div class="exception-actions">
          <button type="submit" class="btn btn-sm btn-primary">Send back</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="exception-cancel">Cancel</button>
        </div>
      </form>
    `;
  }
  return '';
}

function exceptionBlockHtml(result, session, panel, claim) {
  if (session.role === 'surveyor') return '';
  const latest = latestExceptionForCheck(claim, result.checkId);
  const pending = latest?.status === 'pending' ? latest : null;
  const sentBack = latest?.status === 'sent_back' ? latest : null;
  const eligibleState = result.state === 'fail';
  const canPropose = session.role === 'claim_user' && eligibleState && !pending;
  const canDecide = isCheckerRole(session.role) && !!pending;

  const bits = [];
  if (pending) {
    bits.push(
      `<div class="exception-status is-pending">Pending Claim Head · Bypass requested by ${esc(pending.requestedBy?.name || 'Claim User')}</div>`
    );
    if (pending.comment) bits.push(`<p class="exception-note">${esc(pending.comment)}</p>`);
  } else if (sentBack && canPropose) {
    bits.push(
      `<div class="exception-status is-back">Sent back${sentBack.decidedBy?.name ? ` by ${esc(sentBack.decidedBy.name)}` : ''}: ${esc(sentBack.decisionComment)}</div>`
    );
  }
  if (result.state === 'bypassed') bits.push(`<span class="tag override">Bypassed</span>`);

  const buttons = [];
  if (canPropose) {
    buttons.push(
      `<button type="button" class="btn btn-sm btn-primary" data-action="exception-open" data-mode="bypass" data-check-id="${result.checkId}">Bypass</button>`
    );
  }
  if (canDecide) {
    buttons.push(
      `<button type="button" class="btn btn-sm btn-primary" data-action="exception-decide" data-decision="approved" data-exception-id="${pending.id}">Approve</button>`
    );
    buttons.push(
      `<button type="button" class="btn btn-sm btn-secondary" data-action="exception-open" data-mode="send_back" data-check-id="${result.checkId}" data-exception-id="${pending.id}">Send back</button>`
    );
  }

  const open = panel && Number(panel.checkId) === result.checkId;
  const panelHtml = open ? exceptionPanelHtml(result, panel.mode, claim, pending) : '';
  if (!bits.length && !buttons.length && !panelHtml) return '';
  return `
    <div class="exception-block">
      ${bits.join('')}
      ${buttons.length ? `<div class="exception-actions">${buttons.join('')}</div>` : ''}
      ${panelHtml}
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
            <div class="meta-item"><label>${stageDisplayName(getClaimWorkflowStage(claim))} score</label><div class="value">${formatScore(claim.score)} · ${tierLabel(claim.tier)}</div></div>
          </div>
          <h3 class="drawer-section-title">Stage scores</h3>
          <div class="stage-score-list">
            ${(claim.stageScores || [])
              .map(
                (s) => `
              <div class="stage-score-row">
                <span>${s.stageName}</span>
                <strong class="claim-tier ${s.tier}">${formatScore(s.score)}</strong>
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
  { drawerOpen = false, selectedStage = null, exceptionPanel = null, exceptionNotice = null } = {}
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

  const pendingExceptions = getPendingExceptions(claim);
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
      exceptionNotice
        ? `<div class="surveyor-banner">${esc(exceptionNotice)}</div>`
        : ''
    }
    ${
      pendingExceptions.length
        ? `<div class="surveyor-banner">
        <strong>Pending exceptions</strong>
        <p>${pendingExceptions.length} use-case exception${pendingExceptions.length === 1 ? '' : 's'} waiting for Claim Head. Checks stay failed until approved.</p>
      </div>`
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
          <strong>Critical check failed — routed to red</strong>
          <p>${hardFailNames}. The failed critical use-case zeros this stage unless it is bypassed.</p>
        </div>
      </div>
    `
        : ''
    }

    <div class="score-panel">
      <div class="score-circle lg ${claim.tier}">${formatScore(claim.score)}</div>
      <div class="score-panel-text">
        <h2>${stageDisplayName(getClaimWorkflowStage(claim))} score</h2>
        <div class="tier-label ${claim.tier}" style="color:var(--${claim.tier === 'yellow' ? 'amber' : claim.tier})">${tierLabel(claim.tier)}${
          claim.hasOverride ? ` <span class="tag override">Override</span>` : ''
        }</div>
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
          ${stageScore ? `<span class="score-circle xs ${stageScore.tier}">${formatScore(stageScore.score)}</span>` : ''}
          ${stageScore ? `<span class="doc-complete-chip">${stageScore.passed ? 'Pass' : 'Fail'} at ${stageScore.passMark}%</span>` : ''}
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
                  <p>${stage.description}</p>
                </div>
                <div class="stage-block-score">
                  ${docs.total ? `<span class="doc-complete-chip">${docs.done}/${docs.total} docs</span>` : ''}
                  ${
                    stageScore
                      ? `<span class="score-circle sm ${stageScore.tier}">${formatScore(stageScore.score)}</span>`
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
                          const metaLabel = `${r.weight ?? 0}%`;
                          return `
                  <div class="check-row ${r.state}">
                    <div class="check-state-icon ${r.state}">${stateIcon(r.state)}</div>
                    <div class="check-body">
                      <div class="check-name">
                        <span class="check-code">${checkCode(r.checkId)}</span>
                        ${r.name}
                        ${pendingExceptions.some((e) => e.checkId === r.checkId) ? `<span class="tag override">Pending</span>` : ''}
                      </div>
                      <p class="evidence">${r.evidence}</p>
                      ${exceptionBlockHtml(r, session, exceptionPanel, claim)}
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
      exceptionPanel,
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
  root.querySelectorAll('[data-action="exception-open"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      persist(filter, {
        exceptionPanel: { checkId: Number(btn.dataset.checkId), mode: btn.dataset.mode },
        exceptionNotice: null,
      });
    });
  });
  root.querySelectorAll('[data-action="exception-cancel"]').forEach((btn) => {
    btn.addEventListener('click', () => persist(filter, { exceptionPanel: null }));
  });
  root.querySelectorAll('[data-action="exception-decide"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = decideCheckException(
        claim.id,
        btn.dataset.exceptionId,
        btn.dataset.decision,
        '',
        session
      );
      persist(filter, {
        exceptionPanel: null,
        exceptionNotice: result.ok ? null : result.message,
      });
    });
  });
  root.querySelectorAll('[data-exception-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const mode = form.dataset.mode;
      const comment = form.querySelector('[name="comment"]')?.value || '';
      if (mode === 'send_back') {
        const result = decideCheckException(claim.id, form.dataset.exceptionId, 'sent_back', comment, session);
        persist(filter, {
          exceptionPanel: null,
          exceptionNotice: result.ok ? null : result.message,
        });
        return;
      }
      const proposedFields = {};
      form.querySelectorAll('[data-field]').forEach((input) => {
        proposedFields[input.dataset.field] = input.value;
      });
      const result = proposeCheckException(
        claim.id,
        {
          checkId: Number(form.dataset.checkId),
          type: mode,
          comment,
          proposedFields,
          hardFail: form.dataset.hardFail === '1',
        },
        session
      );
      persist(filter, {
        exceptionPanel: result.ok ? null : exceptionPanel,
        exceptionNotice: result.ok ? null : result.message,
      });
    });
  });
}
