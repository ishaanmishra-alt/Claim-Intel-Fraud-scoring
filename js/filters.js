import { getClaimWorkflowStage, WORKFLOW_STAGES, getClaimAuditLog, getPendingExceptions } from './data.js';
import { formatAED, formatDate } from './scoring.js';

/** Prototype “today” for Dashboard and Report (not the config version date). */
export const PROTOTYPE_TODAY = '2026-08-11';

export const PERIOD_PRESETS = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'custom', label: 'Custom' },
];

export const CLAIM_TYPE_OPTIONS = [
  { id: 'all', label: 'All types' },
  { id: 'own_damage', label: 'Own damage' },
  { id: 'tp', label: 'Third party' },
  { id: 'theft', label: 'Theft' },
  { id: 'total_loss', label: 'Total loss' },
];

export const LEDGER_CHANGE_TYPES = ['Score', 'Document', 'Exception', 'Stage', 'Assignment', 'Review'];

const TX_MAX_DAYS = 31;
const TX_LIST_CAP = 10;

export function claimTypeLabel(id) {
  return CLAIM_TYPE_OPTIONS.find((t) => t.id === id)?.label || id || '—';
}

export function periodLabel(period) {
  return PERIOD_PRESETS.find((p) => p.id === period)?.label || 'Selected period';
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso) {
  return `${iso.slice(0, 8)}01`;
}

function startOfQuarter(iso) {
  const month = Number(iso.slice(5, 7));
  const qStart = month <= 3 ? '01' : month <= 6 ? '04' : month <= 9 ? '07' : '10';
  return `${iso.slice(0, 4)}-${qStart}-01`;
}

export function daysInclusive(from, to) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function resolvePeriodRange(period, { from, to, today = PROTOTYPE_TODAY } = {}) {
  if (period === 'custom' && from && to) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (period === 'yesterday') {
    const y = addDays(today, -1);
    return { from: y, to: y };
  }
  if (period === '7') return { from: addDays(today, -6), to: today };
  if (period === '30') return { from: addDays(today, -29), to: today };
  if (period === 'mtd') return { from: startOfMonth(today), to: today };
  if (period === 'quarter') return { from: startOfQuarter(today), to: today };
  return { from: addDays(today, -6), to: today };
}

