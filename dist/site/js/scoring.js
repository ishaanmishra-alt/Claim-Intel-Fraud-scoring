import { CHECK_DEFINITIONS, DEFAULT_WEIGHTS, RAW_CLAIMS } from './data.js';

/**
 * Score a claim given current soft-signal weights.
 * Hard fails force tier red but context score is still computed.
 */
export function scoreClaim(claim, weights = DEFAULT_WEIGHTS) {
  const defById = Object.fromEntries(CHECK_DEFINITIONS.map((d) => [d.id, d]));
  const results = claim.checks.map((c) => {
    const def = defById[c.checkId];
    return {
      ...c,
      name: def.name,
      category: def.category,
      hardFail: def.hardFail,
      weight: def.hardFail ? null : weights[c.checkId] ?? def.weight,
    };
  });

  const hardFails = results.filter((r) => r.hardFail && r.state === 'fail');
  const soft = results.filter((r) => !r.hardFail);
  const evaluable = soft.filter((r) => r.state !== 'cant_evaluate');
  const passedSoft = evaluable.filter((r) => r.state === 'pass');
  const failedSoft = evaluable.filter((r) => r.state === 'fail');
  const cantEval = soft.filter((r) => r.state === 'cant_evaluate');

  const activeWeight = evaluable.reduce((sum, r) => sum + (r.weight || 0), 0);
  const earnedWeight = passedSoft.reduce((sum, r) => sum + (r.weight || 0), 0);

  // Map weighted pass ratio to 0–10. If nothing evaluable → mid unverified band.
  let contextScore;
  if (activeWeight === 0) {
    contextScore = 6;
  } else {
    contextScore = Math.round(((earnedWeight / activeWeight) * 10) * 10) / 10;
    // Keep one decimal max but display as number; snap to sensible range
    contextScore = Math.min(10, Math.max(0, Math.round(contextScore * 10) / 10));
    // Prefer whole/half for UI clarity
    contextScore = Math.round(contextScore);
  }

  let softTier;
  if (activeWeight === 0 || cantEval.length > 0 && failedSoft.length === 0 && passedSoft.length < soft.length * 0.5) {
    // Heavy can't-evaluate without fails → unverified leaning
    softTier = contextScore >= 8 ? 'green' : contextScore >= 5 ? 'yellow' : 'red';
    if (activeWeight === 0) softTier = 'yellow';
  } else if (contextScore >= 8) softTier = 'green';
  else if (contextScore >= 5) softTier = 'yellow';
  else softTier = 'red';

  const forcedRed = hardFails.length > 0;
  const tier = forcedRed ? 'red' : softTier;

  return {
    score: contextScore,
    tier,
    forcedRed,
    hardFails,
    results,
    summary: {
      hardFailCount: hardFails.length,
      softFailCount: failedSoft.length,
      softPassCount: passedSoft.length,
      softTotal: soft.length,
      cantEvaluateCount: cantEval.length,
      earnedWeight,
      activeWeight,
    },
  };
}

export function scoreAllClaims(weights = DEFAULT_WEIGHTS) {
  return RAW_CLAIMS.map((claim) => {
    const scored = scoreClaim(claim, weights);
    return { ...claim, ...scored };
  });
}

export function tierLabel(tier) {
  if (tier === 'red') return 'High risk';
  if (tier === 'yellow') return 'Medium risk';
  return 'Pass';
}

export function formatAED(amount) {
  return (
    'AED ' +
    Number(amount).toLocaleString('en-AE', {
      maximumFractionDigits: 0,
    })
  );
}

export function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mon}-${yy}`;
}

/** Sort checks: hard fails first, then soft fails by weight desc, then cant_eval, then pass */
export function sortChecksForDisplay(results) {
  const rank = (r) => {
    if (r.state === 'fail' && r.hardFail) return 0;
    if (r.state === 'fail') return 1;
    if (r.state === 'cant_evaluate') return 2;
    return 3;
  };
  return [...results].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 1) return (b.weight || 0) - (a.weight || 0);
    return a.checkId - b.checkId;
  });
}

export function canAccess(role, feature) {
  const matrix = {
    queue: ['claim_user', 'claim_head', 'admin'],
    claim: ['claim_user', 'claim_head', 'admin'],
    dashboard: ['claim_head', 'admin'],
    report: ['claim_head', 'admin'],
    config: ['admin'],
  };
  return (matrix[feature] || []).includes(role);
}

export function homeRouteForRole(role) {
  if (role === 'admin') return '#/dashboard';
  return '#/queue';
}
