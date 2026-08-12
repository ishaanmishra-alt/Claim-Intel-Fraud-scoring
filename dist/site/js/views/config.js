import { renderShell } from '../components.js';
import {
  ROLE_LABELS,
  CHECK_DEFINITIONS,
  CLAIM_STAGES,
  RISK_CATEGORIES,
  checkCode,
} from '../data.js';
import { canAccess } from '../scoring.js';
import {
  getConfigStore,
  getCurrentConfigVersion,
  getConfigVersionById,
  commitConfigChange,
  formatVersionLabel,
} from '../state.js';

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

/** @type {{ stage: string, riskCategory: string, query: string }} */
let filters = { stage: 'all', riskCategory: 'all', query: '' };
/** @type {number|null} viewing historical version id */
let viewingVersionId = null;
let openMenuId = null;
let modal = null; // { type: 'add'|'edit'|'delete', useCaseId?, draft? }
let prevVersionsOpen = false;
let feedback = null;

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
    if (filters.stage !== 'all' && u.stage !== filters.stage) return false;
    if (filters.riskCategory !== 'all' && u.riskCategory !== filters.riskCategory) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const blob = `${u.code} ${u.name} ${u.description}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function applyMutation(mutator) {
  const store = getConfigStore();
  const current = getCurrentConfigVersion(store);
  const next = mutator(cloneUseCases(current.useCases));
  commitConfigChange(next);
  viewingVersionId = null;
  feedback = { type: 'success', message: 'New version created.' };
}

function cloneUseCases(list) {
  return list.map((u) => ({ ...u }));
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

  const content = `
    <div class="page-header config-page-header">
      <div>
        <h1>Configuration</h1>
        <p class="page-subtitle">Manage use-cases, categories, and stage weightage</p>
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

    <div class="config-table-card">
      <div class="config-table-filters">
        <div class="filter-group">
          <label>Search</label>
          <input type="search" id="uc-search" placeholder="Search use-cases…" value="${filters.query.replace(/"/g, '&quot;')}" />
        </div>
        <div class="filter-group">
          <label>Stage ${iconFilter()}</label>
          <select id="filter-stage">
            <option value="all">All stages</option>
            ${CLAIM_STAGES.map((s) => `<option value="${s.id}" ${filters.stage === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
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
              <th>Stage</th>
              <th>Category</th>
              <th>Weightage</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `<tr><td colspan="7" class="empty-cell">No use-cases match the current filters.</td></tr>`
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
                  <td>${stageName(u.stage)}</td>
                  <td><span class="cat-pill ${catClass}">${categoryLabel(u.riskCategory)}</span></td>
                  <td class="uc-weight">${u.hardFail ? '—' : `${u.weight ?? 0}%`}</td>
                </tr>
              `;
                    })
                    .join('')
            }
          </tbody>
        </table>
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

  if (modal.type === 'delete') {
    const uc = currentUseCases.find((u) => u.id === modal.useCaseId);
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-card" onclick="event.stopPropagation()">
          <h2>Delete use-case?</h2>
          <p class="modal-copy">Remove <strong>${uc?.code} ${uc?.name}</strong> from the configuration? This will create a new version.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="button" class="btn btn-danger" data-action="confirm-delete">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  const isAdd = modal.type === 'add';
  const draft = modal.draft || {};
  const available = isAdd
    ? CHECK_DEFINITIONS.filter((d) => !currentUseCases.some((u) => u.id === d.id))
    : CHECK_DEFINITIONS;

  const selectedDef = CHECK_DEFINITIONS.find((d) => d.id === Number(draft.id));
  const isCriticalHard = selectedDef?.hardFail || draft.hardFail;

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal-card modal-card-wide" onclick="event.stopPropagation()">
        <h2>${isAdd ? 'Add use-case' : 'Edit use-case'}</h2>
        <p class="modal-copy">${isAdd ? 'Select a use-case and set category / weightage. Saving creates a new version.' : 'Update category or weightage. Saving creates a new version.'}</p>

        <div class="field">
          <label>Use-case</label>
          ${
            isAdd
              ? `<select id="modal-uc-id">
                  <option value="">Select use-case…</option>
                  ${available
                    .map(
                      (d) =>
                        `<option value="${d.id}" ${Number(draft.id) === d.id ? 'selected' : ''}>${checkCode(d.id)} — ${d.name}</option>`
                    )
                    .join('')}
                </select>`
              : `<div class="value-readonly"><span class="check-code">${draft.code}</span> ${draft.name}</div>`
          }
        </div>

        <div class="field">
          <label>Description</label>
          <textarea id="modal-desc" rows="3" readonly>${(draft.description || selectedDef?.description || '').replace(/</g, '&lt;')}</textarea>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Stage</label>
            <select id="modal-stage" ${isAdd && !selectedDef ? '' : ''}>
              ${CLAIM_STAGES.map((s) => `<option value="${s.id}" ${(draft.stage || selectedDef?.stage) === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Category</label>
            <select id="modal-category">
              ${RISK_CATEGORIES.map((c) => `<option value="${c.id}" ${(draft.riskCategory || selectedDef?.riskCategory || 'high') === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Weightage %</label>
            <input type="number" id="modal-weight" min="0" max="100" step="1"
              value="${isCriticalHard ? '' : draft.weight ?? selectedDef?.weight ?? 0}"
              ${isCriticalHard ? 'disabled placeholder="N/A for hard-fail"' : ''} />
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="button" class="btn btn-primary" data-action="save-modal">${isAdd ? 'Add use-case' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  `;
}

function bindConfigEvents(root, session, currentUseCases) {
  const rerender = () => renderConfig(root, session);

  root.querySelector('#uc-search')?.addEventListener('input', (e) => {
    filters.query = e.target.value;
    rerender();
  });
  root.querySelector('#filter-stage')?.addEventListener('change', (e) => {
    filters.stage = e.target.value;
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
    modal = { type: 'add', draft: { riskCategory: 'high', weight: 0, stage: 'fnol' } };
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
      modal = { type: 'edit', useCaseId: id, draft: { ...uc } };
      rerender();
    });
  });

  root.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openMenuId = null;
      modal = { type: 'delete', useCaseId: Number(btn.dataset.delete) };
      rerender();
    });
  });

  root.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal = null;
      rerender();
    });
  });

  root.querySelector('[data-action="confirm-delete"]')?.addEventListener('click', () => {
    const id = modal.useCaseId;
    applyMutation((list) => list.filter((u) => u.id !== id));
    modal = null;
    rerender();
  });

  const ucSelect = root.querySelector('#modal-uc-id');
  ucSelect?.addEventListener('change', () => {
    const id = Number(ucSelect.value);
    const def = CHECK_DEFINITIONS.find((d) => d.id === id);
    if (!def) return;
    modal.draft = {
      id: def.id,
      code: checkCode(def.id),
      name: def.name,
      description: def.description,
      stage: def.stage,
      riskCategory: def.riskCategory,
      hardFail: def.hardFail,
      weight: def.hardFail ? null : def.weight,
    };
    rerender();
  });

  root.querySelector('[data-action="save-modal"]')?.addEventListener('click', () => {
    const stage = root.querySelector('#modal-stage')?.value;
    const riskCategory = root.querySelector('#modal-category')?.value;
    const weightRaw = root.querySelector('#modal-weight')?.value;
    const weight = weightRaw === '' || weightRaw == null ? null : parseInt(weightRaw, 10);

    if (modal.type === 'add') {
      const id = Number(root.querySelector('#modal-uc-id')?.value);
      const def = CHECK_DEFINITIONS.find((d) => d.id === id);
      if (!def) {
        feedback = { type: 'error', message: 'Select a use-case to add.' };
        rerender();
        return;
      }
      if (!def.hardFail && (!Number.isFinite(weight) || weight < 0)) {
        feedback = { type: 'error', message: 'Enter a whole-number weightage.' };
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
          stage: stage || def.stage,
          riskCategory: riskCategory || def.riskCategory,
          hardFail: def.hardFail,
          weight: def.hardFail ? null : weight,
        },
      ]);
    } else if (modal.type === 'edit') {
      const id = modal.useCaseId;
      applyMutation((list) =>
        list.map((u) => {
          if (u.id !== id) return u;
          return {
            ...u,
            stage: stage || u.stage,
            riskCategory: riskCategory || u.riskCategory,
            weight: u.hardFail ? null : Number.isFinite(weight) ? weight : u.weight,
          };
        })
      );
    }
    modal = null;
    rerender();
  });

  // close menus on outside click
  root.querySelector('.main')?.addEventListener(
    'click',
    () => {
      if (openMenuId != null || prevVersionsOpen) {
        openMenuId = null;
        prevVersionsOpen = false;
        rerender();
      }
    },
    { once: true }
  );
}
