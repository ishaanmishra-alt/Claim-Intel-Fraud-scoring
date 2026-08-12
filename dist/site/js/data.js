/** @typedef {'pass'|'fail'|'cant_evaluate'} CheckState */
/** @typedef {'red'|'yellow'|'green'} RiskTier */
/** @typedef {'claim_user'|'claim_head'|'admin'} Role */
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

export const DEFAULT_WEIGHTS = Object.fromEntries(
  CHECK_DEFINITIONS.filter((c) => !c.hardFail).map((c) => [c.id, c.weight])
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
];

export const ROLE_LABELS = {
  claim_user: 'Claim User',
  claim_head: 'Claim Head',
  admin: 'Admin',
};

export const BRANCHES = ['All branches', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Riyadh', 'Jeddah'];

function buildChecks(overrides = {}) {
  return CHECK_DEFINITIONS.map((def) => {
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
    vehicle: 'BMW X5 2023 · Black',
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

export const RAW_CLAIMS = RAW_CLAIMS_BASE.map((c, i) => ({
  ...c,
  policyNumber: `POL-${BRANCH_PREFIX[c.branch] || 'MEA'}-${784100 + i * 17}`,
  lossDate: shiftDate(c.filedAt, -(1 + (i % 3))),
  sumInsured: Math.round(c.amount * (1.15 + (i % 5) * 0.08)),
  garage: i % 4 === 0 ? 'Al Noor Body Shop' : 'Network panel garage',
  lossLocation: c.branch === 'Dubai' ? 'Sheikh Zayed Road, Dubai' : `${c.branch} metro area`,
}));

export const TREND_HISTORY = [
  { date: '2026-06-30', redPct: 18, yellowPct: 27, greenPct: 55, volume: 42 },
  { date: '2026-07-07', redPct: 21, yellowPct: 25, greenPct: 54, volume: 48 },
  { date: '2026-07-14', redPct: 19, yellowPct: 29, greenPct: 52, volume: 51 },
  { date: '2026-07-21', redPct: 24, yellowPct: 26, greenPct: 50, volume: 55 },
  { date: '2026-07-28', redPct: 22, yellowPct: 28, greenPct: 50, volume: 49 },
  { date: '2026-08-04', redPct: 20, yellowPct: 30, greenPct: 50, volume: 53 },
];
