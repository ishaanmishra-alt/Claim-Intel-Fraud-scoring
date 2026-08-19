import { iconClose } from './components.js';
import {
  getClaimVersions,
  findClaimVersion,
  useCaseScoresForVersion,
  formatClaimRef,
  stageDisplayName,
} from './data.js';
import { formatAED, formatClaimAmount, formatDate, formatClaimScore, formatStageScore } from './scoring.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stateLabel(state) {
  if (state === 'pass') return 'Pass';
  if (state === 'fail') return 'Fail';
  if (state === 'bypassed') return 'Bypassed';
  if (state === 'waived') return 'Waived';
  return state || '—';
}

export function versionTableHtml(claim, { emptyMessage = 'No version history recorded for this claim.' } = {}) {
  const rows = getClaimVersions(claim);
  if (!rows.length) {
    return `<div class="claim-audit-empty">${esc(emptyMessage)}</div>`;
  }
  return `
    <div class="claim-audit-head">
      <strong>Claim versions</strong>
      <span>${rows.length} version${rows.length === 1 ? '' : 's'}</span>
    </div>
    <div class="claim-audit-scroll">
      <table class="claim-audit-table version-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>FNOL no.</th>
            <th>Registration no.</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td class="mono">
                <button type="button" class="version-link" data-open-version="${esc(claim.id)}" data-version="${esc(r.version)}">${esc(r.version)}</button>
              </td>
              <td class="mono">${esc(r.fnolNumber)}</td>
              <td class="mono">${esc(r.registrationNo)}</td>
              <td>${esc(formatDate(r.date))}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function versionPopupHtml(claim, versionId) {
  const version = findClaimVersion(claim, versionId);
  if (!claim || !version) return '';
  const scores = useCaseScoresForVersion(claim, version);
  const stageName = stageDisplayName(version.stage);
  const changes = version.changes?.length
    ? version.changes
    : [{ field: version.field, oldValue: version.oldValue, newValue: version.newValue }];

  return `
    <div class="modal-backdrop version-modal-backdrop" data-action="close-version-modal">
      <div class="modal-card modal-card-version" role="dialog" aria-modal="true" aria-labelledby="version-modal-title" onclick="event.stopPropagation()">
        <div class="version-modal-head">
          <div>
            <p class="version-modal-kicker">${esc(version.version)} · ${esc(formatDate(version.date))}</p>
            <h2 id="version-modal-title">${esc(formatClaimRef(claim))}</h2>
          </div>
          <button type="button" class="icon-btn" data-action="close-version-modal" aria-label="Close">${iconClose()}</button>
        </div>

        <section class="version-modal-section">
          <h3>Claim details</h3>
          <dl class="version-detail-grid">
            <div><dt>Registration no.</dt><dd class="mono">${esc(version.registrationNo || claim.id)}</dd></div>
            <div><dt>FNOL no.</dt><dd class="mono">${esc(version.fnolNumber || claim.fnolNumber)}</dd></div>
            <div><dt>Claimant</dt><dd>${esc(claim.claimant)}</dd></div>
            <div><dt>Vehicle</dt><dd>${esc(claim.vehicle)}</dd></div>
            <div><dt>Stage at this version</dt><dd>${esc(stageName)}</dd></div>
            <div><dt>Stage score</dt><dd class="mono">${
              version.stage && (claim.stageScores || []).find((s) => s.stageId === version.stage)
                ? formatStageScore((claim.stageScores || []).find((s) => s.stageId === version.stage))
                : formatClaimScore(claim)
            }</dd></div>
            <div><dt>Amount</dt><dd>${formatClaimAmount(claim) === '—' ? formatAED(claim.amount) : formatClaimAmount(claim)}</dd></div>
            <div><dt>Branch</dt><dd>${esc(claim.branch)}</dd></div>
          </dl>
        </section>

        <section class="version-modal-section">
          <h3>Who made the change</h3>
          <p class="version-modal-copy"><strong>${esc(version.user)}</strong> · ${esc(version.action || 'Updated')} · ${esc(formatDate(version.date))} ${esc(version.time || '')}</p>
        </section>

        <section class="version-modal-section">
          <h3>What changed</h3>
          <p class="version-modal-copy">${esc(version.summary || version.comments || '—')}</p>
          <table class="version-change-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Old value</th>
                <th>New value</th>
              </tr>
            </thead>
            <tbody>
              ${changes
                .map(
                  (c) => `
                <tr>
                  <td>${esc(c.field || '—')}</td>
                  <td>${esc(c.oldValue ?? '—')}</td>
                  <td>${esc(c.newValue ?? '—')}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </section>

        <section class="version-modal-section">
          <h3>Use-case scoring</h3>
          <p class="version-modal-copy">UC results for stages up to ${esc(stageName)} at this version.</p>
          <div class="version-uc-scroll">
            <table class="version-change-table">
              <thead>
                <tr>
                  <th>Use-case</th>
                  <th>Name</th>
                  <th>Result</th>
                  <th>Weight</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                ${
                  scores.length
                    ? scores
                        .map(
                          (r) => `
                  <tr>
                    <td class="mono">${esc(r.code)}</td>
                    <td>${esc(r.name)}${r.hardFail ? ' <span class="tag critical">Critical</span>' : ''}</td>
                    <td><span class="audit-status is-${esc(r.state)}">${esc(stateLabel(r.state))}</span></td>
                    <td class="mono">${r.hardFail ? 'Pass / fail' : `${Number(r.weight) || 0}%`}</td>
                    <td>${esc(r.stageName)}</td>
                  </tr>`
                        )
                        .join('')
                    : `<tr><td colspan="5">No use-cases scored at this version.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `;
}

export function bindVersionPopup(root, claims, onChange, stateKey = 'versionKey') {
  const close = () => onChange({ [stateKey]: null });
  root.querySelectorAll('[data-open-version]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onChange({ [stateKey]: `${btn.dataset.openVersion}|${btn.dataset.version}` });
    });
  });
  root.querySelectorAll('[data-action="close-version-modal"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  });
}

export function parseVersionKey(key) {
  if (!key) return null;
  const idx = String(key).indexOf('|');
  if (idx < 0) return null;
  return { claimId: key.slice(0, idx), version: key.slice(idx + 1) };
}

export function renderOpenVersionPopup(claims, versionKey) {
  const parsed = parseVersionKey(versionKey);
  if (!parsed) return '';
  const claim = claims.find((c) => c.id === parsed.claimId);
  if (!claim) return '';
  return versionPopupHtml(claim, parsed.version);
}
