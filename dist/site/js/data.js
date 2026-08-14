/** @typedef {'pass'|'fail'|'cant_evaluate'|'waived'} CheckState */
/** @typedef {'red'|'yellow'|'green'} RiskTier */
/** @typedef {'claim_user'|'claim_head'|'admin'|'fiu'|'surveyor'} Role */
/** @typedef {'fnol'|'intimation'|'assessment'|'settlement'} ClaimStage */

export const CLAIM_STAGES = [
  { id: 'fnol', name: 'FNOL', description: 'First notice of loss & intake' },
  { id: 'intimation', name: 'Intimation', description: 'Claim intimation & cover checks' },
  { id: 'assessment', name: 'Assessment', description: 'Repair, garage & damage assessment' },
  { id: 'settlement', name: 'Settlement', description: 'Financial & settlement signals' },
];

export const RISK_CATEGORIES = [
  { id: 'critical', name: 'Critical' },
  { id: 'high', name: 'High' },
  { id: 'low', name: 'Low' },
];

export const CHECK_CATEGORIES = {
  identity: 'Identity & policy integrity',
  timing: 'Timing anomalies',
  garage: 'Repair & garage patterns',
  financial: 'Financial & value signals',
  behavioural: 'Behavioural & history signals',
};

/**
 * 20 use-cases grouped by claim stage.
 * Soft weights sum to 100% within each stage (hard fails have no weight).
 * riskCategory: Critical / High / Low (config table).
 */
export const CHECK_DEFINITIONS = [
  // FNOL — soft: 55 + 45 = 100
  { id: 1, code: '01', name: 'Plate number: policy vs claim', description: 'Verifies the vehicle plate on the claim matches the plate on the active policy.', category: 'identity', stage: 'fnol', hardFail: true, riskCategory: 'critical', weight: null },
  { id: 2, code: '02', name: 'VIN / chassis number: policy vs claim', description: 'Compares VIN/chassis between policy and claim records for identity mismatch.', category: 'identity', stage: 'fnol', hardFail: true, riskCategory: 'critical', weight: null },
  { id: 3, code: '03', name: 'Policy active on date of loss', description: 'Confirms the policy was in force on the reported date of loss.', category: 'identity', stage: 'fnol', hardFail: true, riskCategory: 'critical', weight: null },
  { id: 4, code: '04', name: 'Claimant is the policyholder (or endorsed driver)', description: 'Checks the claimant/driver is the policyholder or an endorsed driver.', category: 'identity', stage: 'fnol', hardFail: true, riskCategory: 'critical', weight: null },
  { id: 8, code: '08', name: 'Delay between date of loss and reporting is normal', description: 'Flags unusually long gaps between loss date and FNOL reporting.', category: 'timing', stage: 'fnol', hardFail: false, riskCategory: 'high', weight: 55 },
  { id: 20, code: '20', name: 'Location of loss consistent with registered/usual area', description: 'Assesses whether loss location aligns with the vehicle’s usual operating area.', category: 'behavioural', stage: 'fnol', hardFail: false, riskCategory: 'low', weight: 45 },

  // Intimation — soft: 25+30+20+25 = 100
  { id: 5, code: '05', name: 'Vehicle make / model / colour: policy vs claim', description: 'Matches claimed vehicle attributes to the policy schedule.', category: 'identity', stage: 'intimation', hardFail: false, riskCategory: 'high', weight: 25 },
  { id: 6, code: '06', name: 'Loss occurred after a minimum cover period', description: 'Detects losses occurring too soon after policy inception.', category: 'timing', stage: 'intimation', hardFail: false, riskCategory: 'high', weight: 30 },
  { id: 7, code: '07', name: 'Loss not immediately before policy expiry', description: 'Flags losses clustered just before policy expiry/renewal.', category: 'timing', stage: 'intimation', hardFail: false, riskCategory: 'low', weight: 20 },
  { id: 9, code: '09', name: 'Loss date is not on a recently-added endorsement', description: 'Checks if loss coincides with a newly added cover endorsement.', category: 'timing', stage: 'intimation', hardFail: false, riskCategory: 'high', weight: 25 },
  { id: 16, code: '16', name: 'No duplicate claim for the same incident/date', description: 'Detects duplicate claims for the same incident or loss date.', category: 'financial', stage: 'intimation', hardFail: true, riskCategory: 'critical', weight: null },

  // Assessment — soft: 25+30+25+20 = 100
  { id: 10, code: '10', name: 'Garage is network / auto-assigned', description: 'Prefers network or auto-assigned garages over self-selected workshops.', category: 'garage', stage: 'assessment', hardFail: false, riskCategory: 'high', weight: 25 },
  { id: 11, code: '11', name: 'Garage not on an internal watchlist', description: 'Screens the repairer against the internal garage watchlist.', category: 'garage', stage: 'assessment', hardFail: false, riskCategory: 'high', weight: 30 },
  { id: 12, code: '12', name: 'Repair estimate within normal range for damage type', description: 'Benchmarks the estimate against peer ranges for the damage type.', category: 'garage', stage: 'assessment', hardFail: false, riskCategory: 'high', weight: 25 },
  { id: 13, code: '13', name: 'Parts claimed consistent with reported damage', description: 'Validates that claimed parts align with reported damage evidence.', category: 'garage', stage: 'assessment', hardFail: false, riskCategory: 'low', weight: 20 },

  // Settlement — soft: 30+20+25+25 = 100
  { id: 14, code: '14', name: 'Claim amount within sum-insured / IDV limit', description: 'Ensures claim amount does not exceed sum insured / IDV.', category: 'financial', stage: 'settlement', hardFail: true, riskCategory: 'critical', weight: null },
  { id: 15, code: '15', name: 'Claim amount vs claimant\'s historical average', description: 'Compares claim amount to the claimant’s historical average claim size.', category: 'financial', stage: 'settlement', hardFail: false, riskCategory: 'high', weight: 30 },
  { id: 17, code: '17', name: 'Salvage / total-loss value consistent with claim', description: 'Checks salvage or total-loss values for consistency with the claim.', category: 'financial', stage: 'settlement', hardFail: false, riskCategory: 'low', weight: 20 },
  { id: 18, code: '18', name: 'Claim frequency in last 12 months within normal range', description: 'Reviews claim frequency for the claimant/vehicle over 12 months.', category: 'behavioural', stage: 'settlement', hardFail: false, riskCategory: 'high', weight: 25 },
  { id: 19, code: '19', name: 'No prior rejected/flagged claim on same vehicle or claimant', description: 'Surfaces prior rejected or flagged claims on the same vehicle or claimant.', category: 'behavioural', stage: 'settlement', hardFail: false, riskCategory: 'high', weight: 25 },
];

/**
 * Extra catalog entries for Add Use-Case.
 * tenantEnabled=true  → green / can add now
 * tenantEnabled=false → grey / Raise a Request
 */
export const OPTIONAL_USE_CASES = [
  {
    id: 21,
    code: '21',
    name: 'Police report number present when required',
    description: 'Confirms a police report reference is captured when the loss type requires one.',
    category: 'identity',
    stage: 'fnol',
    hardFail: false,
    riskCategory: 'high',
    weight: 15,
    tenantEnabled: false,
  },
  {
    id: 22,
    code: '22',
    name: 'Driver licence class matches vehicle category',
    description: 'Validates that the reported driver’s licence class covers the insured vehicle category.',
    category: 'identity',
    stage: 'fnol',
    hardFail: true,
    riskCategory: 'critical',
    weight: null,
    tenantEnabled: false,
  },
  {
    id: 23,
    code: '23',
    name: 'Third-party details complete for TP claims',
    description: 'Checks that counterparty name, contact, and vehicle identifiers are present on third-party claims.',
    category: 'identity',
    stage: 'intimation',
    hardFail: false,
    riskCategory: 'high',
    weight: 20,
    tenantEnabled: false,
  },
  {
    id: 24,
    code: '24',
    name: 'Surveyor assigned within SLA',
    description: 'Flags assessment cases where surveyor assignment exceeds the configured SLA window.',
    category: 'timing',
    stage: 'assessment',
    hardFail: false,
    riskCategory: 'low',
    weight: 15,
    tenantEnabled: false,
  },
  {
    id: 25,
    code: '25',
    name: 'Labour hours consistent with repair scope',
    description: 'Compares billed labour hours against expected ranges for the approved repair scope.',
    category: 'garage',
    stage: 'assessment',
    hardFail: false,
    riskCategory: 'high',
    weight: 20,
    tenantEnabled: false,
  },
  {
    id: 26,
    code: '26',
    name: 'Payee bank details match claimant / nominated payee',
    description: 'Verifies settlement payee account details against the claimant or nominated payee on file.',
    category: 'financial',
    stage: 'settlement',
    hardFail: true,
    riskCategory: 'critical',
    weight: null,
    tenantEnabled: false,
  },
  {
    id: 27,
    code: '27',
    name: 'No duplicate open claim for same loss event',
    description: 'Detects another open claim sharing the same loss date, vehicle, and broadly similar narrative.',
    category: 'behavioural',
    stage: 'settlement',
    hardFail: false,
    riskCategory: 'high',
    weight: 25,
    tenantEnabled: false,
  },
  {
    id: 28,
    code: '28',
    name: 'Photos / documents uploaded before assessment close',
    description: 'Ensures required photos and supporting documents are on file before assessment is closed.',
    category: 'garage',
    stage: 'assessment',
    hardFail: false,
    riskCategory: 'low',
    weight: 10,
    tenantEnabled: false,
  },
  {
    id: 29,
    code: '29',
    name: 'Telematics / dashcam corroboration of loss',
    description: 'Cross-checks reported loss timing and severity against telematics or dashcam feeds when available.',
    category: 'behavioural',
    stage: 'fnol',
    hardFail: false,
    riskCategory: 'high',
    weight: 20,
    tenantEnabled: false,
  },
  {
    id: 30,
    code: '30',
    name: 'Workshop invoice OCR vs estimate match',
    description: 'Compares OCR’d workshop invoice lines against the approved estimate for material variances.',
    category: 'garage',
    stage: 'settlement',
    hardFail: false,
    riskCategory: 'high',
    weight: 20,
    tenantEnabled: false,
  },
];

