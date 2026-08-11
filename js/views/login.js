import { USERS, ROLE_LABELS } from './data.js';
import { brandIcon } from './components.js';
import { authenticate, setSession } from './state.js';
import { homeRouteForRole } from './scoring.js';

export function renderLogin(root, { error = '' } = {}) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="brand-mark">
          <div class="brand-icon">${brandIcon(22)}</div>
          <div class="brand-name">Claim Intel</div>
        </div>
        <p class="login-helper">Sign in to view fraud risk scoring. Your access is set by your licence.</p>
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
        <div class="demo-accounts">
          <h3>Demo accounts</h3>
          <div class="demo-list">
            ${USERS.map(
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
}
