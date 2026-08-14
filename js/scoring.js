import {
  USE_CASE_LIBRARY,
  DEFAULT_WEIGHTS,
  RAW_CLAIMS,
  CLAIM_STAGES,
  checkCode,
  missingRequiredDocsForCheck,
  uploadedDocsForCheck,
} from './data.js';
import { getActiveUseCases, getWeights as getStoreWeights } from './state.js';

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
 * Stage-based scoring using the active config use-case set.
 */
export function scoreClaim(claim, weights = DEFAULT_WEIGHTS, activeUseCases = null) {
  const active = activeUseCases || getActiveUseCases();
  const activeIds = new Set(active.map((u) => u.id));
  const metaById = Object.fromEntries(active.map((u) => [u.id, u]));
  const defById = Object.fromEntries(USE_CASE_LIBRARY.map((d) => [d.id, d]));

  const results = claim.checks
    .filter((c) => activeIds.has(c.checkId))
    .map((c) => {
      const def = defById[c.checkId];
      const meta = metaById[c.checkId];
      const hardFail = meta?.hardFail ?? def.hardFail;
      let state = c.state;
      let evidence = c.evidence;
      const missingDocs = missingRequiredDocsForCheck(claim, c.checkId);
      if (missingDocs.length && state !== 'fail') {
        state = 'cant_evaluate';
        evidence = `Cannot evaluate — required document missing: ${missingDocs.map((d) => d.name).join(', ')}.`;
      } else {
        const onFile = uploadedDocsForCheck(claim, c.checkId);
        if (onFile.length && !/Document on file:/i.test(evidence)) {
          evidence = `${evidence} · Document on file: ${onFile.map((d) => d.name).join(', ')}.`;
        }
      }
      return {
        ...c,
        state,
        evidence,
        name: meta?.name || def.name,
        code: meta?.code || checkCode(def.id),
        description: meta?.description || def.description,
        category: def.category,
        stage: meta?.stage || def.stage,
        riskCategory: meta?.riskCategory || def.riskCategory,
        hardFail,
        weight: hardFail ? null : weights[c.checkId] ?? meta?.weight ?? def.weight,
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
  }).filter((s) => s.checkCount > 0);

  // Keep stages with only can't-evaluate soft checks in the average (score 6)
  // so missing documents cannot hide a stage and make the claim look like Pass.
  const stagesForAverage = stageScores.filter((s) => s.activeWeight > 0 || s.cantEvaluateCount > 0);
  let contextScore;
  if (stagesForAverage.length === 0) {
    contextScore = 6;
  } else {
    contextScore = Math.round(
      stagesForAverage.reduce((sum, s) => sum + s.score, 0) / stagesForAverage.length
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

export function scoreAllClaims(weights, activeUseCases) {
  const w = weights || getStoreWeights();
  const active = activeUseCases || getActiveUseCases();
  return RAW_CLAIMS.map((claim) => {
    const scored = scoreClaim(claim, w, active);
    return { ...claim, ...scored };
  });
}

/** Aggregate fail counts per use-case across a claim set */
export function useCaseFailStats(claims) {
  const active = getActiveUseCases();
  const defById = Object.fromEntries(USE_CASE_LIBRARY.map((d) => [d.id, d]));
  const stats = active.map((def) => ({
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
    queue: ['claim_user', 'claim_head', 'admin', 'fiu', 'surveyor'],
    claim: ['claim_user', 'claim_head', 'admin', 'fiu', 'surveyor'],
    dashboard: ['claim_head', 'admin', 'fiu'],
    report: ['claim_head', 'admin', 'fiu'],
    config: ['admin', 'fiu'],
  };
  return (matrix[feature] || []).includes(role);
}

export function homeRouteForRole(role) {
  if (role === 'admin' || role === 'fiu') return '#/dashboard';
  return '#/queue';
}

/** Restrict a scored claim to selected stages (surveyor sees prior-stage scores until submit). */
export function withVisibleStages(scored, stageIds) {
  const idSet = new Set(stageIds);
  const results = (scored.results || []).filter((r) => idSet.has(r.stage));
  const stageScores = (scored.stageScores || []).filter((s) => idSet.has(s.stageId));
  const hardFails = results.filter((r) => r.hardFail && r.state === 'fail');
  const soft = results.filter((r) => !r.hardFail);
  const stagesForAverage = stageScores.filter((s) => s.activeWeight > 0 || s.cantEvaluateCount > 0);
  let contextScore = 6;
  if (stagesForAverage.length) {
    contextScore = Math.round(stagesForAverage.reduce((sum, s) => sum + s.score, 0) / stagesForAverage.length);
  }
  const forcedRed = hardFails.length > 0;
  return {
    ...scored,
    results,
    stageScores,
    hardFails,
    score: contextScore,
    tier: forcedRed ? 'red' : scoreBand(contextScore),
    forcedRed,
    summary: {
      hardFailCount: hardFails.length,
      softFailCount: soft.filter((r) => r.state === 'fail').length,
      softPassCount: soft.filter((r) => r.state === 'pass').length,
      softTotal: soft.length,
      cantEvaluateCount: soft.filter((r) => r.state === 'cant_evaluate').length,
    },
  };
}

export { checkCode };