/** Full catalog for Add Use-Case picker and scoring metadata lookups.
 * Only #01–#10 are enabled for the tenant; #11–#20 (+ extras) are grey / request-only.
 */
export const USE_CASE_LIBRARY = [
  ...CHECK_DEFINITIONS.map((d) => ({ ...d, tenantEnabled: d.id >= 1 && d.id <= 10 })),
  ...OPTIONAL_USE_CASES.map((d) => ({ ...d, tenantEnabled: false })),
];

export function isTenantEnabledUseCase(def) {
  return def?.tenantEnabled === true;
}

/** Use-cases seeded into the active configuration table (#01–#10 only). */
export function enabledSeedDefinitions() {
  return CHECK_DEFINITIONS.filter((d) => d.id >= 1 && d.id <= 10);
}

export const DEFAULT_WEIGHTS = Object.fromEntries(
  enabledSeedDefinitions()
    .filter((c) => !c.hardFail)
    .map((c) => {
      // Sole soft checks in their stage after #11–#20 are removed from seed
      let weight = c.weight;
      if (c.id === 8 || c.id === 10) weight = 100;
      return [c.id, weight];
    })
);

export function checkCode(id) {
  return `#${String(id).padStart(2, '0')}`;
}

export const USERS = [
  {
    username: 'claim.user',
    password: 'demo123',
    role: /** @type {Role} */ ('claim_user'),
    name: 'Fatima Al-Najjar',
    initials: 'FN',
    id: 'u-fatima',
  },
  {
    username: 'claim.head',
    password: 'demo123',
    role: /** @type {Role} */ ('claim_head'),
    name: 'Khalid Al-Mansouri',
    initials: 'KM',
    id: 'u-khalid',
  },
  {
    username: 'admin',
    password: 'demo123',
    role: /** @type {Role} */ ('admin'),
    name: 'Sara Al-Harbi',
    initials: 'SH',
    id: 'u-sara',
  },
  {
    username: 'fiu',
    password: 'demo123',
    role: /** @type {Role} */ ('fiu'),
    name: 'Noura Al-Qahtani',
    initials: 'NQ',
    id: 'u-noura',
  },
  {
    username: 'surveyor',
    password: 'demo123',
    role: /** @type {Role} */ ('surveyor'),
    name: 'Hassan Al-Falasi',
    initials: 'HF',
    id: 'u-hassan',
  },
];

export const ROLE_LABELS = {
  claim_user: 'Claim User',
  claim_head: 'Claim Head',
  admin: 'Admin',
  fiu: 'FIU',
  surveyor: 'Surveyor',
};

const CLAIM_AUDIT_ROLES = new Set(['claim_head', 'admin', 'fiu']);

export function canViewClaimAudit(role) {
  return CLAIM_AUDIT_ROLES.has(role);
}

