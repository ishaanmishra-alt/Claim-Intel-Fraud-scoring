import {
  USE_CASE_LIBRARY,
  DEFAULT_WEIGHTS,
  DEFAULT_STAGE_PASS,
  RAW_CLAIMS,
  CLAIM_STAGES,
  checkCode,
  missingRequiredDocsForCheck,
  uploadedDocsForCheck,
  getClaimWorkflowStage,
  hasStageDocsComplete,
} from './data.js';
import { getActiveUseCases, getWeights as getStoreWeights, getStagePassPct } from './state.js';

function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function normField(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function evaluateCheckFromFields(claim, checkId, seeded) {
  switch (checkId) {
    case 1: {
      if (!claim.plate || !claim.policyPlate) return seeded;
      const match = normField(claim.plate) === normField(claim.policyPlate);
      return match
        ? { state: 'pass', evidence: `Claim plate ${claim.plate} matches policy plate ${claim.policyPlate}.` }
        : { state: 'fail', evidence: `Policy plate ${claim.policyPlate} vs claim plate ${claim.plate}` };
    }
    case 2: {
      if (!claim.vin || !claim.policyVin) return seeded;
      const match = normField(claim.vin) === normField(claim.policyVin);
      return match
        ? { state: 'pass', evidence: `VIN ${claim.vin} matches the policy chassis record.` }
        : { state: 'fail', evidence: `Policy VIN ${claim.policyVin} vs claim VIN ${claim.vin}` };
    }
    case 3: {
      if (!claim.lossDate || !claim.policyStart || !claim.policyEnd) return seeded;
      const inForce = claim.lossDate >= claim.policyStart && claim.lossDate <= claim.policyEnd;
      return inForce
        ? { state: 'pass', evidence: `Policy ${claim.policyNumber} in force on ${claim.lossDate}.` }
        : {
            state: 'fail',
            evidence: `Loss date ${claim.lossDate} is outside policy ${claim.policyNumber} (${claim.policyStart} – ${claim.policyEnd}).`,
          };
    }
    case 4: {
      if (!claim.claimant || !claim.policyholder) return seeded;
      const match = normField(claim.claimant) === normField(claim.policyholder);
      return match
        ? { state: 'pass', evidence: `${claim.claimant} matches the policyholder / endorsed driver.` }
        : {
            state: 'fail',
            evidence: `Claimant ${claim.claimant} is not the policyholder ${claim.policyholder}.`,
          };
    }
    case 5: {
      const claimSpec = [claim.vehicleMake, claim.vehicleModel, claim.vehicleColour].filter(Boolean).join(' ');
      const policySpec = [claim.policyMake, claim.policyModel, claim.policyColour].filter(Boolean).join(' ');
      if (!claimSpec || !policySpec) return seeded;
      const match =
        normField(claim.vehicleMake) === normField(claim.policyMake) &&
        normField(claim.vehicleModel) === normField(claim.policyModel) &&
        normField(claim.vehicleColour) === normField(claim.policyColour);
      return match
        ? { state: 'pass', evidence: `Vehicle ${claimSpec} matches the policy schedule.` }
        : { state: 'fail', evidence: `Policy: ${policySpec} · Claim: ${claimSpec}` };
    }
    case 6: {
      if (!claim.lossDate || !claim.policyStart) return seeded;
      const days = daysBetween(claim.policyStart, claim.lossDate);
      return days >= 14
        ? { state: 'pass', evidence: `Loss is ${days} days after policy inception.` }
        : { state: 'fail', evidence: `Loss ${days} days after policy inception (minimum cover: 14 days)` };
    }
    case 8: {
      if (!claim.lossDate || !claim.filedAt) return seeded;
      const days = daysBetween(claim.lossDate, claim.filedAt);
      return days <= 14
        ? { state: 'pass', evidence: `Reported within ${days} day${days === 1 ? '' : 's'} of loss.` }
        : { state: 'fail', evidence: `Reported ${days} days after date of loss` };
    }
    case 14: {
      if (claim.amount == null || claim.sumInsured == null) return seeded;
      return claim.amount <= claim.sumInsured
        ? { state: 'pass', evidence: `Claim ${claim.amount} is within IDV ${claim.sumInsured}.` }
        : {
            state: 'fail',
            evidence: `Claim AED ${Number(claim.amount).toLocaleString('en-US')} exceeds IDV AED ${Number(claim.sumInsured).toLocaleString('en-US')}.`,
          };
    }
    default:
      return seeded;
  }
}

function scoreBand(score) {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function isExcludedFromScore(r) {
  return r.state === 'waived' || r.state === 'bypassed';
}

function isWeightPoolRow(r) {
  return !r.hardFail && !isExcludedFromScore(r);
}

/** Remaining non-critical use-cases in a stage share 100%. Criticals are pass/fail gates. */
function attachNormalizedWeights(results) {
  CLAIM_STAGES.forEach((stage) => {
    const stageRows = results.filter((r) => r.stage === stage.id);
    const live = stageRows.filter(isWeightPoolRow);
    const total = live.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    live.forEach((r) => {
      r.configuredWeight = Number(r.weight) || 0;
      r.displayWeight = total ? Math.round((r.configuredWeight / total) * 100) : 0;
    });
    const shown = live.reduce((sum, r) => sum + r.displayWeight, 0);
    if (live.length && shown !== 100) {
      const richest = live.reduce((a, b) => (b.displayWeight >= a.displayWeight ? b : a));
      richest.displayWeight += 100 - shown;
    }
    stageRows
      .filter((r) => !isWeightPoolRow(r))
      .forEach((r) => {
        r.configuredWeight = Number(r.weight) || 0;
        r.displayWeight = 0;
      });
  });
}

function scoreWeight(r) {
  return Number(r.displayWeight ?? r.weight) || 0;
}

function scoreWeightedGroup(results) {
  const evaluable = results.filter(isWeightPoolRow);
  const passed = evaluable.filter((r) => r.state === 'pass');
  const activeWeight = evaluable.reduce((sum, r) => sum + scoreWeight(r), 0);
  const earnedWeight = passed.reduce((sum, r) => sum + scoreWeight(r), 0);

  if (activeWeight === 0) {
    return { score: 0, tier: 'red', activeWeight: 0, earnedWeight: 0, evaluable: 0 };
  }
  const score = Math.round((earnedWeight / activeWeight) * 100);
  return {
    score: Math.min(100, Math.max(0, score)),
    tier: scoreBand(score),
    activeWeight,
    earnedWeight,
    evaluable: evaluable.length,
  };
}

/**
 * Stage-based scoring using the active config use-case set.
 * Critical use-cases are pass/fail gates and do not take weightage.
 * If they pass, remaining use-cases in the stage share 100%.
 * If any critical fails, the stage is Fail and the claim does not move on.
 * There is no overall / cumulative score — claim.score is the current stage score.
 */
export function scoreClaim(claim, weights = DEFAULT_WEIGHTS, activeUseCases = null, options = {}) {
  const active = activeUseCases || getActiveUseCases();
  const activeIds = new Set(active.map((u) => u.id));
  const metaById = Object.fromEntries(active.map((u) => [u.id, u]));
  const defById = Object.fromEntries(USE_CASE_LIBRARY.map((d) => [d.id, d]));
  const passPct = options.stagePassPct || getStagePassPct();

  const waivedIds = new Set(claim.waivedCheckIds || []);
  const bypassedIds = new Set(claim.bypassedCheckIds || []);
  const dispositions = claim.dispositions || {};

  const results = claim.checks
    .filter((c) => activeIds.has(c.checkId))
    .map((c) => {
      const def = defById[c.checkId];
      const meta = metaById[c.checkId];
      const hardFail = !!(meta?.hardFail ?? def.hardFail) || (meta?.riskCategory || def.riskCategory) === 'critical';
      const evaluated = evaluateCheckFromFields(claim, c.checkId, { state: c.state, evidence: c.evidence });
      let state = evaluated.state === 'cant_evaluate' ? 'fail' : evaluated.state;
      let evidence = evaluated.evidence;
      if (bypassedIds.has(c.checkId)) {
        state = 'bypassed';
        evidence = `${evaluated.evidence} · Bypassed — excluded from this stage. Remaining weights are normalised to 100%.`;
      } else if (waivedIds.has(c.checkId)) {
        state = 'waived';
        evidence = `${evaluated.evidence} · Waived as a false positive — data already correct.`;
      } else {
        const missingDocs = missingRequiredDocsForCheck(claim, c.checkId);
        if (missingDocs.length && state !== 'fail') {
          state = 'fail';
          evidence = `Failed — required document missing: ${missingDocs.map((d) => d.name).join(', ')}.`;
        } else {
          const onFile = uploadedDocsForCheck(claim, c.checkId);
          if (onFile.length && !/Document on file:/i.test(evidence)) {
            evidence = `${evidence} · Document on file: ${onFile.map((d) => d.name).join(', ')}.`;
          }
        }
      }
      const disposition = dispositions[c.checkId] || null;
      const weight = hardFail ? 0 : Number(weights[c.checkId] ?? meta?.weight ?? def.weight ?? 0);
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
        weight,
        waived: state === 'waived',
        bypassed: state === 'bypassed',
        disposition,
      };
    });

  attachNormalizedWeights(results);

  const stageScores = [];
  let heldAtStage = null;
  let holdReason = null;

  for (const stage of CLAIM_STAGES) {
    const stageResults = results.filter((r) => r.stage === stage.id);
    const stageHardFails = stageResults.filter((r) => r.hardFail && r.state === 'fail');
    const weighted = scoreWeightedGroup(stageResults);
    const criticalFailed = stageHardFails.length > 0;
    const score = criticalFailed ? 0 : weighted.evaluable === 0 ? 100 : weighted.score;
    const mark = Number(passPct[stage.id] ?? DEFAULT_STAGE_PASS[stage.id] ?? 70);
    const passedStage = !criticalFailed && score >= mark;
    const row = {
      stageId: stage.id,
      stageName: stage.name,
      score,
      tier: criticalFailed ? 'red' : !passedStage ? 'red' : scoreBand(score),
      activeWeight: weighted.activeWeight,
      earnedWeight: weighted.earnedWeight,
      evaluable: weighted.evaluable,
      hardFailCount: stageHardFails.length,
      softFailCount: stageResults.filter((r) => !r.hardFail && r.state === 'fail').length,
      failCount: stageResults.filter((r) => r.state === 'fail').length,
      cantEvaluateCount: 0,
      checkCount: stageResults.length,
      passMark: mark,
      passed: passedStage,
      criticalFailed,
    };
    if (stageResults.length > 0) stageScores.push(row);

    if (criticalFailed) {
      heldAtStage = stage.id;
      holdReason = 'critical';
      break;
    }
    if (!hasStageDocsComplete(claim, stage.id)) {
      heldAtStage = stage.id;
      holdReason = 'docs';
      break;
    }
    if (stage.id === 'assessment' && !claim.surveyorSubmitted) {
      heldAtStage = stage.id;
      holdReason = 'surveyor';
      break;
    }
  }

  const scoredStageIds = new Set(stageScores.map((s) => s.stageId));
  const visibleResults = results.filter((r) => scoredStageIds.has(r.stage));
  const hardFails = visibleResults.filter((r) => r.hardFail && r.state === 'fail');
  const scored = visibleResults.filter((r) => !isExcludedFromScore(r));
  const failed = scored.filter((r) => r.state === 'fail');
  const passed = scored.filter((r) => r.state === 'pass');

  const workflowStage = getClaimWorkflowStage(claim, stageScores);
  const currentStage = stageScores.find((s) => s.stageId === workflowStage) || stageScores[0] || null;
  const contextScore = currentStage ? currentStage.score : 0;
  const forcedRed = (currentStage?.hardFailCount || 0) > 0;
  const tier = currentStage?.tier || (forcedRed ? 'red' : scoreBand(contextScore));

  return {
    score: contextScore,
    tier,
    forcedRed,
    hasOverride: waivedIds.size > 0 || bypassedIds.size > 0,
    hardFails,
    results: visibleResults,
    stageScores,
    workflowStage,
    heldAtStage,
    holdReason,
    summary: {
      hardFailCount: hardFails.length,
      softFailCount: failed.filter((r) => !r.hardFail).length,
      softPassCount: passed.filter((r) => !r.hardFail).length,
      failCount: failed.length,
      passCount: passed.length,
      softTotal: scored.filter((r) => !r.hardFail).length,
      cantEvaluateCount: 0,
    },
  };
}

export function scoreAllClaims(weights, activeUseCases) {
  const w = weights || getStoreWeights();
  const active = activeUseCases || getActiveUseCases();
  const stagePassPct = getStagePassPct();
  return RAW_CLAIMS.map((claim) => {
    const scored = scoreClaim(claim, w, active, { stagePassPct });
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
      if (r.state === 'waived' || r.state === 'bypassed') return;
      row.total += 1;
      if (r.state === 'fail' || r.state === 'cant_evaluate') row.fail += 1;
      else if (r.state === 'pass') row.pass += 1;
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

export function tierLabel(tier, extra) {
  if (extra?.forcedRed || extra?.criticalFailed) return 'Fail';
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
  if (!iso) return '—';
  const raw = String(iso).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  const yyyy = d.getFullYear();
  return `${dd}-${mon}-${yyyy}`;
}

export function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

export function formatStageScore(stage) {
  if (!stage) return '—';
  if (stage.criticalFailed) return 'Fail';
  return formatScore(stage.score);
}

export function formatClaimScore(claim) {
  if (!claim) return '—';
  if (claim.forcedRed) return 'Fail';
  const current = (claim.stageScores || []).find((s) => s.stageId === claim.workflowStage);
  if (current?.criticalFailed) return 'Fail';
  return formatScore(claim.score);
}

export function formatClaimAmount(claim) {
  if (!claim || getClaimWorkflowStage(claim) !== 'settlement') return '—';
  return formatAED(claim.amount);
}

export function sortChecksForDisplay(results) {
  const stageOrder = Object.fromEntries(CLAIM_STAGES.map((s, i) => [s.id, i]));
  const rank = (r) => {
    if (r.state === 'fail' && r.hardFail) return 0;
    if (r.state === 'fail' || r.state === 'cant_evaluate') return 1;
    if (r.state === 'waived' || r.state === 'bypassed') return 3;
    return 2;
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
  const scoredRows = results.filter((r) => r.state !== 'waived' && r.state !== 'bypassed');
  const last = stageIds[stageIds.length - 1] || scored.workflowStage;
  const currentStage = stageScores.find((s) => s.stageId === last) || stageScores[0] || null;
  const contextScore = currentStage ? currentStage.score : 0;
  const forcedRed = (currentStage?.hardFailCount || 0) > 0;
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
      softFailCount: scoredRows.filter((r) => !r.hardFail && r.state === 'fail').length,
      softPassCount: scoredRows.filter((r) => !r.hardFail && r.state === 'pass').length,
      failCount: scoredRows.filter((r) => r.state === 'fail').length,
      passCount: scoredRows.filter((r) => r.state === 'pass').length,
      softTotal: scoredRows.filter((r) => !r.hardFail).length,
      cantEvaluateCount: 0,
    },
  };
}

export { checkCode, DEFAULT_STAGE_PASS };
