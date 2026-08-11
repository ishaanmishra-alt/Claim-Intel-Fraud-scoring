import { renderShell, iconLock } from '../components.js';
import { ROLE_LABELS, CHECK_DEFINITIONS, CHECK_CATEGORIES } from '../data.js';
import { canAccess } from '../scoring.js';
import { saveWeights, resetWeights } from '../state.js';

function computeTotal(draft, soft) {
  return soft.reduce((sum, c) => sum + (Number(draft[c.id]) || 0), 0);
}

function updateFooter(root, draft, soft, feedback) {
  const total = computeTotal(draft, soft);
  const at100 = total === 100;
  const totalEl = root.querySelector('.running-total');
  if (totalEl) {
    totalEl.className = `running-total ${at100 ? 'at-100' : 'not-100'}`;
    totalEl.innerHTML = `Running total <span class="total-value">${total}%</span>${at100 ? ' · ready to save' : ''}`;
  }
  const actions = root.querySelector('.footer-actions');
  if (!actions) return;
  let fb = actions.querySelector('.save-feedback');
  if (!feedback) {
    if (fb) fb.remove();
    return;
  }
  if (!fb) {
    fb = document.createElement('span');
    fb.className = 'save-feedback';
    actions.insertBefore(fb, actions.querySelector('[data-action="reset"]'));
  }
  fb.className = `save-feedback ${feedback.type === 'success' ? 'success' : 'error'}`;
  fb.textContent = feedback.message;
}

export function renderConfig(root, session, weights, draft, feedback, onDraftChange, onSaved) {
  if (!canAccess(session.role, 'config')) {
    location.hash = '#/queue';
    return;
  }

  const knockouts = CHECK_DEFINITIONS.filter((c) => c.hardFail);
  const soft = CHECK_DEFINITIONS.filter((c) => !c.hardFail);
  const total = computeTotal(draft, soft);
  const at100 = total === 100;

  let feedbackHtml = '';
  if (feedback?.type === 'error') {
    feedbackHtml = `<span class="save-feedback error">${feedback.message}</span>`;
  } else if (feedback?.type === 'success') {
    feedbackHtml = `<span class="save-feedback success">${feedback.message}</span>`;
  }

  const content = `
    <div class="page-header">
      <div>
        <h1>Configuration</h1>
        <p class="page-subtitle">Weightage for soft-signal checks · knockouts override the score</p>
      </div>
    </div>

    <div class="info-banner">
      <div class="lock-icon">${iconLock()}</div>
      <div>
        <strong>Vendor-controlled use-cases</strong>
        <p>Which checks are switched on is set by Claim Intel, not the customer. Active use-cases below are read-only for enablement — only weightage is editable.</p>
      </div>
    </div>

    <div class="config-section">
      <h2>Hard-fail knockouts</h2>
      <p class="section-desc">These checks carry no weight. If any one fails, the claim is forced to Red regardless of the weighted score.</p>
      ${knockouts
        .map(
          (c) => `
        <div class="config-check">
          <div>
            <div class="name">${c.name}</div>
            <div class="category">${CHECK_CATEGORIES[c.category]}</div>
          </div>
          <span class="tag override">Override</span>
        </div>
      `
        )
        .join('')}
    </div>

    <div class="config-section">
      <h2>Weighted soft signals</h2>
      <p class="section-desc">Whole-number percentages only. Active weights must total exactly 100%.</p>
      ${soft
        .map(
          (c) => `
        <div class="config-check">
          <div>
            <div class="name">${c.name}</div>
            <div class="category">${CHECK_CATEGORIES[c.category]}</div>
          </div>
          <div class="weight-input-wrap">
            <input type="number" min="0" max="100" step="1" inputmode="numeric"
              data-weight-id="${c.id}" value="${draft[c.id] ?? 0}" />
            <span class="pct">%</span>
          </div>
        </div>
      `
        )
        .join('')}
    </div>

    <div class="config-footer">
      <div class="running-total ${at100 ? 'at-100' : 'not-100'}">
        Running total <span class="total-value">${total}%</span>
        ${at100 ? ' · ready to save' : ''}
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

  // Local mutable draft so typing does not remount inputs
  const localDraft = { ...draft };

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
      updateFooter(root, localDraft, soft, null);
    });

    input.addEventListener('blur', () => {
      const id = Number(input.dataset.weightId);
      const num = parseInt(input.value, 10);
      if (!Number.isFinite(num)) {
        input.value = '0';
        localDraft[id] = 0;
        onDraftChange(localDraft, null, { silent: true });
        updateFooter(root, localDraft, soft, null);
      }
    });
  });

  root.querySelector('[data-action="save"]').addEventListener('click', () => {
    const t = computeTotal(localDraft, soft);
    if (t !== 100) {
      const g = 100 - t;
      const message =
        g > 0
          ? `Total is ${t}% — add ${g}% to save`
          : `Total is ${t}% — remove ${Math.abs(g)}% to save`;
      updateFooter(root, localDraft, soft, { type: 'error', message });
      onDraftChange(localDraft, { type: 'error', message }, { silent: true });
      return;
    }
    const cleaned = Object.fromEntries(
      soft.map((c) => [c.id, Number(localDraft[c.id]) || 0])
    );
    saveWeights(cleaned);
    onSaved(cleaned, { type: 'success', message: 'Weightage saved.' });
  });

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    const defaults = resetWeights();
    onSaved(defaults, { type: 'success', message: 'Weightage saved.' });
  });
}