export const BRANCHES = ['All branches', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Riyadh', 'Jeddah'];

/** Display label for claim-detail stage blocks (id stays assessment). */
export function stageDisplayName(stageId) {
  if (stageId === 'assessment') return 'Surveyor';
  return CLAIM_STAGES.find((s) => s.id === stageId)?.name || stageId;
}

/**
 * Stage document catalog (GCC motor). Conditionals use claimType / towed.
 * required: required | optional | conditional
 */
export const DOCUMENT_CATALOG = [
  {
    id: 'fnol-licence',
    stage: 'fnol',
    name: 'Driver licence',
    kind: 'either',
    required: 'required',
    condition: null,
    linkedCheckIds: [4, 22],
    minCount: 1,
    why: 'Confirms the reported driver is licensed and matches the claimant or an endorsed driver.',
  },
  {
    id: 'fnol-mulkiya',
    stage: 'fnol',
    name: 'Mulkiya / vehicle registration',
    kind: 'either',
    required: 'required',
    condition: null,
    linkedCheckIds: [1, 2, 5],
    minCount: 1,
    why: 'Matches plate, VIN and vehicle description to the policy schedule.',
  },
  {
    id: 'fnol-nid',
    stage: 'fnol',
    name: 'National ID / Emirates ID',
    kind: 'either',
    required: 'required',
    condition: null,
    linkedCheckIds: [4],
    minCount: 1,
    why: 'Verifies claimant identity against the policyholder record.',
  },
  {
    id: 'fnol-scene-photos',
    stage: 'fnol',
    name: 'Accident-scene photo set',
    kind: 'image',
    required: 'required',
    condition: null,
    linkedCheckIds: [1, 5, 20],
    minCount: 5,
    why: 'Needs at least 5 photos with the plate in frame to corroborate location, damage and vehicle identity.',
  },
  {
    id: 'fnol-police',
    stage: 'fnol',
    name: 'Police report',
    kind: 'pdf',
    required: 'conditional',
    condition: 'police',
    linkedCheckIds: [21],
    minCount: 1,
    why: 'Required when the loss type needs a police reference (third-party or theft).',
  },
  {
    id: 'fnol-dashcam',
    stage: 'fnol',
    name: 'Dashcam / telematics clip',
    kind: 'either',
    required: 'optional',
    condition: null,
    linkedCheckIds: [29],
    minCount: 1,
    why: 'Optional corroboration of loss timing and severity when a clip is available.',
  },
  {
    id: 'int-estimate',
    stage: 'intimation',
    name: 'Garage estimate',
    kind: 'pdf',
    required: 'required',
    condition: null,
    linkedCheckIds: [10, 12],
    minCount: 1,
    why: 'Lets us benchmark repair cost and confirm the nominated workshop’s scope.',
  },
  {
    id: 'int-nomination',
    stage: 'intimation',
    name: 'Garage nomination',
    kind: 'pdf',
    required: 'required',
    condition: null,
    linkedCheckIds: [10],
    minCount: 1,
    why: 'Shows whether the repairer is network / auto-assigned or claimant-selected.',
  },
  {
    id: 'int-tp-pack',
    stage: 'intimation',
    name: 'Third-party pack',
    kind: 'pdf',
    required: 'conditional',
    condition: 'tp',
    linkedCheckIds: [23],
    minCount: 1,
    why: 'Counterparty name, contact and vehicle identifiers for third-party claims.',
  },
  {
    id: 'int-towing',
    stage: 'intimation',
    name: 'Towing receipt',
    kind: 'either',
    required: 'conditional',
    condition: 'towed',
    linkedCheckIds: [10],
    minCount: 1,
    why: 'Supports recovery cost and the workshop that received the vehicle.',
  },
  {
    id: 'ass-surveyor',
    stage: 'assessment',
    name: 'Surveyor report',
    kind: 'pdf',
    required: 'required',
    condition: null,
    linkedCheckIds: [10, 12, 13],
    minCount: 1,
    why: 'Independent assessment of damage, liability and repair versus total loss.',
  },
  {
    id: 'ass-prerepair',
    stage: 'assessment',
    name: 'Pre-repair photos',
    kind: 'image',
    required: 'required',
    condition: null,
    linkedCheckIds: [13, 28],
    minCount: 3,
    carryFrom: 'fnol-scene-photos',
    why: 'Records damage before repair. Scene photos already on file can satisfy this.',
  },
  {
    id: 'ass-parts',
    stage: 'assessment',
    name: 'Parts list',
    kind: 'pdf',
    required: 'required',
    condition: null,
    linkedCheckIds: [13],
    minCount: 1,
    why: 'Checks claimed parts against reported damage and the surveyor scope.',
  },
  {
    id: 'ass-salvage-photos',
    stage: 'assessment',
    name: 'Salvage / total-loss photos',
    kind: 'image',
    required: 'conditional',
    condition: 'total_loss',
    linkedCheckIds: [17],
    minCount: 3,
    why: 'Evidences residual value when the vehicle is declared total loss.',
  },
  {
    id: 'set-invoice',
    stage: 'settlement',
    name: 'Final invoice',
    kind: 'pdf',
    required: 'required',
    condition: null,
    linkedCheckIds: [14, 15, 30],
    minCount: 1,
    why: 'Settlement amount must match the approved repair or total-loss figure.',
  },
  {
    id: 'set-completion',
    stage: 'settlement',
    name: 'Completion photos',
    kind: 'image',
    required: 'required',
    condition: null,
    linkedCheckIds: [28],
    minCount: 3,
    why: 'Confirms repairs were completed as approved before discharge.',
  },
  {
    id: 'set-discharge',
    stage: 'settlement',
    name: 'Discharge voucher',
    kind: 'pdf',
    required: 'required',
    condition: null,
    linkedCheckIds: [14],
    minCount: 1,
    why: 'Claimant acknowledgement required before funds are released.',
  },
  {
    id: 'set-iban',
    stage: 'settlement',
    name: 'IBAN / payee proof',
    kind: 'either',
    required: 'required',
    condition: null,
    linkedCheckIds: [26],
    minCount: 1,
    why: 'Payee account must match the claimant or nominated payee on file.',
  },
  {
    id: 'set-salvage-papers',
    stage: 'settlement',
    name: 'Salvage handover papers',
    kind: 'pdf',
    required: 'conditional',
    condition: 'total_loss',
    linkedCheckIds: [17],
    minCount: 1,
    why: 'Transfers salvage title when a total-loss settlement is paid.',
  },
];

export function documentApplies(claim, def) {
  if (!def) return false;
  const type = claim.claimType || 'own_damage';
  if (!def.condition) return true;
  if (def.condition === 'tp') return type === 'tp';
  if (def.condition === 'theft') return type === 'theft';
  if (def.condition === 'total_loss') return type === 'total_loss';
  if (def.condition === 'towed') return !!claim.towed;
  if (def.condition === 'police') return type === 'tp' || type === 'theft';
  return true;
}

function emptyDocRecord() {
  return { status: 'missing', filename: null, thumb: null, note: '', count: 0 };
}

export function getDocRecord(claim, docId) {
  return claim.documents?.[docId] || emptyDocRecord();
}

function countMeetsMin(def, rec) {
  return (rec.count || 0) >= (def.minCount || 1);
}

export function isDocumentSatisfied(claim, def) {
  if (!def) return false;
  const rec = getDocRecord(claim, def.id);
  if (rec.status === 'waived') return true;
  if (rec.status === 'uploaded' && countMeetsMin(def, rec)) return true;
  if (def.carryFrom) {
    const prior = DOCUMENT_CATALOG.find((d) => d.id === def.carryFrom);
    if (prior && isDocumentSatisfied(claim, prior) && rec.status !== 'rejected') return true;
  }
  return false;
}

/** Required or applicable-conditional docs still outstanding for a check. */
export function missingRequiredDocsForCheck(claim, checkId) {
  return DOCUMENT_CATALOG.filter((def) => {
    if (!def.linkedCheckIds?.includes(checkId)) return false;
    if (def.required === 'optional') return false;
    if (!documentApplies(claim, def)) return false;
    return !isDocumentSatisfied(claim, def);
  });
}

export function uploadedDocsForCheck(claim, checkId) {
  return DOCUMENT_CATALOG.filter((def) => {
    if (!def.linkedCheckIds?.includes(checkId)) return false;
    if (!documentApplies(claim, def)) return false;
    const rec = getDocRecord(claim, def.id);
    return rec.status === 'uploaded' && countMeetsMin(def, rec);
  });
}

export function getStageDocumentRows(claim, stageId) {
  return DOCUMENT_CATALOG.filter((def) => def.stage === stageId && documentApplies(claim, def)).map((def) => {
    const rec = getDocRecord(claim, def.id);
    const prior = def.carryFrom ? DOCUMENT_CATALOG.find((d) => d.id === def.carryFrom) : null;
    const carried =
      prior &&
      isDocumentSatisfied(claim, prior) &&
      rec.status !== 'uploaded' &&
      rec.status !== 'rejected' &&
      rec.status !== 'waived';
    return {
      def,
      rec,
      displayStatus: carried ? 'already_on_file' : rec.status,
      alreadyOnFile: !!carried,
    };
  });
}

export function getStageDocCompleteness(claim, stageId) {
  const rows = getStageDocumentRows(claim, stageId).filter((row) => row.def.required !== 'optional');
  const done = rows.filter((row) => isDocumentSatisfied(claim, row.def)).length;
  return { done, total: rows.length };
}

export function hasStageDocsComplete(claim, stageId) {
  const { done, total } = getStageDocCompleteness(claim, stageId);
  return total === 0 || done === total;
}

export function hasPassedPriorStages(claim, stageIds) {
  return stageIds.every((id) => hasStageDocsComplete(claim, id));
}

/** Claims that cleared FNOL + Intimation and are waiting on surveyor submit. */
export function isReadyForSurveyor(claim) {
  return hasPassedPriorStages(claim, ['fnol', 'intimation']) && !claim.surveyorSubmitted;
}

/** Current workflow stage for queue column / filters. */
export function getClaimWorkflowStage(claim) {
  if (!hasStageDocsComplete(claim, 'fnol')) return 'fnol';
  if (!hasStageDocsComplete(claim, 'intimation')) return 'intimation';
  if (!claim.surveyorSubmitted || !hasStageDocsComplete(claim, 'assessment')) return 'assessment';
  return 'settlement';
}

export const WORKFLOW_STAGES = [
  { id: 'fnol', name: 'FNOL' },
  { id: 'intimation', name: 'Intimation' },
  { id: 'assessment', name: 'Surveyor' },
  { id: 'settlement', name: 'Settlement' },
];

export function submitSurveyorAssessment(claimId) {
  const claim = RAW_CLAIMS.find((c) => c.id === claimId);
  if (!claim) return { ok: false, message: 'Claim not found.' };
  if (!hasStageDocsComplete(claim, 'assessment')) {
    return { ok: false, message: 'Upload all required Surveyor documents before submitting.' };
  }
  claim.surveyorSubmitted = true;
  appendClaimAudit(claimId, {
    user: 'Hassan Al-Falasi',
    action: 'Submitted',
    changeType: 'Status',
    entity: 'Stage',
    field: 'Claim stage',
    oldValue: 'Surveyor',
    newValue: 'Settlement',
    comments: 'Surveyor documents submitted for further scoring.',
  });
  return { ok: true, message: 'Submitted for further scoring. This claim has moved to the next stage.' };
}

const AWAITING_SURVEYOR_IDS = new Set([
  'CLM-2026-08428',
  'CLM-2026-08448',
  'CLM-2026-08419',
  'CLM-2026-08358',
  'CLM-2026-08401',
]);

const MISSING_SURVEYOR_DOCS = {
  'ass-surveyor': {
    status: 'missing',
    filename: null,
    thumb: null,
    note: 'Awaiting surveyor report.',
    count: 0,
  },
  'ass-parts': {
    status: 'missing',
    filename: null,
    thumb: null,
    note: 'Parts list not uploaded by surveyor.',
    count: 0,
  },
};

function defaultUploadedRecord(def) {
  const pdf = def.kind === 'pdf';
  const count = def.minCount || 1;
  return {
    status: 'uploaded',
    filename: pdf ? `${def.id}.pdf` : `${def.id}-01.jpg`,
    thumb: pdf ? 'PDF' : count > 1 ? `${count} photos` : 'Photo',
    note: 'On file from intake.',
    count,
  };
}

function seedDocuments(claim, overrides = {}) {
  const docs = {};
  DOCUMENT_CATALOG.forEach((def) => {
    if (!documentApplies(claim, def)) return;
    if (overrides[def.id]) {
      docs[def.id] = { ...emptyDocRecord(), ...overrides[def.id] };
      return;
    }
    if (def.required === 'optional') {
      docs[def.id] = {
        ...emptyDocRecord(),
        note: 'Not provided.',
      };
      return;
    }
    if (def.carryFrom) {
      docs[def.id] = emptyDocRecord();
      return;
    }
    docs[def.id] = defaultUploadedRecord(def);
  });
  return docs;
}

export function mockUploadClaimDocument(claimId, docId, actor) {
  const claim = RAW_CLAIMS.find((c) => c.id === claimId);
  const def = DOCUMENT_CATALOG.find((d) => d.id === docId);
  if (!claim || !def) return null;
  const pdf = def.kind === 'pdf';
  const count = def.minCount || 1;
  const prev = claim.documents?.[docId];
  claim.documents = claim.documents || {};
  claim.documents[docId] = {
    status: 'uploaded',
    filename: pdf ? `${def.id}-uploaded.pdf` : `${def.id}-upload-01.jpg`,
    thumb: pdf ? 'PDF' : count > 1 ? `${count} photos` : 'Photo',
    note: 'Uploaded in Claim Intel (demo).',
    count,
  };
  appendClaimAudit(claimId, {
    user: actor?.name || 'Demo user',
    action: 'Uploaded',
    changeType: 'Upload',
    entity: 'Document',
    field: def.name,
    oldValue: prev?.filename || 'Missing',
    newValue: claim.documents[docId].filename,
    comments: `Document captured at ${stageDisplayName(def.stage)}.`,
  });
  return claim.documents[docId];
}

function buildChecks(overrides = {}) {
  return USE_CASE_LIBRARY.map((def) => {
    const o = overrides[def.id] || {};
    return {
      checkId: def.id,
      state: /** @type {CheckState} */ (o.state || 'pass'),
      evidence:
        o.evidence ||
        (def.hardFail
          ? 'Matched policy record — no discrepancy found'
          : 'Within expected range for this claim profile'),
    };
  });
}

function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseVehicle(vehicle) {
  const raw = String(vehicle || '');
  const [left, colourPart] = raw.split('·').map((s) => s.trim());
  const yearMatch = (left || '').match(/(\d{4})$/);
  const year = yearMatch ? yearMatch[1] : '';
  const rest = (left || '').replace(/\s+\d{4}$/, '').trim();
  const parts = rest.split(' ').filter(Boolean);
  return {
    make: parts[0] || '',
    model: parts.slice(1).join(' '),
    year,
    colour: colourPart || '',
  };
}

function composeVehicle(claim) {
  const year = claim.vehicleYear ? ` ${claim.vehicleYear}` : '';
  const colour = claim.vehicleColour ? ` · ${claim.vehicleColour}` : '';
  return `${claim.vehicleMake || ''} ${claim.vehicleModel || ''}${year}${colour}`.replace(/\s+/g, ' ').trim();
}

const BRANCH_PREFIX = {
  Dubai: 'DXB',
  'Abu Dhabi': 'AUH',
  Sharjah: 'SHJ',
  Riyadh: 'RUH',
  Jeddah: 'JED',
};

/**
 * Sample claims — Middle East motor insurance.
 */
const RAW_CLAIMS_BASE = [
  {
    id: 'CLM-2026-08412',
    claimant: 'Omar Al-Rashid',
    amount: 48500,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Dubai',
    filedAt: '2026-08-04',
    dueInDays: 5,
    plate: 'D 45821',
    vehicle: 'Toyota Land Cruiser 2022 · White',
    checks: buildChecks({
      10: { state: 'fail', evidence: 'Claimant self-selected Al Noor Body Shop (not network)' },
      11: { state: 'fail', evidence: 'Al Noor Body Shop appears on regional watchlist' },
      12: { state: 'fail', evidence: 'Estimate AED 48,500 is 1.8× median for front-end collision' },
      13: { state: 'fail', evidence: 'ECU + bumper claimed; photos support bumper-only damage' },
      15: { state: 'fail', evidence: '3.1× the claimant\'s historical average (AED 15,600)' },
      18: { state: 'fail', evidence: '3 claims in last 12 months (peer median: 1.1)' },
    }),
  },
  {
    id: 'CLM-2026-08391',
    claimant: 'Layla Hassan',
    amount: 127500,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Abu Dhabi',
    filedAt: '2026-08-02',
    dueInDays: 3,
    plate: 'AD 12-88421',
    policyPlate: 'AD 12-77109',
    vehicle: 'BMW X5 2023 · Black',
    policyColour: 'Silver',
    checks: buildChecks({
      1: { state: 'fail', evidence: 'Policy plate AD 12-77109 vs claim plate AD 12-88421' },
      5: { state: 'fail', evidence: 'Policy: BMW X5 Silver · Claim: BMW X5 Black' },
      11: { state: 'fail', evidence: 'Gulf Star Motors appears on internal watchlist (Q2 2025)' },
    }),
  },
  {
    id: 'CLM-2026-08455',
    claimant: 'Yusuf Al-Qahtani',
    amount: 8200,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Dubai',
    filedAt: '2026-08-09',
    dueInDays: 1,
    plate: 'D 91204',
    vehicle: 'Nissan Patrol 2021 · Grey',
    checks: buildChecks({
      8: { state: 'pass', evidence: 'Reported within 1 day of loss' },
    }),
  },
  {
    id: 'CLM-2026-08344',
    claimant: 'Noura Al-Mazrouei',
    amount: 34200,
    currency: 'AED',
    assignedTo: 'u-khalid',
    assignedName: 'Khalid Al-Mansouri',
    branch: 'Sharjah',
    filedAt: '2026-07-28',
    dueInDays: 7,
    plate: 'SHJ 6-33011',
    vehicle: 'Lexus RX 2020 · Pearl',
    lossDate: '2026-06-27',
    checks: buildChecks({
      8: { state: 'fail', evidence: 'Reported 31 days after date of loss' },
      10: { state: 'fail', evidence: 'Self-selected garage outside network panel' },
      13: { state: 'cant_evaluate', evidence: 'Parts schedule missing from claim record — cannot verify consistency' },
      15: { state: 'fail', evidence: '2.2× the claimant\'s historical average' },
      20: { state: 'fail', evidence: 'Loss in Al Ain; registered/usual area is Sharjah Industrial' },
    }),
  },
  {
    id: 'CLM-2026-08298',
    claimant: 'Ahmed Bin Zayed',
    amount: 96500,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Abu Dhabi',
    filedAt: '2026-07-22',
    dueInDays: 4,
    plate: 'AD 1-55210',
    vehicle: 'Mercedes GLE 2024 · White',
    lossDate: '2026-07-20',
    policyStart: '2026-07-16',
    sumInsured: 88000,
    checks: buildChecks({
      14: { state: 'fail', evidence: 'Claim AED 96,500 exceeds IDV AED 88,000 by AED 8,500' },
      6: { state: 'fail', evidence: 'Loss 4 days after policy inception (minimum cover: 14 days)' },
      18: { state: 'fail', evidence: '4 claims in last 12 months (peer median: 1.2)' },
    }),
  },
  {
    id: 'CLM-2026-08401',
    claimant: 'Mariam Al-Suwaidi',
    amount: 21500,
    currency: 'AED',
    assignedTo: 'u-sara',
    assignedName: 'Sara Al-Harbi',
    branch: 'Dubai',
    filedAt: '2026-08-05',
    dueInDays: 6,
    plate: 'D 22018',
    vehicle: 'Honda Accord 2022 · Silver',
    checks: buildChecks({
      8: { state: 'fail', evidence: 'Reported 47 days after date of loss' },
      9: { state: 'fail', evidence: 'Glass cover endorsement added 3 days before loss date' },
      11: { state: 'fail', evidence: 'Garage linked to elevated scrap-parts pattern' },
      18: { state: 'fail', evidence: '2 claims in 4 months after 3 quiet years' },
    }),
  },
  {
    id: 'CLM-2026-08372',
    claimant: 'Faisal Al-Otaibi',
    amount: 67800,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Riyadh',
    filedAt: '2026-07-30',
    dueInDays: 2,
    plate: 'RYD 4831 أب',
    vehicle: 'Toyota Camry 2023 · White',
    checks: buildChecks({
      16: { state: 'fail', evidence: 'Duplicate open claim CLM-2026-08102 for same loss date (12-Jul-26)' },
      11: { state: 'fail', evidence: 'Najd Auto Repair flagged on regional watchlist' },
      19: { state: 'fail', evidence: 'Prior flagged claim CLM-2025-06118 on same VIN' },
    }),
  },
  {
    id: 'CLM-2026-08428',
    claimant: 'Hessa Al-Dhaheri',
    amount: 14900,
    currency: 'AED',
    assignedTo: 'u-khalid',
    assignedName: 'Khalid Al-Mansouri',
    branch: 'Abu Dhabi',
    filedAt: '2026-08-07',
    dueInDays: 8,
    plate: 'AD 17-90112',
    vehicle: 'Kia Sportage 2021 · Blue',
    checks: buildChecks({}),
  },
  {
    id: 'CLM-2026-08255',
    claimant: 'Tariq Al-Hashimi',
    amount: 112000,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Jeddah',
    filedAt: '2026-07-18',
    dueInDays: 9,
    plate: 'JED 2290 س ر',
    vehicle: 'Range Rover Sport 2022 · Black',
    checks: buildChecks({
      2: { state: 'fail', evidence: 'Policy VIN SALWA2FE6NA123456 vs claim chassis SALWA2FE6NA789012' },
      4: { state: 'fail', evidence: 'Driver Mohammed Al-Hashimi not listed as policyholder or endorsed driver' },
      17: { state: 'fail', evidence: 'Salvage quote AED 18k inconsistent with total-loss claim of AED 112k' },
    }),
  },
  {
    id: 'CLM-2026-08460',
    claimant: 'Aisha Rahman',
    amount: 5600,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Dubai',
    filedAt: '2026-08-10',
    dueInDays: 10,
    plate: 'D 77123',
    vehicle: 'Hyundai Tucson 2020 · Red',
    checks: buildChecks({
      12: { state: 'cant_evaluate', evidence: 'Damage type field blank in FNOL — estimate cannot be benchmarked' },
    }),
  },
  {
    id: 'CLM-2026-08315',
    claimant: 'Rashid Al-Maktoum',
    amount: 43800,
    currency: 'AED',
    assignedTo: 'u-khalid',
    assignedName: 'Khalid Al-Mansouri',
    branch: 'Dubai',
    filedAt: '2026-07-25',
    dueInDays: 4,
    plate: 'D 10001',
    vehicle: 'Porsche Cayenne 2023 · Grey',
    checks: buildChecks({
      7: { state: 'fail', evidence: 'Loss 2 days before policy expiry (renewed next day)' },
      10: { state: 'fail', evidence: 'Self-selected garage outside network panel' },
      15: { state: 'fail', evidence: '2.4× claimant historical average' },
      18: { state: 'fail', evidence: '3 claims in 12 months vs peer median 1.1' },
    }),
  },
  {
    id: 'CLM-2026-08419',
    claimant: 'Dana Al-Kuwari',
    amount: 18900,
    currency: 'AED',
    assignedTo: 'u-sara',
    assignedName: 'Sara Al-Harbi',
    branch: 'Sharjah',
    filedAt: '2026-08-06',
    dueInDays: 11,
    plate: 'SHJ 2-11880',
    vehicle: 'Mazda CX-5 2022 · White',
    checks: buildChecks({
      6: { state: 'fail', evidence: 'Loss on day 6 of cover (minimum period: 14 days)' },
    }),
  },
  {
    id: 'CLM-2026-08280',
    claimant: 'Salem Al-Nuaimi',
    amount: 72500,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Abu Dhabi',
    filedAt: '2026-07-20',
    dueInDays: 6,
    plate: 'AD 9-44102',
    vehicle: 'Audi Q7 2021 · Black',
    checks: buildChecks({
      3: { state: 'fail', evidence: 'Policy cancelled 11-Jun-26; loss date 18-Jul-26 — cover not active' },
      20: { state: 'cant_evaluate', evidence: 'GPS / location of loss not captured in claim intake' },
    }),
  },
  {
    id: 'CLM-2026-08433',
    claimant: 'Reem Al-Sabah',
    amount: 29100,
    currency: 'AED',
    assignedTo: 'u-khalid',
    assignedName: 'Khalid Al-Mansouri',
    branch: 'Riyadh',
    filedAt: '2026-08-08',
    dueInDays: 12,
    plate: 'RYD 9012 ق ط',
    vehicle: 'Ford Explorer 2022 · White',
    checks: buildChecks({
      11: { state: 'fail', evidence: 'Workshop linked to 2 prior high-risk settlements' },
      13: { state: 'fail', evidence: 'Bumper + ECU claimed; photos show bumper-only damage' },
    }),
  },
  {
    id: 'CLM-2026-08358',
    claimant: 'Hamad Al-Thani',
    amount: 15700,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Dubai',
    filedAt: '2026-07-29',
    dueInDays: 5,
    plate: 'D 33450',
    vehicle: 'Toyota Corolla 2019 · Silver',
    checks: buildChecks({
      19: { state: 'fail', evidence: 'Claimant had rejected claim CLM-2025-04991 (staging suspected)' },
    }),
  },
  {
    id: 'CLM-2026-08448',
    claimant: 'Amira Farouk',
    amount: 9800,
    currency: 'AED',
    assignedTo: 'u-sara',
    assignedName: 'Sara Al-Harbi',
    branch: 'Jeddah',
    filedAt: '2026-08-09',
    dueInDays: 14,
    plate: 'JED 5512 و م',
    vehicle: 'Nissan Altima 2021 · Blue',
    checks: buildChecks({}),
  },
  {
    id: 'CLM-2026-08305',
    claimant: 'Majid Al-Ghamdi',
    amount: 54100,
    currency: 'AED',
    assignedTo: 'u-fatima',
    assignedName: 'Fatima Al-Najjar',
    branch: 'Riyadh',
    filedAt: '2026-07-24',
    dueInDays: 3,
    plate: 'RYD 2201 د ع',
    vehicle: 'Chevrolet Tahoe 2023 · Black',
    checks: buildChecks({
      5: { state: 'fail', evidence: 'Policy: Tahoe White · Claim: Tahoe Black' },
      8: { state: 'fail', evidence: 'Reported 28 days after loss' },
      12: { state: 'fail', evidence: 'Estimate 2.2× peer band for side-impact damage' },
      15: { state: 'fail', evidence: '2.9× historical average for this claimant' },
      17: { state: 'fail', evidence: 'Total-loss declared but repairable per surveyor note' },
    }),
  },
  {
    id: 'CLM-2026-08470',
    claimant: 'Khadija Al-Blooshi',
    amount: 12300,
    currency: 'AED',
    assignedTo: 'u-khalid',
    assignedName: 'Khalid Al-Mansouri',
    branch: 'Sharjah',
    filedAt: '2026-08-10',
    dueInDays: 15,
    plate: 'SHJ 4-77821',
    vehicle: 'Toyota Yaris 2020 · White',
    checks: buildChecks({
      10: { state: 'cant_evaluate', evidence: 'Garage assignment channel blank — network vs self-select unknown' },
    }),
  },
];

const CLAIM_META = {
  'CLM-2026-08412': { claimType: 'own_damage', towed: true },
  'CLM-2026-08391': { claimType: 'tp', towed: false },
  'CLM-2026-08455': { claimType: 'own_damage', towed: false },
  'CLM-2026-08344': { claimType: 'own_damage', towed: true },
  'CLM-2026-08298': { claimType: 'total_loss', towed: true },
  'CLM-2026-08401': { claimType: 'own_damage', towed: false },
  'CLM-2026-08372': { claimType: 'tp', towed: false },
  'CLM-2026-08428': { claimType: 'own_damage', towed: false },
  'CLM-2026-08255': { claimType: 'total_loss', towed: true },
  'CLM-2026-08460': { claimType: 'own_damage', towed: false },
  'CLM-2026-08315': { claimType: 'own_damage', towed: false },
  'CLM-2026-08419': { claimType: 'own_damage', towed: false },
  'CLM-2026-08280': { claimType: 'theft', towed: true },
  'CLM-2026-08433': { claimType: 'tp', towed: false },
  'CLM-2026-08358': { claimType: 'own_damage', towed: false },
  'CLM-2026-08448': { claimType: 'own_damage', towed: false },
  'CLM-2026-08305': { claimType: 'total_loss', towed: true },
  'CLM-2026-08470': { claimType: 'own_damage', towed: false },
};

const DOCUMENT_SEEDS = {
  'CLM-2026-08412': {
    'fnol-licence': {
      status: 'rejected',
      filename: 'licence-omar-blur.jpg',
      thumb: 'Photo',
      note: 'Image too blurry — licence number not readable.',
      count: 1,
    },
  },
  'CLM-2026-08455': {
    'fnol-scene-photos': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Scene photos not attached at FNOL (need 5, plate in frame).',
      count: 0,
    },
    'set-iban': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Payee IBAN letter not on file.',
      count: 0,
    },
    'set-invoice': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Final invoice not received.',
      count: 0,
    },
    'set-completion': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Completion photos pending repair close.',
      count: 0,
    },
    'set-discharge': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Discharge voucher not signed.',
      count: 0,
    },
  },
  'CLM-2026-08344': {
    'ass-surveyor': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Surveyor report not uploaded.',
      count: 0,
    },
    'ass-prerepair': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Pre-repair photos pending surveyor visit.',
      count: 0,
    },
    'ass-parts': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Parts schedule missing from claim record.',
      count: 0,
    },
    'fnol-scene-photos': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Only 2 scene photos on file — below the 5-photo minimum.',
      count: 2,
    },
  },
  'CLM-2026-08460': {
    'int-estimate': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Garage estimate not received — cannot benchmark repair cost.',
      count: 0,
    },
  },
  'CLM-2026-08470': {
    'int-nomination': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Garage assignment channel blank — network vs self-select unknown.',
      count: 0,
    },
  },
  'CLM-2026-08298': {
    'set-salvage-papers': {
      status: 'missing',
      filename: null,
      thumb: null,
      note: 'Salvage handover papers outstanding.',
      count: 0,
    },
  },
  'CLM-2026-08428': {
    'fnol-dashcam': {
      status: 'waived',
      filename: null,
      thumb: null,
      note: 'No dashcam fitted — waived at FNOL.',
      count: 0,
    },
    ...MISSING_SURVEYOR_DOCS,
  },
  'CLM-2026-08448': { ...MISSING_SURVEYOR_DOCS },
  'CLM-2026-08419': { ...MISSING_SURVEYOR_DOCS },
  'CLM-2026-08358': { ...MISSING_SURVEYOR_DOCS },
  'CLM-2026-08401': { ...MISSING_SURVEYOR_DOCS },
};

