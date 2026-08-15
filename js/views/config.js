import { renderShell } from '../components.js';
import {
  ROLE_LABELS,
  USE_CASE_LIBRARY,
  CLAIM_STAGES,
  RISK_CATEGORIES,
  DEFAULT_STAGE_PASS,
  checkCode,
  isTenantEnabledUseCase,
} from '../data.js';
import { canAccess } from '../scoring.js';
import {
  getConfigStore,
  getCurrentConfigVersion,
  getConfigVersionById,
  commitConfigChange,
  formatVersionLabel,
  formatLongDate,
  isFutureVersion,
} from '../state.js';

const SCORING_TABS = CLAIM_STAGES.map((s) => ({
  id: s.id,
  label: `${s.name} scoring`,
}));

function stageName(id) {
  return CLAIM_STAGES.find((s) => s.id === id)?.name || id;
}

function categoryLabel(id) {
  return RISK_CATEGORIES.find((c) => c.id === id)?.name || id;
}

function iconHistory() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12a9 9 0 109-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 5v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconDots() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>`;
}

function iconFilter() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function cloneUseCases(list) {
  return list.map((u) => ({ ...u }));
}

/** @type {{ riskCategory: string, query: string }} */
let filters = { riskCategory: 'all', query: '' };
let scoringTab = 'fnol';
/** @type {number|null} viewing historical version id */
let viewingVersionId = null;
let openMenuId = null;
let modal = null;
let prevVersionsOpen = false;
let feedback = null;
let ucPickerOpen = false;

function getViewVersion() {
  const store = getConfigStore();
  if (viewingVersionId && viewingVersionId !== store.currentId) {
    return getConfigVersionById(viewingVersionId, store);
  }
  return getCurrentConfigVersion(store);
}

function isReadOnly() {
  const store = getConfigStore();
  return viewingVersionId != null && viewingVersionId !== store.currentId;
}

function filteredRows(useCases) {
  return useCases.filter((u) => {
    if (u.stage !== scoringTab) return false;
    if (filters.riskCategory !== 'all' && u.riskCategory !== filters.riskCategory) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const blob = `${u.code} ${u.name} ${u.description}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function defaultVersionDates() {
  return { startDate: '', endDate: '' };
}

function readVersionDates(root) {
  const startDate = root.querySelector('#modal-start-date')?.value || '';
  const endRaw = root.querySelector('#modal-end-date')?.value || '';
  return {
    startDate,
    endDate: endRaw || null,
  };
}

function validateVersionDates(dates) {
  if (!dates.startDate) return 'Please select a start date for the new version.';
  if (!dates.endDate) return 'Please select an end date for the new version.';
  if (dates.endDate < dates.startDate) {
    return 'End date must be on or after the start date.';
  }
  return null;
}

function hasCompleteVersionDates(draft = {}) {
  return !!(draft.startDate && draft.endDate && draft.endDate >= draft.startDate);
}

function applyMutation(mutator, dates, extras = {}) {
  const store = getConfigStore();
  const current = getCurrentConfigVersion(store);
  const next = mutator(cloneUseCases(current.useCases));
  const result = commitConfigChange(next, dates, extras);
  const created = result.versions[result.versions.length - 1];
  viewingVersionId = null;
  const endLabel = created.endDate ? formatLongDate(created.endDate) : 'Present';
  const when = isFutureVersion(created) ? 'scheduled' : 'created';
  feedback = {
    type: 'success',
    message: `Version ${created.number} ${when} (${formatLongDate(created.startDate)} – ${endLabel}).`,
  };
}

function versionNoticeHtml() {
  return `
    <div class="version-notice" role="status">
      Your changes will be saved as a new version. Select the start date and end date for this new version to continue.
    </div>
  `;
}

