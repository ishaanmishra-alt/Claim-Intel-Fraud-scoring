import { USERS } from './data.js';
import { DEFAULT_WEIGHTS } from './data.js';

const SESSION_KEY = 'claim-intel-session';
const WEIGHTS_KEY = 'claim-intel-weights';

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

export function getWeights() {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (!raw) return { ...DEFAULT_WEIGHTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_WEIGHTS, ...parsed };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function saveWeights(weights) {
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}

export function resetWeights() {
  localStorage.removeItem(WEIGHTS_KEY);
  return { ...DEFAULT_WEIGHTS };
}