export const RAW_CLAIMS = RAW_CLAIMS_BASE.map((c, i) => {
  const meta = CLAIM_META[c.id] || { claimType: 'own_damage', towed: false };
  const claim = {
    ...c,
    claimType: meta.claimType,
    towed: !!meta.towed,
    policyNumber: `POL-${BRANCH_PREFIX[c.branch] || 'MEA'}-${784100 + i * 17}`,
    lossDate: c.lossDate || shiftDate(c.filedAt, -(1 + (i % 3))),
    sumInsured: c.sumInsured || Math.round(c.amount * (1.15 + (i % 5) * 0.08)),
    garage: i % 4 === 0 ? 'Al Noor Body Shop' : 'Network panel garage',
    lossLocation: c.branch === 'Dubai' ? 'Sheikh Zayed Road, Dubai' : `${c.branch} metro area`,
  };
  const parsed = parseVehicle(claim.vehicle);
  claim.vin = c.vin || `WBA${String(784100 + i * 17).slice(-8)}CH${String(i).padStart(2, '0')}`;
  claim.policyVin = c.policyVin || claim.vin;
  claim.policyPlate = c.policyPlate || claim.plate;
  claim.policyholder = c.policyholder || claim.claimant;
  claim.vehicleMake = parsed.make;
  claim.vehicleModel = parsed.model;
  claim.vehicleYear = parsed.year;
  claim.vehicleColour = parsed.colour;
  claim.policyMake = c.policyMake || parsed.make;
  claim.policyModel = c.policyModel || parsed.model;
  claim.policyColour = c.policyColour || parsed.colour;
  claim.policyStart = c.policyStart || shiftDate(claim.filedAt, -200);
  claim.policyEnd = c.policyEnd || shiftDate(claim.filedAt, 165);
  claim.usualArea = c.usualArea || `${claim.branch} registered area`;
  claim.exceptions = [];
  claim.waivedCheckIds = [];
  claim.dispositions = {};
  claim.documents = seedDocuments(claim, DOCUMENT_SEEDS[c.id] || {});
  const passedIntake = hasPassedPriorStages(claim, ['fnol', 'intimation']);
  claim.surveyorSubmitted = AWAITING_SURVEYOR_IDS.has(c.id) ? false : passedIntake;
  return claim;
});

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatAuditAmount(amount) {
  return `AED ${Number(amount).toLocaleString('en-US')}`;
}

