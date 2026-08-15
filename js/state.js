import {
  USERS,
  enabledSeedDefinitions,
  DEFAULT_WEIGHTS,
  DEFAULT_STAGE_PASS,
  DEFAULT_STAGE_MIX,
  checkCode,
} from './data.js';

const SESSION_KEY = 'claim-intel-session';
const WEIGHTS_KEY = 'claim-intel-weights-v4';
const CONFIG_KEY = 'claim-intel-config-v5';

/** Prototype "today" for version dating */
export const CONFIG_TODAY = '2026-08-12';

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(user, keepSignedIn) {
  const session = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    initials: user.initials,
    keepSignedIn: !!keepSignedIn,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function authenticate(username, password) {
  const user = USERS.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );
  return user || null;
}

function cloneUseCases(list) {
  return list.map((u) => ({ ...u }));
}

function cloneMix(mix) {
  const src = mix || DEFAULT_STAGE_MIX;
  return Object.fromEntries(
    Object.entries(src).map(([stage, weights]) => [stage, { ...(weights || {}) }])
  );
}

export function defaultUseCasesFromDefinitions() {
  return enabledSeedDefinitions().map((d) => {
    let weight = d.weight ?? DEFAULT_WEIGHTS[d.id] ?? 0;
    if (d.id === 10) weight = 100;
    return {
      id: d.id,
      code: checkCode(d.id),
      name: d.name,
      description: d.description,
      stage: d.stage,
      riskCategory: d.riskCategory || (d.hardFail ? 'critical' : 'high'),
      hardFail: !!d.hardFail,
      weight,
    };
  });
}

function withVersionExtras(version) {
  return {
    ...version,
    useCases: (version.useCases || []).map((u) => ({
      ...u,
      weight: u.weight == null ? DEFAULT_WEIGHTS[u.id] ?? 0 : u.weight,
    })),
    stagePassPct: { ...DEFAULT_STAGE_PASS, ...(version.stagePassPct || {}) },
    stageMix: cloneMix({ ...DEFAULT_STAGE_MIX, ...(version.stageMix || {}) }),
  };
}

function seedConfigStore() {
  const base = defaultUseCasesFromDefinitions();
  const extras = {
    stagePassPct: { ...DEFAULT_STAGE_PASS },
    stageMix: cloneMix(DEFAULT_STAGE_MIX),
  };
  return {
    versions: [
      {
        id: 1,
        number: 1,
        startDate: '2026-03-03',
        endDate: '2026-06-14',
        useCases: cloneUseCases(base),
        ...extras,
      },
      {
        id: 2,
        number: 2,
        startDate: '2026-06-15',
        endDate: '2026-08-11',
        useCases: cloneUseCases(base),
        ...extras,
      },
      {
        id: 3,
        number: 3,
        startDate: CONFIG_TODAY,
        endDate: null,
        useCases: cloneUseCases(base),
        ...extras,
      },
    ],
    currentId: 3,
  };
}

export function getConfigStore() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      const seeded = seedConfigStore();
      localStorage.setItem(CONFIG_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.versions?.length) return seedConfigStore();
    parsed.versions = parsed.versions.map(withVersionExtras);
    return parsed;
  } catch {
    return seedConfigStore();
  }
}

function syncWeightsFromVersion(version) {
  const weights = {};
  version.useCases.forEach((u) => {
    weights[u.id] = Number(u.weight) || 0;
  });
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}

function persistConfig(store) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(store));
  const current = store.versions.find((v) => v.id === store.currentId);
  if (current) syncWeightsFromVersion(current);
  return store;
}

/** Inclusive coverage: startDate <= asOf and (no end or endDate >= asOf). */
export function versionCoversDate(version, asOf = CONFIG_TODAY) {
  if (!version?.startDate) return false;
  if (version.startDate > asOf) return false;
  if (version.endDate && version.endDate < asOf) return false;
  return true;
}

