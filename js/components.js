export function brandIcon(size = 22) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.4-2.9 8.3-7 9.5-4.1-1.2-7-5.1-7-9.5V6l7-3z" stroke="currentColor" stroke-width="1.7" fill="rgba(255,255,255,0.12)"/>
      <circle cx="12" cy="11" r="3.2" stroke="currentColor" stroke-width="1.6"/>
      <path d="M14.3 13.3L16.5 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;
}

/** Azentio wordmark — local asset with CDN fallback */
export function azentioLogo(height = 28) {
  return `
    <img
      class="azentio-logo"
      src="assets/azentio-logo.svg"
      alt="Azentio"
      height="${height}"
      onerror="this.onerror=null;this.src='https://www.azentio.com/wp-content/uploads/2024/12/logo.svg'"
    />
  `;
}

export function brandMark({ iconSize = 18, logoHeight = 26, showProduct = true } = {}) {
  return `
    <div class="brand-mark">
      ${azentioLogo(logoHeight)}
      <span class="brand-divider" aria-hidden="true"></span>
      <div class="brand-icon">${brandIcon(iconSize)}</div>
      ${showProduct ? `<div class="brand-name">Claim Intel</div>` : ''}
    </div>
  `;
}

export function iconCheck() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function iconX() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

export function iconAlert() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.3 4.3L2.8 17.2A2 2 0 004.5 20h15a2 2 0 001.7-2.8L13.7 4.3a2 2 0 00-3.4 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function iconLock() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

export function iconBack() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function iconClose() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

export function iconChevron() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function renderShell(session, active, content, { showMobileNav = true } = {}) {
  const links = [
    { hash: '#/queue', label: 'Claims', feature: 'queue' },
    { hash: '#/dashboard', label: 'Dashboard', feature: 'dashboard' },
    { hash: '#/report', label: 'Report', feature: 'report' },
    { hash: '#/config', label: 'Configuration', feature: 'config' },
  ];

  const nav = links
    .filter((l) => {
      if (l.feature === 'dashboard' || l.feature === 'report') {
        return session.role === 'claim_head' || session.role === 'admin' || session.role === 'fiu';
      }
      if (l.feature === 'config') return session.role === 'admin' || session.role === 'fiu';
      return l.feature === 'queue';
    })
    .map(
      (l) =>
        `<a class="nav-link ${active === l.hash ? 'active' : ''}" href="${l.hash}">${l.label}</a>`
    )
    .join('');

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          ${brandMark({ iconSize: 16, logoHeight: 24 })}
          <nav class="nav-links">${nav}</nav>
        </div>
        <div class="topbar-right">
          <div class="persona-badge" title="Active persona">
            <div class="persona-avatar">${session.initials}</div>
            <div class="persona-meta">
              <span class="name">${session.name}</span>
              <span class="role" data-role-label></span>
            </div>
          </div>
          <button class="btn btn-ghost" type="button" data-action="logout">Sign out</button>
        </div>
      </header>
      ${showMobileNav ? `<div class="mobile-nav">${nav}</div>` : ''}
      <main class="main">${content}</main>
    </div>
  `;
}