function nextAuditStamp() {
  const seq = (nextAuditStamp.seq = (nextAuditStamp.seq || 0) + 1);
  const mins = 15 + seq;
  return { date: '2026-08-14', time: `${pad2(16 + Math.floor(mins / 60))}:${pad2(mins % 60)}` };
}

function versionedAudit(entries) {
  return entries.map((row, i) => ({
    version: `v${i + 1}`,
    status: row.status || 'Completed',
    comments: row.comments || '',
    oldValue: row.oldValue ?? '—',
    newValue: row.newValue ?? '—',
    entity: row.entity || 'Claim',
    ...row,
    version: `v${i + 1}`,
  }));
}

function buildSeedAudit(claim) {
  const filed = claim.filedAt;
  const handler = claim.assignedName || 'Fatima Al-Najjar';
  const salt = claim.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hour = 8 + (salt % 3);
  const rows = [];
  const stage = getClaimWorkflowStage(claim);

  rows.push({
    date: filed,
    time: `${pad2(hour)}:12`,
    user: 'Claim Intel',
    action: 'Created',
    changeType: 'Create',
    entity: 'Claim',
    field: 'Claim number',
    oldValue: '—',
    newValue: claim.id,
    comments: `FNOL ingested for ${claim.claimant}.`,
  });

  rows.push({
    date: filed,
    time: `${pad2(hour)}:18`,
    user: 'Khalid Al-Mansouri',
    action: 'Assigned',
    changeType: 'Assignment',
    entity: 'Claim',
    field: 'Assigned to',
    oldValue: 'Unassigned',
    newValue: handler,
    comments: 'Routed to claims handler.',
  });

  rows.push({
    date: filed,
    time: `${pad2(hour)}:21`,
    user: handler,
    action: 'Updated',
    changeType: 'Update',
    entity: 'Claim',
    field: 'Claim amount',
    oldValue: '—',
    newValue: formatAuditAmount(claim.amount),
    comments: 'Reserve captured from FNOL.',
  });

  rows.push({
    date: filed,
    time: `${pad2(hour)}:24`,
    user: handler,
    action: 'Updated',
    changeType: 'Status',
    entity: 'Stage',
    field: 'Claim stage',
    oldValue: '—',
    newValue: 'FNOL',
    comments: 'Claim opened at FNOL.',
  });

  const docs = getStageDocumentRows(claim, 'fnol')
    .concat(getStageDocumentRows(claim, 'intimation'))
    .concat(getStageDocumentRows(claim, 'assessment'))
    .concat(getStageDocumentRows(claim, 'settlement'))
    .filter((row) => row.displayStatus !== 'missing');

  docs.forEach((row, i) => {
    const day = shiftDate(filed, row.def.stage === 'fnol' ? 0 : row.def.stage === 'intimation' ? 1 : 2);
    const statusLabel =
      row.displayStatus === 'waived'
        ? 'Waived'
        : row.displayStatus === 'already_on_file'
          ? 'Already on file'
          : row.rec.filename || 'Uploaded';
    rows.push({
      date: day,
      time: `${pad2(hour + 1)}:${pad2(10 + (i % 40))}`,
      user: row.def.stage === 'assessment' ? 'Hassan Al-Falasi' : handler,
      action: row.displayStatus === 'waived' ? 'Waived' : 'Uploaded',
      changeType: row.displayStatus === 'waived' ? 'Update' : 'Upload',
      entity: 'Document',
      field: row.def.name,
      oldValue: 'Missing',
      newValue: statusLabel,
      comments: row.rec.note || `Document recorded at ${stageDisplayName(row.def.stage)}.`,
    });
  });

  if (hasStageDocsComplete(claim, 'fnol') && (stage === 'intimation' || stage === 'assessment' || stage === 'settlement')) {
    rows.push({
      date: shiftDate(filed, 1),
      time: `${pad2(hour + 1)}:05`,
      user: handler,
      action: 'Updated',
      changeType: 'Status',
      entity: 'Stage',
      field: 'Claim stage',
      oldValue: 'FNOL',
      newValue: 'Intimation',
      comments: 'FNOL documents complete — moved to Intimation.',
    });
  }

  if (hasStageDocsComplete(claim, 'intimation') && (stage === 'assessment' || stage === 'settlement')) {
    rows.push({
      date: shiftDate(filed, 2),
      time: `${pad2(hour + 2)}:16`,
      user: 'Khalid Al-Mansouri',
      action: 'Assigned',
      changeType: 'Assignment',
      entity: 'Stage',
      field: 'Surveyor',
      oldValue: '—',
      newValue: 'Hassan Al-Falasi',
      comments: 'Surveyor assigned after Intimation.',
    });
    rows.push({
      date: shiftDate(filed, 2),
      time: `${pad2(hour + 2)}:17`,
      user: handler,
      action: 'Updated',
      changeType: 'Status',
      entity: 'Stage',
      field: 'Claim stage',
      oldValue: 'Intimation',
      newValue: 'Surveyor',
      comments: 'Claim released to surveyor.',
    });
  }

  if (claim.surveyorSubmitted) {
    rows.push({
      date: shiftDate(filed, 3),
      time: `${pad2(hour + 2)}:48`,
      user: 'Hassan Al-Falasi',
      action: 'Submitted',
      changeType: 'Status',
      entity: 'Stage',
      field: 'Claim stage',
      oldValue: 'Surveyor',
      newValue: 'Settlement',
      comments: 'Surveyor pack submitted for further scoring.',
    });
  }

  const failed = (claim.checks || []).filter((c) => c.state === 'fail').length;
  const cant = (claim.checks || []).filter((c) => c.state === 'cant_evaluate').length;
  rows.push({
    date: shiftDate(filed, claim.surveyorSubmitted ? 3 : stage === 'fnol' ? 0 : 1),
    time: `${pad2(hour + 3)}:02`,
    user: 'Claim Intel',
    action: 'Scored',
    changeType: 'Score',
    entity: 'Score',
    field: 'Fraud risk score',
    oldValue: '—',
    newValue: 'Published',
    comments: `${failed} failed check${failed === 1 ? '' : 's'}${cant ? ` · ${cant} could not be evaluated` : ''}.`,
  });

  if (failed >= 3) {
    rows.push({
      date: shiftDate(filed, 3),
      time: `${pad2(hour + 3)}:40`,
      user: 'Noura Al-Qahtani',
      action: 'Reviewed',
      changeType: 'Review',
      entity: 'Claim',
      field: 'FIU flag',
      oldValue: 'Clear',
      newValue: 'Flagged',
      comments: 'Escalated for investigation on repeated soft fails.',
    });
  }

  if (claim.amount > 80000) {
    rows.push({
      date: shiftDate(filed, 1),
      time: `${pad2(hour + 1)}:55`,
      user: handler,
      action: 'Updated',
      changeType: 'Update',
      entity: 'Claim',
      field: 'Claim amount',
      oldValue: formatAuditAmount(Math.round(claim.amount * 0.86)),
      newValue: formatAuditAmount(claim.amount),
      comments: 'Reserve revised after garage estimate.',
    });
  }

  rows.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return versionedAudit(rows);
}