export function formatRangeLabel(range) {
  if (!range?.from || !range?.to) return '';
  if (range.from === range.to) return formatDate(range.from);
  return `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

export function filterClaimUniverse(claims, filters = {}) {
  const {
    period = '7',
    branch = 'All branches',
    claimType = 'all',
    stage = 'all',
    tier = 'all',
    from,
    to,
  } = filters;
  const range = resolvePeriodRange(period, { from, to });
  return claims.filter((c) => {
    if (!c.filedAt || c.filedAt < range.from || c.filedAt > range.to) return false;
    if (branch && branch !== 'All branches' && c.branch !== branch) return false;
    if (claimType && claimType !== 'all' && c.claimType !== claimType) return false;
    if (stage && stage !== 'all' && getClaimWorkflowStage(c) !== stage) return false;
    if (tier === 'red' || tier === 'high') {
      if (c.tier !== 'red') return false;
    }
    return true;
  });
}

export function describeClaimScope(claims, filters = {}, { includeValue = false } = {}) {
  const range = resolvePeriodRange(filters.period, { from: filters.from, to: filters.to });
  const period = filters.period === 'custom' ? formatRangeLabel(range) : periodLabel(filters.period);
  const branch = filters.branch && filters.branch !== 'All branches' ? filters.branch : 'All branches';
  const parts = [`${claims.length} claim${claims.length === 1 ? '' : 's'} scored`, period, branch];
  if (includeValue) {
    const value = claims.reduce((sum, c) => sum + (c.amount || 0), 0);
    parts.push(formatAED(value));
  }
  if (filters.claimType && filters.claimType !== 'all') parts.push(claimTypeLabel(filters.claimType));
  if (filters.stage && filters.stage !== 'all') {
    const name = WORKFLOW_STAGES.find((s) => s.id === filters.stage)?.name || filters.stage;
    parts.push(name);
  }
  if (filters.tier === 'red' || filters.tier === 'high') parts.push('High risk');
  return parts.join(' · ');
}

export function snapshotMetrics(claims) {
  const count = claims.length;
  const value = claims.reduce((sum, c) => sum + (c.amount || 0), 0);
  const red = claims.filter((c) => c.tier === 'red');
  const failed = claims.filter((c) => (c.summary?.failCount || c.summary?.softFailCount || 0) > 0);
  const hardFails = claims.reduce((n, c) => n + (c.hardFails?.length || 0), 0);
  const waived = claims.reduce((n, c) => n + (c.waivedCheckIds?.length || 0), 0);
  const pending = claims.reduce((n, c) => n + getPendingExceptions(c).length, 0);
  return {
    count,
    value,
    redCount: red.length,
    redValue: red.reduce((sum, c) => sum + (c.amount || 0), 0),
    highRiskRate: count ? Math.round((red.length / count) * 100) : 0,
    failCount: failed.length,
    failRate: count ? Math.round((failed.length / count) * 100) : 0,
    cantEvalCount: 0,
    cantEvalRate: 0,
    hardFails,
    waived,
    pending,
  };
}

export function ledgerChangeType(row) {
  const raw = row.changeType || '';
  if (raw === 'Upload' || row.entity === 'Document') return 'Document';
  if (raw === 'Status' || row.entity === 'Stage') return 'Stage';
  if (raw === 'Score') return 'Score';
  if (raw === 'Exception') return 'Exception';
  if (raw === 'Assignment') return 'Assignment';
  if (raw === 'Review') return 'Review';
  return raw || 'Update';
}

export function formatLedgerDelta(row) {
  const field = row.field && row.field !== '—' ? row.field : row.action || 'Change';
  const oldV = row.oldValue ?? '—';
  const newV = row.newValue ?? '—';
  if (oldV === '—' && newV !== '—') return `${field} ${newV}`;
  if (newV === '—' && oldV !== '—') return `${field} ${oldV}`;
  return `${field} ${oldV} → ${newV}`;
}

export function flattenClaimLedger(claims) {
  const rows = [];
  claims.forEach((claim) => {
    getClaimAuditLog(claim).forEach((entry) => {
      rows.push({
        ...entry,
        claimId: claim.id,
        fnolNumber: claim.fnolNumber || claim.id.replace(/^CLM-/, 'FNOL-'),
        policyNumber: claim.policyNumber || '—',
        score: claim.score,
        workflowStage: getClaimWorkflowStage(claim),
        workflowStageName: WORKFLOW_STAGES.find((s) => s.id === getClaimWorkflowStage(claim))?.name || getClaimWorkflowStage(claim),
        ledgerType: ledgerChangeType(entry),
        delta: formatLedgerDelta(entry),
      });
    });
  });
  return rows;
}

function inRange(iso, range) {
  return iso && range?.from && range?.to && iso >= range.from && iso <= range.to;
}

export function filterLedgerRows(rows, { range, changeType = 'all', user = 'all' } = {}) {
  let list = rows.filter((r) => inRange(r.date, range));
  list.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const seenScore = new Set();
  list = list.filter((r) => {
    if (r.ledgerType !== 'Score') return true;
    if (seenScore.has(r.claimId)) return false;
    seenScore.add(r.claimId);
    return true;
  });
  if (changeType && changeType !== 'all') list = list.filter((r) => r.ledgerType === changeType);
  if (user && user !== 'all') list = list.filter((r) => r.user === user);
  return list;
}

export function ledgerRangeState(range) {
  if (!range?.from || !range?.to) return { ok: false, reason: 'set-dates', days: 0 };
  const days = daysInclusive(range.from, range.to);
  if (days > TX_MAX_DAYS) return { ok: false, reason: 'too-wide', days };
  return { ok: true, reason: '', days };
}

export function capLedgerRows(rows, cap = TX_LIST_CAP) {
  return { shown: rows.slice(0, cap), total: rows.length, cap };
}

export { WORKFLOW_STAGES, TX_MAX_DAYS, TX_LIST_CAP };