/** Active config version for a given date (defaults to prototype today). */
export function getVersionForDate(asOf = CONFIG_TODAY, store = getConfigStore()) {
  const covering = store.versions
    .filter((v) => versionCoversDate(v, asOf))
    .sort((a, b) => a.number - b.number);
  if (covering.length) return covering[covering.length - 1];

  const started = store.versions
    .filter((v) => v.startDate && v.startDate <= asOf)
    .sort((a, b) => a.number - b.number);
  if (started.length) return started[started.length - 1];

  return store.versions.find((v) => v.id === store.currentId) || store.versions[store.versions.length - 1];
}

export function getCurrentConfigVersion(store = getConfigStore()) {
  return getVersionForDate(CONFIG_TODAY, store);
}

export function getConfigVersionById(id, store = getConfigStore()) {
  return store.versions.find((v) => v.id === Number(id)) || null;
}

export function getActiveUseCases(store = getConfigStore()) {
  return getCurrentConfigVersion(store).useCases;
}

export function getWeights() {
  const active = getActiveUseCases();
  const fromConfig = Object.fromEntries(active.map((u) => [u.id, u.weight ?? 0]));
  return { ...DEFAULT_WEIGHTS, ...fromConfig };
}

export function getStagePassPct(store = getConfigStore()) {
  const current = getCurrentConfigVersion(store);
  return { ...DEFAULT_STAGE_PASS, ...(current.stagePassPct || {}) };
}

export function getStageMix(store = getConfigStore()) {
  const current = getCurrentConfigVersion(store);
  return cloneMix({ ...DEFAULT_STAGE_MIX, ...(current.stageMix || {}) });
}

export function dayBefore(iso) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Apply a mutation to current use-cases and open a new version.
 * @param {object[]} nextUseCases
 * @param {{ startDate?: string, endDate?: string|null }} [dates]
 * @param {{ stagePassPct?: object, stageMix?: object }} [extras]
 */
export function commitConfigChange(nextUseCases, dates = {}, extras = {}) {
  const store = getConfigStore();
  const current = getCurrentConfigVersion(store);
  const startDate = dates.startDate || CONFIG_TODAY;
  const endDate = dates.endDate || null;

  // Close any open/overlapping versions that start before the new one.
  store.versions.forEach((v) => {
    if (v.startDate < startDate && (!v.endDate || v.endDate >= startDate)) {
      v.endDate = dayBefore(startDate);
    }
  });

  const newNumber = Math.max(...store.versions.map((v) => v.number)) + 1;
  const newVersion = withVersionExtras({
    id: Math.max(...store.versions.map((v) => v.id)) + 1,
    number: newNumber,
    startDate,
    endDate,
    useCases: cloneUseCases(nextUseCases),
    stagePassPct: extras.stagePassPct || current.stagePassPct,
    stageMix: extras.stageMix || current.stageMix,
  });

  store.versions.push(newVersion);
  store.currentId = getVersionForDate(CONFIG_TODAY, store).id;
  return persistConfig(store);
}

export function resetConfigStore() {
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(WEIGHTS_KEY);
  return getConfigStore();
}

export function saveWeights(weights) {
  const current = getCurrentConfigVersion();
  const next = current.useCases.map((u) => ({
    ...u,
    weight: weights[u.id] ?? u.weight ?? 0,
  }));
  return commitConfigChange(next);
}

export function resetWeights() {
  resetConfigStore();
  return getWeights();
}

export function formatLongDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  const yyyy = d.getFullYear();
  return `${dd}-${mon}-${yyyy}`;
}

export function isFutureVersion(version, asOf = CONFIG_TODAY) {
  return !!version?.startDate && version.startDate > asOf;
}

export function formatVersionLabel(version, { isCurrent = false } = {}) {
  const start = formatLongDate(version.startDate);
  const end = !version.endDate ? 'Present' : formatLongDate(version.endDate);
  const scheduled = isFutureVersion(version) ? ' · Scheduled' : '';
  void isCurrent;
  return `Version ${version.number} (${start} – ${end})${scheduled}`;
}