RAW_CLAIMS.forEach((claim) => {
  claim.auditLog = buildSeedAudit(claim);
});

const EXTRA_LEDGER_EVENTS = [
  {
    id: 'CLM-2026-08460',
    date: '2026-08-10',
    time: '16:22',
    user: 'Fatima Al-Najjar',
    action: 'Uploaded',
    changeType: 'Upload',
    entity: 'Document',
    field: 'Accident scene photos',
    oldValue: 'Missing',
    newValue: 'Uploaded',
    comments: 'Five scene photos captured after desk review.',
  },
  {
    id: 'CLM-2026-08470',
    date: '2026-08-10',
    time: '17:08',
    user: 'Fatima Al-Najjar',
    action: 'Exception resolve',
    changeType: 'Exception',
    entity: 'Use-case',
    field: '#08',
    oldValue: 'Reported 18 days after loss',
    newValue: 'Pending waive',
    comments: 'Customer was overseas; delay explained.',
  },
  {
    id: 'CLM-2026-08455',
    date: '2026-08-10',
    time: '09:41',
    user: 'Fatima Al-Najjar',
    action: 'Uploaded',
    changeType: 'Upload',
    entity: 'Document',
    field: 'Accident scene photos',
    oldValue: 'Missing',
    newValue: 'Uploaded',
    comments: 'Plate in frame on photo 2.',
  },
  {
    id: 'CLM-2026-08344',
    date: '2026-08-10',
    time: '11:15',
    user: 'Khalid Al-Mansouri',
    action: 'Exception approved',
    changeType: 'Exception',
    entity: 'Use-case',
    field: '#10',
    oldValue: 'Fail',
    newValue: 'Waived',
    comments: 'Network garage confirmed after the fact.',
  },
  {
    id: 'CLM-2026-08433',
    date: '2026-08-08',
    time: '14:05',
    user: 'Hassan Al-Falasi',
    action: 'Submitted',
    changeType: 'Status',
    entity: 'Stage',
    field: 'Claim stage',
    oldValue: 'Surveyor',
    newValue: 'Settlement',
    comments: 'Surveyor pack submitted for further scoring.',
  },
  {
    id: 'CLM-2026-08419',
    date: '2026-08-06',
    time: '10:18',
    user: 'Khalid Al-Mansouri',
    action: 'Assigned',
    changeType: 'Assignment',
    entity: 'Stage',
    field: 'Surveyor',
    oldValue: '—',
    newValue: 'Hassan Al-Falasi',
    comments: 'Surveyor assigned after Intimation.',
  },
  {
    id: 'CLM-2026-08412',
    date: '2026-08-05',
    time: '13:40',
    user: 'Noura Al-Qahtani',
    action: 'Reviewed',
    changeType: 'Review',
    entity: 'Claim',
    field: 'FIU flag',
    oldValue: 'Clear',
    newValue: 'Flagged',
    comments: 'Repeat garage watchlist hits.',
  },
  {
    id: 'CLM-2026-08401',
    date: '2026-08-05',
    time: '08:55',
    user: 'Claim Intel',
    action: 'Scored',
    changeType: 'Score',
    entity: 'Score',
    field: 'Fraud risk score',
    oldValue: '—',
    newValue: 'Published',
    comments: 'Rescore after FNOL documents landed.',
  },
];

