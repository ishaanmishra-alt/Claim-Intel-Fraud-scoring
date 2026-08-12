import { renderShell, iconLock } from '../components.js';
import { ROLE_LABELS, CHECK_DEFINITIONS, CLAIM_STAGES, checkCode } from '../data.js';
import { canAccess } from '../scoring.js';
import { saveWeights, resetWeights } from '../state.js';

function softForStage(stageId) {
  return CHECK_DEFINITIONS.filter((c) => c.stage === stageId && !c.hardFail);
}

function hardForStage(stageId) {
  return CHECK_DEFINITIONS.filter((c) => c.stage === stageId && c.hardFail);
}

function stageTotal(draft, stageId) {
  return softForStage(stageId).reduce((sum, c) => sum + (Number(draft[c.id]) || 0), 0);
}

function allStagesValid(draft) {
  return CLAIM_STAGES.every((s) => {
    const soft = softForStage(s.id);
    if (!soft.length) return true;
    return stageTotal(draft, s.id) === 100;
  });
}

function updateStageTotals(root, draft) {
  CLAIM_STAGES.forEach((stage) => {
    const soft = softForStage(stage.id);
    if (!soft.length) return;
    const total = stageTotal(draft, stage.id);
    const el = root.querySelector(`[data-stage-total="${stage.id}"]`);
    if (!el) return;
    el.className = `running-total ${total === 100 ? 'at-100' : 'not-100'}`;
    el.innerHTML = `${stage.name} total <span class="total-value">${total}%</span>${total === 100 ? ' · ready' : ''}`;
  });
}

export function renderConfig(root, session, weights, draft, feedback, onDraftChange, onSaved) {
  if (!canAccess(session.role, 'config')) {
    location.hash = '#/queue';
    return;
  }

  const localDraft = { ...draft };
  const valid = allStagesValid(localDraft);

  let feedbackHtml = '';
  if (feedback?.type === 'error') {
    feedbackHtml = `<span class="save-feedback error">${feedback.message}</span>`;
  } else if (feedback?.type === 'success') {
    feedbackHtml = `<span class="save-feedback success">${feedback.message}</span>`;
  }

  const stageSections = CLAIM_STAGES.map((stage) => {
    const knockouts = hardForStage(stage.id);
    const soft = softForStage(stage.id);
    const total = stageTotal(localDraft, stage.id);
    return `
      <div class="config-section stage-config">
        <h2>${stage.name}</h2>
        <p class="section-desc">${stage.description}. Soft-signal weights in this stage must total exactly 100%.</p>

        ${
          knockouts.length
            ? `
          <h3 class="config-subhead">Hard-fail checks</h3>
          ${knockouts
            .map(
              (c) => `
            <div class="config-check">
              <div>
                <div class="name"><span class="check-code">${checkCode(c.id)}</span> ${c.name}</div>
              </div>
              <span class="tag override">Override</span>
            </div>
          `
            )
            .join('')}
        `
            : ''
        }

        ${
          soft.length
            ? `
          <h3 class="config-subhead">Weighted soft signals</h3>
          ${soft
            .map(
              (c) => `
            <div class="config-check">
              <div>
                <div class="name"><span class="check-code">${checkCode(c.id)}</span> ${c.name}</div>
              </div>
              <div class="weight-input-wrap">
                <input type="number" min="0" max="100" step="1" inputmode="numeric"
                  data-weight-id="${c.id}" data-stage="${stage.id}" value="${localDraft[c.id] ?? 0}" />
                <span class="pct">%</span>
              </div>
            </div>
          `
            )
            .join('')}
          <div class="running-total ${total === 100 ? 'at-100' : 'not-100'}" data-stage-total="${stage.id}">
            ${stage.name} total <span class="total-value">${total}%</span>${total === 100 ? ' · ready' : ''}
          </div>
        `
            : ''
        }
      </div>
    `;
  }).join('');

  const content = `
    <div class="page-header">
      <div>
        <h1>Configuration</h1>
        <p class="page-subtitle">Stage-based weightage · each claim stage totals 100%</p>
      </div>
    </div>

    <div class="info-banner">
      <div class="lock-icon">${iconLock()}</div>
      <div>
        <strong>Vendor-controlled use-cases</strong>
        <p>Which checks are switched on is set by Claim Intel. Soft weights are editable per stage (FNOL, Registration, Assessment, Settlement) — each stage must total 100%.</p>
      </div>
    </div>

    ${stageSections}

    <div class="config-footer">
      <div class="running-total ${valid ? 'at-100' : 'not-100'}">
        All stages ${valid ? 'at 100%' : 'must total 100%'}
      </div>
      <div class="footer-actions">
        ${feedbackHtml}
        <button type="button" class="btn btn-secondary" data-action="reset">Reset defaults</button>
        <button type="button" class="btn btn-primary" data-action="save">Save weightage</button>
      </div>
    </div>
  `;

  root.innerHTML = renderShell(session, '#/config', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];

  root.querySelectorAll('[data-weight-id]').forEach((input) => {
    input.addEventListener('input', () => {
      let val = input.value;
      if (val.includes('.') || val.includes('e') || val.includes('E')) {
        val = String(Math.trunc(Number(val)) || 0);
        input.value = val;
      }
      const id = Number(input.dataset.weightId);
      const num = val === '' ? 0 : parseInt(val, 10);
      localDraft[id] = Number.isFinite(num) ? Math.max(0, num) : 0;
      onDraftChange(localDraft, null, { silent: true });
      updateStageTotals(root, localDraft);
      const footer = root.querySelector('.config-footer .running-total');
      if (footer) {
        const ok = allStagesValid(localDraft);
        footer.className = `running-total ${ok ? 'at-100' : 'not-100'}`;
        footer.textContent = `All stages ${ok ? 'at 100%' : 'must total 100%'}`;
      }
    });
  });

  root.querySelector('[data-action="save"]').addEventListener('click', () => {
    const bad = CLAIM_STAGES.find((stage) => {
      const soft = softForStage(stage.id);
      return soft.length && stageTotal(localDraft, stage.id) !== 100;
    });
    if (bad) {
      const t = stageTotal(localDraft, bad.id);
      const g = 100 - t;
      const message =
        g > 0
          ? `${bad.name} is ${t}% — add ${g}% to save`
          : `${bad.name} is ${t}% — remove ${Math.abs(g)}% to save`;
      onDraftChange(localDraft, { type: 'error', message }, { silent: true });
      const actions = root.querySelector('.footer-actions');
      let fb = actions.querySelector('.save-feedback');
      if (!fb) {
        fb = document.createElement('span');
        actions.insertBefore(fb, actions.querySelector('[data-action="reset"]'));
      }
      fb.className = 'save-feedback error';
      fb.textContent = message;
      return;
    }
    const softIds = CHECK_DEFINITIONS.filter((c) => !c.hardFail).map((c) => c.id);
    const cleaned = Object.fromEntries(softIds.map((id) => [id, Number(localDraft[id]) || 0]));
    saveWeights(cleaned);
    onSaved(cleaned, { type: 'success', message: 'Weightage saved.' });
  });

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    const defaults = resetWeights();
    onSaved(defaults, { type: 'success', message: 'Weightage saved.' });
  });
}
