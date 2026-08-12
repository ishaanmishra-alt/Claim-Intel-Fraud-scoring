import { CHECK_DEFINITIONS, DEFAULT_WEIGHTS, RAW_CLAIMS, CLAIM_STAGES, checkCode } from './data.js';

function scoreBand(score) {
  if (score >= 8) return 'green';
  if (score >= 5) return 'yellow';
  return 'red';
}

function scoreSoftGroup(softResults) {
  const evaluable = softResults.filter((r) => r.state !== 'cant_evaluate');
  const passed = evaluable.filter((r) => r.state === 'pass');
  const activeWeight = evaluable.reduce((sum, r) => sum + (r.weight || 0), 0);
  const earnedWeight = passed.reduce((sum, r) => sum + (r.weight || 0), 0);

  if (activeWeight === 0) {
    return { score: 6, tier: 'yellow', activeWeight: 0, earnedWeight: 0, evaluable: 0 };
  }
  const score = Math.round((earnedWeight / activeWeight) * 10);
  return {
    score: Math.min(10, Math.max(0, score)),
    tier: scoreBand(score),
    activeWeight,
    earnedWeight,
    evaluable: evaluable.length,
  };
}

/**
 * Stage-based scoring: each stage's soft weights sum to 100%.
 * Overall context score = average of evaluable stage scores.
 * Any hard-fail fail forces Red.
 */
export function scoreClaim(claim, weights = DEFAULT_WEIGHTS) {
  const defById = Object.fromEntries(CHECK_DEFINITIONS.map((d) => [d.id, d]));
  const results = claim.checks.map((c) => {
    const def = defById[c.checkId];
    return {
      ...c,
      name: def.name,
      code: def.code || checkCode(def.id),
      category: def.category,
      stage: def.stage,
      hardFail: def.hardFail,
      weight: def.hardFail ? null : weights[c.checkId] ?? def.weight,
    };
  });

  const hardFails = results.filter((r) => r.hardFail && r.state === 'fail');
  const soft = results.filter((r) => !r.hardFail);
  const failedSoft = soft.filter((r) => r.state === 'fail');
  const passedSoft = soft.filter((r) => r.state === 'pass');
  const cantEval = soft.filter((r) => r.state === 'cant_evaluate');

  const stageScores = CLAIM_STAGES.map((stage) => {
    const stageResults = results.filter((r) => r.stage === stage.id);
    const stageSoft = stageResults.filter((r) => !r.hardFail);
    const stageHardFails = stageResults.filter((r) => r.hardFail && r.state === 'fail');
    const scored = scoreSoftGroup(stageSoft);
    return {
      stageId: stage.id,
      stageName: stage.name,
      ...scored,
      hardFailCount: stageHardFails.length,
      softFailCount: stageSoft.filter((r) => r.state === 'fail').length,
      cantEvaluateCount: stageSoft.filter((r) => r.state === 'cant_evaluate').length,
      checkCount: stageResults.length,
    };
  });

  const evaluableStages = stageScores.filter((s) => s.activeWeight > 0);
  let contextScore;
  if (evaluableStages.length === 0) {
    contextScore = 6;
  } else {
    contextScore = Math.round(
      evaluableStages.reduce((sum, s) => sum + s.score, 0) / evaluableStages.length
    );
  }

  const softTier = scoreBand(contextScore);
  const forcedRed = hardFails.length > 0;
  const tier = forcedRed ? 'red' : softTier;

  return {
    score: contextScore,
    tier,
    forcedRed,
    hardFails,
    results,
    stageScores,
    summary: {
      hardFailCount: hardFails.length,
      softFailCount: failedSoft.length,
      softPassCount: passedSoft.length,
      softTotal: soft.length,
      cantEvaluateCount: cantEval.length,
    },
  };
}

export function scoreAllClaims(weights = DEFAULT_WEIGHTS) {
  return RAW_CLAIMS.map((claim) => {
    const scored = scoreClaim(claim, weights);
    return { ...claim, ...scored };
  });
}

/** Aggregate fail counts per use-case across a claim set */
export function useCaseFailStats(claims) {
  const defById = Object.fromEntries(CHECK_DEFINITIONS.map((d) => [d.id, d]));
  const stats = CHECK_DEFINITIONS.map((def) => ({
    checkId: def.id,
    code: checkCode(def.id),
    name: def.name,
    stage: def.stage,
    hardFail: def.hardFail,
    fail: 0,
    pass: 0,
    cant_evaluate: 0,
    total: 0,
  }));
  const byId = Object.fromEntries(stats.map((s) => [s.checkId, s]));

  claims.forEach((claim) => {
    claim.results.forEach((r) => {
      const row = byId[r.checkId];
      if (!row) return;
      row.total += 1;
      row[r.state] += 1;
    });
  });

  return stats
    .map((s) => ({
      ...s,
      stageName: CLAIM_STAGES.find((st) => st.id === s.stage)?.name || s.stage,
      failRate: s.total ? Math.round((s.fail / s.total) * 100) : 0,
      category: defById[s.checkId]?.category,
    }))
    .sort((a, b) => b.fail - a.fail || b.failRate - a.failRate);
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

export function sortChecksForDisplay(results) {
  const stageOrder = Object.fromEntries(CLAIM_STAGES.map((s, i) => [s.id, i]));
  const rank = (r) => {
    if (r.state === 'fail' && r.hardFail) return 0;
    if (r.state === 'fail') return 1;
    if (r.state === 'cant_evaluate') return 2;
    return 3;
  };
  return [...results].sort((a, b) => {
    const sa = stageOrder[a.stage] ?? 99;
    const sb = stageOrder[b.stage] ?? 99;
    if (sa !== sb) return sa - sb;
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

export { checkCode };