EXTRA_LEDGER_EVENTS.forEach((ev) => {
  const claim = RAW_CLAIMS.find((c) => c.id === ev.id);
  if (!claim) return;
  claim.auditLog = claim.auditLog || [];
  const { id, ...row } = ev;
  void id;
  claim.auditLog.push({
    ...row,
    status: row.status || 'Completed',
    version: `v${claim.auditLog.length + 1}`,
  });
});

export function getClaimAuditLog(claim) {
  const raw = RAW_CLAIMS.find((c) => c.id === claim?.id) || claim;
  return [...(raw?.auditLog || [])].sort((a, b) => {
    const byWhen = `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
    if (byWhen) return byWhen;
    return parseInt(String(b.version).replace(/\D/g, ''), 10) - parseInt(String(a.version).replace(/\D/g, ''), 10);
  });
}

export function appendClaimAudit(claimId, partial) {
  const claim = RAW_CLAIMS.find((c) => c.id === claimId);
  if (!claim) return;
  if (!claim.auditLog) claim.auditLog = [];
  const stamp = nextAuditStamp();
  claim.auditLog.push({
    version: `v${claim.auditLog.length + 1}`,
    date: stamp.date,
    time: stamp.time,
    user: 'Demo user',
    action: 'Updated',
    changeType: 'Update',
    entity: 'Claim',
    field: '—',
    oldValue: '—',
    newValue: '—',
    status: 'Completed',
    comments: '',
    ...partial,
    version: `v${claim.auditLog.length + 1}`,
  });
}

const CLAIM_RUNTIME_KEY = 'claim-intel-claim-runtime-v1';

const RUNTIME_FIELDS = [
  'plate',
  'policyPlate',
  'vin',
  'policyVin',
  'policyNumber',
  'lossDate',
  'filedAt',
  'policyStart',
  'policyEnd',
  'claimant',
  'policyholder',
  'vehicleMake',
  'vehicleModel',
  'vehicleYear',
  'vehicleColour',
  'policyMake',
  'policyModel',
  'policyColour',
  'vehicle',
  'garage',
  'amount',
  'sumInsured',
  'lossLocation',
  'usualArea',
];

const NUMBER_FIELDS = new Set(['amount', 'sumInsured']);

/** Fields a Resolve action may edit, keyed by use-case id. */
export const EXCEPTION_FIELD_MAP = {
  1: [
    { key: 'plate', label: 'Claim plate' },
    { key: 'policyPlate', label: 'Policy plate' },
  ],
  2: [
    { key: 'vin', label: 'Claim VIN / chassis' },
    { key: 'policyVin', label: 'Policy VIN / chassis' },
  ],
  3: [
    { key: 'policyNumber', label: 'Policy number' },
    { key: 'lossDate', label: 'Loss date', type: 'date' },
    { key: 'policyStart', label: 'Policy start', type: 'date' },
    { key: 'policyEnd', label: 'Policy end', type: 'date' },
  ],
  4: [
    { key: 'claimant', label: 'Claimant / driver' },
    { key: 'policyholder', label: 'Policyholder' },
  ],
  5: [
    { key: 'vehicleMake', label: 'Claim make' },
    { key: 'vehicleModel', label: 'Claim model' },
    { key: 'vehicleColour', label: 'Claim colour' },
    { key: 'policyMake', label: 'Policy make' },
    { key: 'policyModel', label: 'Policy model' },
    { key: 'policyColour', label: 'Policy colour' },
  ],
  6: [
    { key: 'lossDate', label: 'Loss date', type: 'date' },
    { key: 'policyStart', label: 'Policy start', type: 'date' },
  ],
  7: [
    { key: 'lossDate', label: 'Loss date', type: 'date' },
    { key: 'policyEnd', label: 'Policy end', type: 'date' },
  ],
  8: [
    { key: 'lossDate', label: 'Loss date', type: 'date' },
    { key: 'filedAt', label: 'Reported date', type: 'date' },
  ],
  9: [
    { key: 'lossDate', label: 'Loss date', type: 'date' },
    { key: 'policyStart', label: 'Endorsement / policy start', type: 'date' },
  ],
  10: [{ key: 'garage', label: 'Garage' }],
  11: [{ key: 'garage', label: 'Garage' }],
  12: [{ key: 'amount', label: 'Repair estimate (AED)', type: 'number' }],
  13: [{ key: 'garage', label: 'Garage' }],
  14: [
    { key: 'amount', label: 'Claim amount (AED)', type: 'number' },
    { key: 'sumInsured', label: 'Sum insured / IDV (AED)', type: 'number' },
  ],
  15: [{ key: 'amount', label: 'Claim amount (AED)', type: 'number' }],
  16: [
    { key: 'lossDate', label: 'Loss date', type: 'date' },
    { key: 'plate', label: 'Plate' },
  ],
  17: [{ key: 'amount', label: 'Claim amount (AED)', type: 'number' }],
  18: [{ key: 'claimant', label: 'Claimant' }],
  19: [{ key: 'claimant', label: 'Claimant' }],
  20: [
    { key: 'lossLocation', label: 'Loss location' },
    { key: 'usualArea', label: 'Registered / usual area' },
  ],
};

export function getExceptionFields(checkId) {
  return EXCEPTION_FIELD_MAP[Number(checkId)] || [];
}

export function isCheckerRole(role) {
  return role === 'claim_head' || role === 'admin' || role === 'fiu';
}

export function getPendingExceptions(claim) {
  return (claim?.exceptions || []).filter((e) => e.status === 'pending');
}

export function latestExceptionForCheck(claim, checkId) {
  const id = Number(checkId);
  const list = (claim?.exceptions || []).filter((e) => e.checkId === id);
  return list.length ? list[list.length - 1] : null;
}

function loadRuntimeStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLAIM_RUNTIME_KEY) || 'null');
    if (parsed && parsed.claims) return parsed;
  } catch {
    /* ignore */
  }
  return { claims: {} };
}

function persistClaimRuntime(claim) {
  const store = loadRuntimeStore();
  const fields = {};
  RUNTIME_FIELDS.forEach((key) => {
    if (claim[key] != null) fields[key] = claim[key];
  });
  store.claims[claim.id] = {
    fields,
    exceptions: claim.exceptions || [],
    waivedCheckIds: claim.waivedCheckIds || [],
    dispositions: claim.dispositions || {},
  };
  localStorage.setItem(CLAIM_RUNTIME_KEY, JSON.stringify(store));
}

function hydrateClaimRuntime() {
  const store = loadRuntimeStore();
  RAW_CLAIMS.forEach((claim) => {
    const slice = store.claims[claim.id];
    if (!slice) return;
    Object.assign(claim, slice.fields || {});
    if (slice.fields?.vehicleMake || slice.fields?.vehicleColour) {
      claim.vehicle = composeVehicle(claim);
    }
    claim.exceptions = slice.exceptions || [];
    claim.waivedCheckIds = slice.waivedCheckIds || [];
    claim.dispositions = slice.dispositions || {};
  });
}

function applyProposedFields(claim, proposed = {}) {
  Object.entries(proposed).forEach(([key, value]) => {
    claim[key] = NUMBER_FIELDS.has(key) ? Number(value) : value;
  });
  if (
    proposed.vehicleMake != null ||
    proposed.vehicleModel != null ||
    proposed.vehicleYear != null ||
    proposed.vehicleColour != null
  ) {
    claim.vehicle = composeVehicle(claim);
  }
}

function actorSnapshot(actor) {
  return {
    userId: actor?.userId || actor?.id || '',
    name: actor?.name || 'Demo user',
    role: actor?.role || '',
  };
}

function fieldSummary(fields = {}) {
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${v}`);
  return parts.join(', ') || '—';
}

export function proposeCheckException(claimId, payload, actor) {
  const claim = RAW_CLAIMS.find((c) => c.id === claimId);
  if (!claim) return { ok: false, message: 'Claim not found.' };
  const checkId = Number(payload.checkId);
  const type = payload.type;
  const comment = String(payload.comment || '').trim();
  if (!['resolve', 'reject', 'approve'].includes(type)) {
    return { ok: false, message: 'Unknown exception action.' };
  }
  if (!comment) return { ok: false, message: 'A comment is required.' };

  const pending = latestExceptionForCheck(claim, checkId);
  if (pending?.status === 'pending') {
    return { ok: false, message: 'This check already has a pending exception.' };
  }

  const hardFail = !!payload.hardFail;
  if (type === 'reject' && hardFail && actor?.role === 'claim_user') {
    return { ok: false, message: 'Claim Users cannot waive a hard-fail. Resolve the data or refer to FIU.' };
  }
  if (type === 'reject' && hardFail && !isCheckerRole(actor?.role)) {
    return { ok: false, message: 'Only Claim Head or FIU can waive a hard-fail.' };
  }

  const proposedFields = type === 'resolve' ? { ...(payload.proposedFields || {}) } : {};
  if (type === 'resolve') {
    const allowed = new Set(getExceptionFields(checkId).map((f) => f.key));
    Object.keys(proposedFields).forEach((key) => {
      if (!allowed.has(key)) delete proposedFields[key];
    });
  }

  const previousFields = {};
  Object.keys(proposedFields).forEach((key) => {
    previousFields[key] = claim[key] ?? '—';
  });

  const exception = {
    id: `ex-${claim.id}-${(claim.exceptions || []).length + 1}`,
    checkId,
    type,
    status: 'pending',
    comment,
    proposedFields,
    previousFields,
    hardFail,
    disposition: type === 'approve' ? (hardFail ? 'refer' : 'continue') : null,
    requestedBy: actorSnapshot(actor),
    requestedAt: '2026-08-14',
    decidedBy: null,
    decidedAt: null,
    decisionComment: '',
  };
  claim.exceptions = claim.exceptions || [];
  claim.exceptions.push(exception);
  persistClaimRuntime(claim);

  const actionLabel = type === 'resolve' ? 'Exception resolve' : type === 'reject' ? 'Exception reject' : 'Exception approve';
  appendClaimAudit(claimId, {
    user: actor?.name || 'Demo user',
    action: actionLabel,
    changeType: 'Exception',
    entity: 'Use-case',
    field: checkCode(checkId),
    oldValue: type === 'resolve' ? fieldSummary(previousFields) : 'Active fail',
    newValue: type === 'resolve' ? fieldSummary(proposedFields) : type === 'reject' ? 'Pending waive' : exception.disposition,
    comments: comment,
  });
  persistClaimRuntime(claim);
  return { ok: true, exception };
}

export function decideCheckException(claimId, exceptionId, decision, comment, actor) {
  const claim = RAW_CLAIMS.find((c) => c.id === claimId);
  if (!claim) return { ok: false, message: 'Claim not found.' };
  if (!isCheckerRole(actor?.role)) {
    return { ok: false, message: 'Only Claim Head, Admin, or FIU can decide an exception.' };
  }
  const exception = (claim.exceptions || []).find((e) => e.id === exceptionId);
  if (!exception || exception.status !== 'pending') {
    return { ok: false, message: 'No pending exception found.' };
  }
  const actorId = actor?.userId || actor?.id;
  if (actorId && exception.requestedBy?.userId && actorId === exception.requestedBy.userId) {
    return { ok: false, message: 'Maker cannot approve their own request.' };
  }
  if (decision === 'sent_back') {
    const note = String(comment || '').trim();
    if (!note) return { ok: false, message: 'A comment is required to send back.' };
    exception.status = 'sent_back';
    exception.decisionComment = note;
    exception.decidedBy = actorSnapshot(actor);
    exception.decidedAt = '2026-08-14';
    persistClaimRuntime(claim);
    appendClaimAudit(claimId, {
      user: actor?.name || 'Demo user',
      action: 'Exception sent back',
      changeType: 'Exception',
      entity: 'Use-case',
      field: checkCode(exception.checkId),
      oldValue: 'Pending',
      newValue: 'Sent back',
      comments: note,
    });
    persistClaimRuntime(claim);
    return { ok: true, exception };
  }
  if (decision !== 'approved') return { ok: false, message: 'Unknown decision.' };

  exception.status = 'approved';
  exception.decisionComment = String(comment || '').trim();
  exception.decidedBy = actorSnapshot(actor);
  exception.decidedAt = '2026-08-14';

  if (exception.type === 'resolve') {
    applyProposedFields(claim, exception.proposedFields);
  } else if (exception.type === 'reject') {
    const ids = new Set(claim.waivedCheckIds || []);
    ids.add(exception.checkId);
    claim.waivedCheckIds = [...ids];
  } else if (exception.type === 'approve') {
    claim.dispositions = { ...(claim.dispositions || {}), [exception.checkId]: exception.disposition };
  }
  persistClaimRuntime(claim);
  appendClaimAudit(claimId, {
    user: actor?.name || 'Demo user',
    action: 'Exception approved',
    changeType: 'Exception',
    entity: 'Use-case',
    field: checkCode(exception.checkId),
    oldValue:
      exception.type === 'resolve'
        ? fieldSummary(exception.previousFields)
        : exception.type === 'reject'
          ? 'Fail'
          : 'Fail',
    newValue:
      exception.type === 'resolve'
        ? fieldSummary(exception.proposedFields)
        : exception.type === 'reject'
          ? 'Waived'
          : exception.disposition === 'refer'
            ? 'Refer to FIU'
            : 'Accept risk',
    comments: exception.decisionComment || exception.comment,
  });
  persistClaimRuntime(claim);
  return { ok: true, exception };
}

hydrateClaimRuntime();

export const TREND_HISTORY = [
  { date: '2026-06-30', redPct: 18, yellowPct: 27, greenPct: 55, volume: 42 },
  { date: '2026-07-07', redPct: 21, yellowPct: 25, greenPct: 54, volume: 48 },
  { date: '2026-07-14', redPct: 19, yellowPct: 29, greenPct: 52, volume: 51 },
  { date: '2026-07-21', redPct: 24, yellowPct: 26, greenPct: 50, volume: 55 },
  { date: '2026-07-28', redPct: 22, yellowPct: 28, greenPct: 50, volume: 49 },
  { date: '2026-08-04', redPct: 20, yellowPct: 30, greenPct: 50, volume: 53 },
];
