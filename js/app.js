import { renderLogin } from './views/login.js';
import { renderQueue } from './views/queue.js';
import { renderClaimDetail } from './views/claim.js';
import { renderDashboard, destroyChart } from './views/dashboard.js';
import { renderConfig } from './views/config.js';
import { renderReport } from './views/report.js';
import { getSession, clearSession, getWeights } from './state.js';
import { scoreAllClaims, canAccess, homeRouteForRole } from './scoring.js';

const root = document.getElementById('app');

/** @type {{ scope: 'mine'|'all', sort: 'risk'|'deadline', stage: string }} */
let queueState = { scope: 'mine', sort: 'risk', stage: 'all', auditClaimId: null, versionKey: null };

/** @type {{ period: string, branch: string, chartMode: 'share'|'volume', claimType: string }} */
let dashState = { period: '30', branch: 'All branches', chartMode: 'share', claimType: 'all' };

/** @type {object} */
let reportState = {
  period: '7',
  branch: 'All branches',
  claimType: 'all',
  stage: 'all',
  tier: 'all',
  from: '2026-08-05',
  to: '2026-08-11',
  ucStage: 'all',
  ucHardFailOnly: false,
  sampleCheckId: null,
  sampleTier: 'red',
  samplePendingOnly: false,
  txPeriod: 'inherit',
  txFrom: '2026-08-05',
  txTo: '2026-08-11',
  txChangeType: 'all',
  txUser: 'all',
  versionKey: null,
};

let claimFilter = 'all';
let claimDrawerOpen = false;
let claimStageTab = null;
let claimExceptionPanel = null;
let claimExceptionNotice = null;
let lastClaimId = null;
let weights = getWeights();
let weightDraft = { ...weights };
let configFeedback = null;

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

  const claims = scoreAllClaims(weights);

  if (route === 'queue') {
    destroyChart();
    renderQueue(root, session, claims, queueState, (next) => {
      queueState = next;
      render();
    });
  } else if (route === 'claim') {
    destroyChart();
    const id = parts.slice(1).join('/');
    if (id !== lastClaimId) {
      lastClaimId = id;
      claimFilter = 'all';
      claimDrawerOpen = false;
      claimStageTab = session.role === 'surveyor' ? 'assessment' : null;
      claimExceptionPanel = null;
      claimExceptionNotice = null;
    }
    const claim = claims.find((c) => c.id === id);
    renderClaimDetail(
      root,
      session,
      claim,
      claimFilter,
      (f, opts = {}) => {
        claimFilter = f === 'cant_evaluate' ? 'fail' : f;
        claimDrawerOpen = !!opts.drawerOpen;
        if (opts.selectedStage !== undefined) claimStageTab = opts.selectedStage;
        if (opts.exceptionPanel !== undefined) claimExceptionPanel = opts.exceptionPanel;
        if (opts.exceptionNotice !== undefined) claimExceptionNotice = opts.exceptionNotice;
        render();
      },
      {
        drawerOpen: claimDrawerOpen,
        selectedStage: claimStageTab,
        exceptionPanel: claimExceptionPanel,
        exceptionNotice: claimExceptionNotice,
      }
    );
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
    renderReport(root, session, claims, reportState, (next) => {
      reportState = next;
      render();
    });
  } else if (route === 'config') {
    destroyChart();
    if (!canAccess(session.role, 'config')) {
      location.hash = '#/queue';
      return;
    }
    renderConfig(root, session);
    // Refresh weights from config store after config interactions
    weights = getWeights();
    weightDraft = { ...weights };
  } else {
    location.hash = session ? homeRouteForRole(session.role) : '#/login';
    return;
  }

  bindGlobalActions();
}

window.addEventListener('hashchange', () => {
  const { parts } = parseRoute();
  if (parts[0] !== 'claim') {
    claimFilter = 'all';
    claimDrawerOpen = false;
    claimStageTab = null;
    claimExceptionPanel = null;
    claimExceptionNotice = null;
    lastClaimId = null;
  }
  render();
});

if (!location.hash) {
  const session = getSession();
  location.hash = session ? homeRouteForRole(session.role) : '#/login';
} else {
  render();
}

window.addEventListener('load', render);
