import { renderLogin } from './views/login.js';
import { renderQueue } from './views/queue.js';
import { renderClaimDetail } from './views/claim.js';
import { renderDashboard, destroyChart } from './views/dashboard.js';
import { renderConfig } from './views/config.js';
import { renderReport } from './views/report.js';
import { getSession, clearSession, getWeights } from './state.js';
import { scoreAllClaims, canAccess, homeRouteForRole } from './scoring.js';

const root = document.getElementById('app');

/** @type {{ scope: 'mine'|'all', sort: 'risk'|'deadline' }} */
let queueState = { scope: 'mine', sort: 'risk' };

/** @type {{ period: string, branch: string, chartMode: 'share'|'volume' }} */
let dashState = { period: '30', branch: 'All branches', chartMode: 'share' };

let claimFilter = 'all';
let weights = getWeights();
let weightDraft = { ...weights };
let configFeedback = null;

function getClaims() {
  return scoreAllClaims(weights);
}

function parseRoute() {
  const hash = location.hash || '#/login';
  const path = hash.replace(/^#/, '') || '/login';
  const parts = path.split('/').filter(Boolean);
  return { parts, path };
}

function bindGlobalActions() {
  root.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearSession();
      destroyChart();
      location.hash = '#/login';
      render();
    });
  });
}

function render() {
  const session = getSession();
  const { parts } = parseRoute();
  const route = parts[0] || 'login';

  if (!session && route !== 'login') {
    renderLogin(root);
    return;
  }

  if (session && route === 'login') {
    location.hash = homeRouteForRole(session.role);
    return;
  }

  if (route === 'login') {
    destroyChart();
    renderLogin(root);
    return;
  }

  const claims = getClaims();

  if (route === 'queue') {
    destroyChart();
    renderQueue(root, session, claims, queueState, (next) => {
      queueState = next;
      render();
    });
  } else if (route === 'claim') {
    destroyChart();
    const id = parts.slice(1).join('/');
    const claim = claims.find((c) => c.id === id);
    renderClaimDetail(root, session, claim, claimFilter, (f) => {
      claimFilter = f;
      render();
    });
  } else if (route === 'dashboard') {
    if (!canAccess(session.role, 'dashboard')) {
      location.hash = '#/queue';
      return;
    }
    renderDashboard(root, session, claims, dashState, (next) => {
      dashState = next;
      render();
    });
  } else if (route === 'report') {
    destroyChart();
    if (!canAccess(session.role, 'report')) {
      location.hash = '#/queue';
      return;
    }
    renderReport(root, session, claims);
  } else if (route === 'config') {
    destroyChart();
    if (!canAccess(session.role, 'config')) {
      location.hash = '#/queue';
      return;
    }
    renderConfig(
      root,
      session,
      weights,
      weightDraft,
      configFeedback,
      (draft, feedback, opts = {}) => {
        weightDraft = { ...draft };
        configFeedback = feedback;
        if (!opts.silent) render();
      },
      (saved, feedback) => {
        weights = saved;
        weightDraft = { ...saved };
        configFeedback = feedback;
        render();
      }
    );
  } else {
    location.hash = session ? homeRouteForRole(session.role) : '#/login';
    return;
  }

  bindGlobalActions();
}

window.addEventListener('hashchange', () => {
  const { parts } = parseRoute();
  if (parts[0] !== 'claim') claimFilter = 'all';
  render();
});

if (!location.hash) {
  const session = getSession();
  location.hash = session ? homeRouteForRole(session.role) : '#/login';
} else {
  render();
}

window.addEventListener('load', render);
