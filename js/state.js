import { USERS, enabledSeedDefinitions, DEFAULT_WEIGHTS, checkCode } from './data.js';

const SESSION_KEY = 'claim-intel-session';
const WEIGHTS_KEY = 'claim-intel-weights-v3';
const CONFIG_KEY = 'claim-intel-config-v4';

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

export function defaultUseCasesFromDefinitions() {
  return enabledSeedDefinitions().map((d) => {
    let weight = d.hardFail ? null : d.weight;
    // Stage soft totals after removing #11–#20 from the seeded table
    if (d.id === 8 || d.id === 10) weight = 100;
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

function seedConfigStore() {
  const base = defaultUseCasesFromDefinitions();
  return {
    versions: [
      {
        id: 1,
        number: 1,
        startDate: '2026-03-03',
        endDate: '2026-06-14',
        useCases: cloneUseCases(base),
      },
      {
        id: 2,
        number: 2,
        startDate: '2026-06-15',
        endDate: '2026-08-11',
        useCases: cloneUseCases(base),
      },
      {
        id: 3,
        number: 3,
        startDate: CONFIG_TODAY,
        endDate: null,
        useCases: cloneUseCases(base),
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
    return parsed;
  } catch {
    return seedConfigStore();
  }
}

function syncWeightsFromVersion(version) {
  const weights = {};
  version.useCases.forEach((u) => {
    if (!u.hardFail) weights[u.id] = Number(u.weight) || 0;
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
  const fromConfig = Object.fromEntries(
    active.filter((u) => !u.hardFail).map((u) => [u.id, u.weight ?? 0])
  );
  return { ...DEFAULT_WEIGHTS, ...fromConfig };
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
 */
export function commitConfigChange(nextUseCases, dates = {}) {
  const store = getConfigStore();
  const startDate = dates.startDate || CONFIG_TODAY;
  const endDate = dates.endDate || null;

  // Close any open/overlapping versions that start before the new one.
  store.versions.forEach((v) => {
    if (v.startDate < startDate && (!v.endDate || v.endDate >= startDate)) {
      v.endDate = dayBefore(startDate);
    }
  });

  const newNumber = Math.max(...store.versions.map((v) => v.number)) + 1;
  const newVersion = {
    id: Math.max(...store.versions.map((v) => v.id)) + 1,
    number: newNumber,
    startDate,
    endDate,
    useCases: cloneUseCases(nextUseCases),
  };

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
  const next = current.useCases.map((u) => {
    if (u.hardFail) return { ...u };
    return { ...u, weight: weights[u.id] ?? u.weight ?? 0 };
  });
  return commitConfigChange(next);
}

export function resetWeights() {
  resetConfigStore();
  return getWeights();
}

export function formatLongDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'long' });
  const yyyy = d.getFullYear();
  return `${dd}-${month}-${yyyy}`;
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