function versionDateFieldsHtml(draft = {}) {
  const start = draft.startDate || '';
  const end = draft.endDate || '';
  const err = draft.dateError ? `<p class="version-dates-error">${draft.dateError}</p>` : '';
  return `
    <div class="version-dates-block">
      <div class="version-dates-title">Select version dates</div>
      <p class="version-dates-hint">Both dates are required before a new version can be created. Use a future start date to schedule this version.</p>
      <div class="field-row field-row-2">
        <div class="field">
          <label for="modal-start-date">Start date <span class="required-mark">*</span></label>
          <input type="date" id="modal-start-date" value="${start}" required />
        </div>
        <div class="field">
          <label for="modal-end-date">End date <span class="required-mark">*</span></label>
          <input type="date" id="modal-end-date" value="${end}" required />
        </div>
      </div>
      ${err}
    </div>
  `;
}

function useCasePickerHtml(currentUseCases, draft = {}) {
  const catalog = USE_CASE_LIBRARY.filter((d) => !currentUseCases.some((u) => u.id === d.id));
  const enabled = catalog.filter((d) => isTenantEnabledUseCase(d));
  const locked = catalog.filter((d) => !isTenantEnabledUseCase(d));
  const selected = draft.id ? USE_CASE_LIBRARY.find((d) => d.id === Number(draft.id)) : null;
  const selectedEnabled = selected ? isTenantEnabledUseCase(selected) : null;

  const optionBtn = (d) => {
    const enabledUc = isTenantEnabledUseCase(d);
    const selectedCls = Number(draft.id) === d.id ? 'is-selected' : '';
    return `
      <button type="button"
        class="uc-picker-option ${enabledUc ? 'is-enabled' : 'is-locked'} ${selectedCls}"
        data-pick-uc="${d.id}">
        <span class="uc-status-dot" aria-hidden="true"></span>
        <span class="uc-picker-option-text">
          <span class="uc-picker-code">${checkCode(d.id)}</span>
          <span class="uc-picker-name">${d.name}</span>
        </span>
        <span class="uc-picker-badge">${enabledUc ? 'Available' : 'Not enabled'}</span>
      </button>
    `;
  };

  const triggerLabel = selected ? `${checkCode(selected.id)} — ${selected.name}` : 'Select use-case…';

  return `
    <div class="field">
      <label>Use-case</label>
      <div class="uc-picker ${ucPickerOpen ? 'is-open' : ''}">
        <button type="button" class="uc-picker-trigger ${selected ? (selectedEnabled ? 'is-enabled' : 'is-locked') : ''}" data-action="toggle-uc-picker" aria-expanded="${ucPickerOpen ? 'true' : 'false'}">
          <span class="uc-status-dot" aria-hidden="true"></span>
          <span class="uc-picker-trigger-label">${triggerLabel}</span>
          <span class="uc-picker-caret" aria-hidden="true">▾</span>
        </button>
        ${
          ucPickerOpen
            ? `
          <div class="uc-picker-menu" role="listbox">
            <div class="uc-picker-legend">
              <span><span class="uc-status-dot is-enabled"></span> Available (enabled)</span>
              <span><span class="uc-status-dot is-locked"></span> Not enabled</span>
            </div>
            ${
              enabled.length
                ? `<div class="uc-picker-group-label">Available</div>${enabled.map(optionBtn).join('')}`
                : `<div class="uc-picker-empty">No available use-cases left to add.</div>`
            }
            ${
              locked.length
                ? `<div class="uc-picker-group-label">Not enabled for your organisation</div>${locked.map(optionBtn).join('')}`
                : ''
            }
            ${!enabled.length && !locked.length ? `<div class="uc-picker-empty">All catalog use-cases are already configured.</div>` : ''}
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

export function renderConfig(root, session) {
  if (!canAccess(session.role, 'config')) {
    location.hash = '#/queue';
    return;
  }

  const store = getConfigStore();
  const current = getCurrentConfigVersion(store);
  const view = getViewVersion() || current;
  const readOnly = isReadOnly();
  const previous = store.versions
    .filter((v) => v.id !== store.currentId)
    .sort((a, b) => b.number - a.number);
  const rows = filteredRows(view.useCases);
  const weightTotal = rows.reduce((sum, u) => sum + (Number(u.weight) || 0), 0);
  const passPct = Number(view.stagePassPct?.[scoringTab] ?? DEFAULT_STAGE_PASS[scoringTab] ?? 70);
  const tabLabel = stageName(scoringTab);

  const content = `
    <div class="page-header config-page-header">
      <div>
        <h1>Configuration</h1>
        <p class="page-subtitle">Stage scoring, use-case weightage, and pass / fail criteria</p>
      </div>
      ${
        readOnly
          ? `<button type="button" class="btn btn-secondary" data-action="back-current">Back to current version</button>`
          : `<button type="button" class="btn btn-primary" data-action="add-uc">+ Add Use-Case</button>`
      }
    </div>

    <div class="config-toolbar">
      <div class="version-controls">
        <div class="current-version-pill">
          ${formatVersionLabel(readOnly ? view : current, { isCurrent: !readOnly })}
          ${readOnly ? '<span class="readonly-tag">Read-only</span>' : ''}
          ${isFutureVersion(view) ? '<span class="readonly-tag">Scheduled</span>' : ''}
        </div>
        <div class="prev-versions-wrap">
          <button type="button" class="btn btn-secondary prev-versions-btn" data-action="toggle-prev">
            ${iconHistory()}
            Previous Versions
          </button>
          ${
            prevVersionsOpen
              ? `
            <div class="prev-versions-menu">
              ${
                previous.length === 0
                  ? `<div class="prev-empty">No previous versions yet.</div>`
                  : previous
                      .map(
                        (v) => `
                    <button type="button" class="prev-version-item" data-view-version="${v.id}">
                      ${formatVersionLabel(v)}
                    </button>
                  `
                      )
                      .join('')
              }
            </div>
          `
              : ''
          }
        </div>
      </div>
      ${feedback ? `<span class="save-feedback ${feedback.type}">${feedback.message}</span>` : ''}
    </div>

    <div class="config-layout">
      <nav class="config-subnav" aria-label="Scoring stages">
        ${SCORING_TABS.map(
          (tab) => `
          <button type="button" class="config-subnav-item ${scoringTab === tab.id ? 'is-active' : ''}" data-scoring-tab="${tab.id}">
            ${tab.label}
          </button>`
        ).join('')}
      </nav>

      <div class="config-stage-pane">
        <div class="config-criteria-card">
          <div>
            <h2>${tabLabel} pass / fail</h2>
            <p>A stage passes when its score is at or above this mark. A failed critical use-case zeros the stage.</p>
          </div>
          <div class="config-pass-field">
            <label for="stage-pass-pct">Pass mark</label>
            <div class="config-pass-input">
              <input type="number" id="stage-pass-pct" min="0" max="100" step="1" value="${passPct}" ${readOnly ? 'disabled' : ''} />
              <span>%</span>
            </div>
            ${
              readOnly
                ? ''
                : `<button type="button" class="btn btn-secondary" data-action="save-pass">Save pass mark</button>`
            }
          </div>
        </div>

        <div class="config-table-card">
          <div class="config-table-filters">
            <div class="filter-group">
              <label>Search</label>
              <input type="search" id="uc-search" placeholder="Search ${tabLabel} use-cases…" value="${filters.query.replace(/"/g, '&quot;')}" />
            </div>
            <div class="filter-group">
              <label>Category ${iconFilter()}</label>
              <select id="filter-category">
                <option value="all">All categories</option>
                ${RISK_CATEGORIES.map((c) => `<option value="${c.id}" ${filters.riskCategory === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="config-table-wrap">
            <table class="config-table">
              <thead>
                <tr>
                  <th class="col-menu"></th>
                  <th>Use-case no.</th>
                  <th>Use-case name</th>
                  <th>Use-case description</th>
                  <th>Category</th>
                  <th>Weightage</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length === 0
                    ? `<tr><td colspan="6" class="empty-cell">No use-cases in ${tabLabel} yet. Add one to start scoring this stage.</td></tr>`
                    : rows
                        .map((u) => {
                          const catClass = `cat-${u.riskCategory}`;
                          return `
                    <tr>
                      <td class="col-menu">
                        ${
                          readOnly
                            ? ''
                            : `
                          <div class="row-menu-wrap">
                            <button type="button" class="row-menu-btn" data-menu="${u.id}" aria-label="Actions">${iconDots()}</button>
                            ${
                              openMenuId === u.id
                                ? `
                              <div class="row-menu">
                                <button type="button" data-edit="${u.id}">Edit category / weightage</button>
                                <button type="button" class="danger" data-delete="${u.id}">Delete use-case</button>
                              </div>
                            `
                                : ''
                            }
                          </div>
                        `
                        }
                      </td>
                      <td><span class="check-code">${u.code}</span></td>
                      <td class="uc-name">${u.name}</td>
                      <td class="uc-desc">${u.description || '—'}</td>
                      <td><span class="cat-pill ${catClass}">${categoryLabel(u.riskCategory)}</span></td>
                      <td class="uc-weight">${u.weight ?? 0}%</td>
                    </tr>
                  `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
          <div class="config-weight-footer ${weightTotal === 100 ? 'is-ok' : 'is-warn'}">
            <span>Stage weightage</span>
            <strong>${weightTotal}% / 100%</strong>
            <small>${weightTotal === 100 ? 'Weights add up to 100%.' : 'Overall weightage for this stage should be 100%.'}</small>
          </div>
        </div>
      </div>
    </div>

    ${renderModalHtml(view.useCases)}
  `;

  root.innerHTML = renderShell(session, '#/config', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];
  bindConfigEvents(root, session, view.useCases);
}

function renderModalHtml(currentUseCases) {
  if (!modal) return '';

  const draft = modal.draft || defaultVersionDates();
  const step = modal.step || 'form';

  if (step === 'version-dates') {
    const summary =
      modal.type === 'delete'
        ? `Delete use-case from configuration`
        : modal.type === 'add'
          ? `Add ${draft.code || ''} ${draft.name || 'use-case'}`
          : modal.type === 'pass'
            ? `Set ${stageName(scoringTab)} pass mark to ${draft.passPct}%`
              : `Update ${draft.code || ''} ${draft.name || 'use-case'}`;
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-card modal-card-wide" onclick="event.stopPropagation()">
          <h2>Create new version</h2>
          ${versionNoticeHtml()}
          <p class="modal-copy"><strong>Change:</strong> ${summary}</p>
          ${versionDateFieldsHtml(draft)}
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="back-form-step">Back</button>
            <button type="button" class="btn btn-primary" data-action="confirm-version" ${hasCompleteVersionDates(draft) ? '' : 'disabled'}>
              Create version
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (modal.type === 'delete') {
    const uc = currentUseCases.find((u) => u.id === modal.useCaseId);
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-card modal-card-wide" onclick="event.stopPropagation()">
          <h2>Delete use-case?</h2>
          <div class="version-notice" role="status">Your changes will be saved as a new version.</div>
          <p class="modal-copy">Remove <strong>${uc?.code} ${uc?.name}</strong> from the configuration? You’ll set the new version’s start and end dates next.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="button" class="btn btn-danger" data-action="continue-version-dates">Continue</button>
          </div>
        </div>
      </div>
    `;
  }

  if (modal.type === 'pass') {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-card modal-card-wide" onclick="event.stopPropagation()">
          <h2>Save pass mark</h2>
          <div class="version-notice" role="status">Your changes will be saved as a new version.</div>
          <p class="modal-copy">${stageName(scoringTab)} will pass at ${draft.passPct}%.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="continue-version-dates">Continue</button>
          </div>
        </div>
      </div>
    `;
  }

  const isAdd = modal.type === 'add';
  const selectedDef = draft.id ? USE_CASE_LIBRARY.find((d) => d.id === Number(draft.id)) : null;
  const selectedEnabled = selectedDef ? isTenantEnabledUseCase(selectedDef) : false;
  const isLockedSelection = isAdd && selectedDef && !selectedEnabled;

  let primaryLabel = 'Continue';
  let primaryAction = 'continue-version-dates';
  let primaryDisabled = false;
  let primaryClass = 'btn btn-primary';

  if (isAdd) {
    if (!selectedDef) {
      primaryLabel = 'Add Use-Case';
      primaryDisabled = true;
    } else if (isLockedSelection) {
      primaryLabel = 'Raise a Request';
      primaryAction = 'raise-request';
      primaryClass = 'btn btn-primary btn-request';
    } else {
      primaryLabel = 'Add Use-Case';
    }
  }

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal-card modal-card-wide" onclick="event.stopPropagation()">
        <h2>${isAdd ? 'Add use-case' : 'Edit use-case'}</h2>
        ${
          isLockedSelection
            ? `<p class="modal-copy">This use-case is not enabled for your organisation. Raise a request to Azentio to enable it.</p>`
            : `<div class="version-notice" role="status">Your changes will be saved as a new version.</div>
               <p class="modal-copy">${isAdd ? 'Select an available (green) use-case and set category / weightage.' : 'Update category or weightage.'}</p>`
        }

        ${
          isAdd
            ? useCasePickerHtml(currentUseCases, draft)
            : `
        <div class="field">
          <label>Use-case</label>
          <div class="value-readonly"><span class="check-code">${draft.code}</span> ${draft.name}</div>
        </div>`
        }

        <div class="field">
          <label>Description</label>
          <textarea id="modal-desc" rows="3" readonly>${(draft.description || selectedDef?.description || '').replace(/</g, '&lt;')}</textarea>
        </div>

        ${
          isLockedSelection
            ? ''
            : `
        <div class="field-row">
          <div class="field">
            <label>Stage</label>
            <select id="modal-stage" ${isAdd && !selectedDef ? 'disabled' : ''}>
              ${CLAIM_STAGES.map((s) => `<option value="${s.id}" ${(draft.stage || selectedDef?.stage || scoringTab) === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Category</label>
            <select id="modal-category" ${isAdd && !selectedDef ? 'disabled' : ''}>
              ${RISK_CATEGORIES.map((c) => `<option value="${c.id}" ${(draft.riskCategory || selectedDef?.riskCategory || 'high') === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Weightage %</label>
            <input type="number" id="modal-weight" min="0" max="100" step="1"
              value="${draft.weight ?? selectedDef?.weight ?? 0}"
              ${isAdd && !selectedDef ? 'disabled' : ''} />
          </div>
        </div>
        `
        }

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="button" class="${primaryClass}" data-action="${primaryAction}" ${primaryDisabled ? 'disabled' : ''}>${primaryLabel}</button>
        </div>
      </div>
    </div>
  `;
}

function bindConfigEvents(root, session, currentUseCases) {
  const rerender = () => renderConfig(root, session);

  root.querySelectorAll('[data-scoring-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      scoringTab = btn.dataset.scoringTab;
      openMenuId = null;
      filters.query = '';
      rerender();
    });
  });

  root.querySelector('#uc-search')?.addEventListener('input', (e) => {
    filters.query = e.target.value;
    rerender();
  });
  root.querySelector('#filter-category')?.addEventListener('change', (e) => {
    filters.riskCategory = e.target.value;
    rerender();
  });

  root.querySelector('[data-action="toggle-prev"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    prevVersionsOpen = !prevVersionsOpen;
    openMenuId = null;
    rerender();
  });

  root.querySelectorAll('[data-view-version]').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewingVersionId = Number(btn.dataset.viewVersion);
      prevVersionsOpen = false;
      feedback = null;
      rerender();
    });
  });

  root.querySelector('[data-action="back-current"]')?.addEventListener('click', () => {
    viewingVersionId = null;
    feedback = null;
    rerender();
  });

  root.querySelector('[data-action="add-uc"]')?.addEventListener('click', () => {
    openMenuId = null;
    ucPickerOpen = false;
    modal = {
      type: 'add',
      step: 'form',
      draft: { riskCategory: 'high', weight: 0, stage: scoringTab, ...defaultVersionDates() },
    };
    rerender();
  });

  root.querySelector('[data-action="save-pass"]')?.addEventListener('click', () => {
    const raw = Number(root.querySelector('#stage-pass-pct')?.value);
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      feedback = { type: 'error', message: 'Enter a pass mark between 0 and 100.' };
      rerender();
      return;
    }
    modal = {
      type: 'pass',
      step: 'form',
      draft: { passPct: Math.round(raw), ...defaultVersionDates() },
    };
    rerender();
  });

  root.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      openMenuId = openMenuId === id ? null : id;
      prevVersionsOpen = false;
      rerender();
    });
  });

  root.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.edit);
      const uc = currentUseCases.find((u) => u.id === id);
      openMenuId = null;
      ucPickerOpen = false;
      modal = { type: 'edit', step: 'form', useCaseId: id, draft: { ...uc, ...defaultVersionDates() } };
      rerender();
    });
  });

  root.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openMenuId = null;
      ucPickerOpen = false;
      modal = {
        type: 'delete',
        step: 'form',
        useCaseId: Number(btn.dataset.delete),
        draft: defaultVersionDates(),
      };
      rerender();
    });
  });

  root.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal = null;
      ucPickerOpen = false;
      rerender();
    });
  });

  root.querySelector('[data-action="toggle-uc-picker"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    ucPickerOpen = !ucPickerOpen;
    rerender();
  });

  root.querySelectorAll('[data-pick-uc]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.pickUc);
      const def = USE_CASE_LIBRARY.find((d) => d.id === id);
      if (!def) return;
      modal.draft = {
        ...(modal.draft || {}),
        id: def.id,
        code: checkCode(def.id),
        name: def.name,
        description: def.description,
        stage: scoringTab,
        riskCategory: def.riskCategory,
        hardFail: def.hardFail,
        weight: def.weight ?? 0,
        startDate: '',
        endDate: '',
        dateError: null,
      };
      ucPickerOpen = false;
      rerender();
    });
  });

  function captureFormDraft() {
    const stage = root.querySelector('#modal-stage')?.value;
    const riskCategory = root.querySelector('#modal-category')?.value;
    const weightRaw = root.querySelector('#modal-weight')?.value;
    const weight = weightRaw === '' || weightRaw == null ? 0 : parseInt(weightRaw, 10);
    modal.draft = {
      ...(modal.draft || {}),
      stage: stage || modal.draft?.stage || scoringTab,
      riskCategory: riskCategory || modal.draft?.riskCategory,
      weight: Number.isFinite(weight) ? weight : modal.draft?.weight ?? 0,
      dateError: null,
    };
  }

  root.querySelector('[data-action="continue-version-dates"]')?.addEventListener('click', () => {
    if (modal.type === 'add') {
      const id = Number(modal.draft?.id);
      const def = USE_CASE_LIBRARY.find((d) => d.id === id);
      if (!def || !isTenantEnabledUseCase(def)) {
        feedback = { type: 'error', message: 'Select an available (green) use-case to add.' };
        rerender();
        return;
      }
      captureFormDraft();
      const w = modal.draft.weight;
      if (!Number.isFinite(w) || w < 0) {
        feedback = { type: 'error', message: 'Enter a whole-number weightage.' };
        rerender();
        return;
      }
    } else if (modal.type === 'edit') {
      captureFormDraft();
    } else if (modal.type === 'delete') {
      const uc = currentUseCases.find((u) => u.id === modal.useCaseId);
      modal.draft = {
        ...(modal.draft || defaultVersionDates()),
        code: uc?.code,
        name: uc?.name,
        dateError: null,
      };
    }
    modal.step = 'version-dates';
    ucPickerOpen = false;
    rerender();
  });

  root.querySelector('[data-action="back-form-step"]')?.addEventListener('click', () => {
    const dates = readVersionDates(root);
    modal.draft = {
      ...(modal.draft || {}),
      startDate: dates.startDate || '',
      endDate: dates.endDate || '',
      dateError: null,
    };
    modal.step = 'form';
    rerender();
  });

  const syncVersionDateDraft = () => {
    const dates = readVersionDates(root);
    modal.draft = {
      ...(modal.draft || {}),
      startDate: dates.startDate || '',
      endDate: dates.endDate || '',
      dateError: null,
    };
    const btn = root.querySelector('[data-action="confirm-version"]');
    if (btn) btn.disabled = !hasCompleteVersionDates(modal.draft);
  };

  root.querySelector('#modal-start-date')?.addEventListener('change', syncVersionDateDraft);
  root.querySelector('#modal-end-date')?.addEventListener('change', syncVersionDateDraft);
  root.querySelector('#modal-start-date')?.addEventListener('input', syncVersionDateDraft);
  root.querySelector('#modal-end-date')?.addEventListener('input', syncVersionDateDraft);

  root.querySelector('[data-action="confirm-version"]')?.addEventListener('click', () => {
    const dates = readVersionDates(root);
    const dateError = validateVersionDates(dates);
    if (dateError) {
      modal.draft = {
        ...(modal.draft || {}),
        startDate: dates.startDate || '',
        endDate: dates.endDate || '',
        dateError,
      };
      rerender();
      return;
    }

    if (modal.type === 'add') {
      const def = USE_CASE_LIBRARY.find((d) => d.id === Number(modal.draft?.id));
      if (!def || !isTenantEnabledUseCase(def)) {
        feedback = { type: 'error', message: 'Select an available (green) use-case to add.' };
        modal = null;
        rerender();
        return;
      }
      applyMutation((list) => [
        ...list,
        {
          id: def.id,
          code: checkCode(def.id),
          name: def.name,
          description: def.description,
          stage: modal.draft.stage || scoringTab || def.stage,
          riskCategory: modal.draft.riskCategory || def.riskCategory,
          hardFail: def.hardFail,
          weight: modal.draft.weight ?? def.weight ?? 0,
        },
      ], dates);
    } else if (modal.type === 'edit') {
      const id = modal.useCaseId;
      applyMutation(
        (list) =>
          list.map((u) => {
            if (u.id !== id) return u;
            return {
              ...u,
              stage: modal.draft.stage || u.stage,
              riskCategory: modal.draft.riskCategory || u.riskCategory,
              weight: modal.draft.weight ?? u.weight ?? 0,
            };
          }),
        dates
      );
    } else if (modal.type === 'delete') {
      const id = modal.useCaseId;
      applyMutation((list) => list.filter((u) => u.id !== id), dates);
    } else if (modal.type === 'pass') {
      const current = getCurrentConfigVersion();
      const nextPass = { ...DEFAULT_STAGE_PASS, ...(current.stagePassPct || {}), [scoringTab]: modal.draft.passPct };
      applyMutation((list) => list, dates, { stagePassPct: nextPass });
    }

    modal = null;
    ucPickerOpen = false;
    rerender();
  });

  root.querySelector('[data-action="raise-request"]')?.addEventListener('click', () => {
    const def = USE_CASE_LIBRARY.find((d) => d.id === Number(modal?.draft?.id));
    feedback = {
      type: 'success',
      message: def
        ? `Request raised for ${checkCode(def.id)} — ${def.name}. Azentio will follow up to enable it.`
        : 'Request raised. Azentio will follow up.',
    };
    modal = null;
    ucPickerOpen = false;
    rerender();
  });

  root.querySelector('.uc-picker-menu')?.addEventListener('click', (e) => e.stopPropagation());

  root.querySelector('.main')?.addEventListener(
    'click',
    () => {
      if (openMenuId != null || prevVersionsOpen || ucPickerOpen) {
        openMenuId = null;
        prevVersionsOpen = false;
        ucPickerOpen = false;
        rerender();
      }
    },
    { once: true }
  );
}
