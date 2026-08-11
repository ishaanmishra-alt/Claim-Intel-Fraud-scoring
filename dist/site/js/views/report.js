import { renderShell } from '../components.js';
import { ROLE_LABELS } from '../data.js';
import { formatAED, formatDate, tierLabel, canAccess } from '../scoring.js';

export function renderReport(root, session, claims) {
  if (!canAccess(session.role, 'report')) {
    location.hash = '#/queue';
    return;
  }

  const byTier = {
    red: claims.filter((c) => c.tier === 'red'),
    yellow: claims.filter((c) => c.tier === 'yellow'),
    green: claims.filter((c) => c.tier === 'green'),
  };

  const rows = [...claims].sort((a, b) => {
    const rank = { red: 0, yellow: 1, green: 2 };
    return rank[a.tier] - rank[b.tier] || a.score - b.score;
  });

  const content = `
    <div class="page-header">
      <div>
        <h1>Detailed report</h1>
        <p class="page-subtitle">Scored portfolio snapshot · ${formatDate('2026-08-11')}</p>
      </div>
    </div>

    <div class="tier-strip">
      <div class="tier-stat"><span class="dot red"></span><strong>${byTier.red.length}</strong> High risk · ${formatAED(byTier.red.reduce((s, c) => s + c.amount, 0))}</div>
      <div class="tier-stat"><span class="dot yellow"></span><strong>${byTier.yellow.length}</strong> Unverified · ${formatAED(byTier.yellow.reduce((s, c) => s + c.amount, 0))}</div>
      <div class="tier-stat"><span class="dot green"></span><strong>${byTier.green.length}</strong> Pass · ${formatAED(byTier.green.reduce((s, c) => s + c.amount, 0))}</div>
    </div>

    <div class="panel" style="padding:0;overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
        <thead>
          <tr style="background:var(--surface-muted);text-align:left">
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Claim</th>
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Claimant</th>
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Branch</th>
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Amount</th>
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Score</th>
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Tier</th>
            <th style="padding:12px 16px;border-bottom:1px solid var(--border)">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (c) => `
            <tr>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border)"><a href="#/claim/${c.id}" style="color:var(--accent);font-weight:600">${c.id}</a></td>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border)">${c.claimant}</td>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border)">${c.branch}</td>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border)">${formatAED(c.amount)}</td>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border);font-family:var(--mono);font-weight:600">${c.score}</td>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border)" class="claim-tier ${c.tier}">${tierLabel(c.tier)}</td>
              <td style="padding:10px 16px;border-bottom:1px solid var(--border);color:var(--text-muted)">
                ${c.forcedRed ? 'Critical fail override' : c.summary.cantEvaluateCount ? `${c.summary.cantEvaluateCount} can't evaluate` : '—'}
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  root.innerHTML = renderShell(session, '#/report', content);
  root.querySelector('[data-role-label]').textContent = ROLE_LABELS[session.role];
}
