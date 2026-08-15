import { USERS, LOGIN_USERS, ROLE_LABELS } from '../data.js';
import { brandMark } from '../components.js';
import { authenticate, setSession } from '../state.js';
import { homeRouteForRole } from '../scoring.js';

export function renderLogin(root, { error = '', ssoOpen = false } = {}) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        ${brandMark({ iconSize: 20, logoHeight: 30 })}
        ${error ? `<div class="login-error">${error}</div>` : ''}
        <form id="login-form" autocomplete="on">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" required placeholder="e.g. claim.user" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="Enter password" />
          </div>
          <label class="checkbox-row">
            <input type="checkbox" id="keep" name="keep" checked />
            Keep me signed in for this session
          </label>
          <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>

        <div class="login-divider"><span>or</span></div>

        <button class="btn btn-sso btn-block" type="button" data-action="sso">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3l8 4v5c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V7l8-4z" stroke="currentColor" stroke-width="1.6"/>
            <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Continue with SSO
        </button>

        <div class="demo-accounts">
          <h3>Demo accounts</h3>
          <div class="demo-list">
            ${LOGIN_USERS.map(
              (u) => `
              <button type="button" class="demo-chip" data-user="${u.username}" data-pass="${u.password}">
                <span class="role">${ROLE_LABELS[u.role]}</span>
                <span class="creds">${u.username} / ${u.password}</span>
              </button>
            `
            ).join('')}
          </div>
        </div>
      </div>

      ${
        ssoOpen
          ? `
        <div class="modal-backdrop" data-action="close-sso">
          <div class="modal-card" role="dialog" aria-labelledby="sso-title" onclick="event.stopPropagation()">
            <h2 id="sso-title">Sign in with SSO</h2>
            <p class="modal-copy">Select your organisation identity to continue. Demo mode maps each persona to an SSO profile.</p>
            <div class="sso-persona-list">
              ${LOGIN_USERS.map(
                (u) => `
                <button type="button" class="sso-persona" data-sso-user="${u.username}">
                  <span class="persona-avatar">${u.initials}</span>
                  <span>
                    <strong>${u.name}</strong>
                    <small>${ROLE_LABELS[u.role]} · ${u.username}@azentio.demo</small>
                  </span>
                </button>
              `
              ).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-block" data-action="close-sso">Cancel</button>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  root.querySelectorAll('.demo-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelector('#username').value = btn.dataset.user;
      root.querySelector('#password').value = btn.dataset.pass;
    });
  });

  root.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = root.querySelector('#username').value;
    const password = root.querySelector('#password').value;
    const keep = root.querySelector('#keep').checked;
    const user = authenticate(username, password);
    if (!user) {
      renderLogin(root, { error: 'Invalid username or password. Try a demo account below.' });
      return;
    }
    setSession(user, keep);
    location.hash = homeRouteForRole(user.role);
  });

  root.querySelectorAll('[data-action="sso"]').forEach((btn) => {
    btn.addEventListener('click', () => renderLogin(root, { ssoOpen: true }));
  });
  root.querySelectorAll('[data-action="close-sso"]').forEach((btn) => {
    btn.addEventListener('click', () => renderLogin(root));
  });
  root.querySelectorAll('[data-sso-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = USERS.find((u) => u.username === btn.dataset.ssoUser);
      if (!user) return;
      setSession(user, true);
      location.hash = homeRouteForRole(user.role);
    });
  });
}
