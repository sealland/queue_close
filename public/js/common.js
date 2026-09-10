function parseDbDateTime(dt) {
  if (!dt) return null;
  const match = String(dt).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: match[2],
    day: match[3],
    hour: match[4] || '00',
    minute: match[5] || '00',
    second: match[6] || '00',
  };
}

function formatTime(dt) {
  const p = parseDbDateTime(dt);
  if (!p) return '-';
  const buddhistYear = p.year + 543;
  return `${p.day}/${p.month}/${buddhistYear} ${p.hour}:${p.minute}:${p.second}`;
}

function formatLicense(license, province) {
  const parts = [license, province].filter(Boolean);
  return parts.length ? parts.join(' ') : '-';
}

function formatStatus(status, outTime) {
  if (outTime) return { text: 'ปิดจบแล้ว', badgeClass: 'badge badge--closed' };
  return { text: status || 'รอดำเนินการ', badgeClass: 'badge badge--open' };
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCustomerExtra(row) {
  const parts = [];
  if (row.AR_NAME) parts.push(`<span><strong>ลูกค้า</strong> ${escapeHtml(row.AR_NAME)}</span>`);
  if (row.Telephone) parts.push(`<span><strong>โทร</strong> ${escapeHtml(row.Telephone)}</span>`);
  if (row.SalesReason) parts.push(`<span><strong>หมายเหตุ</strong> ${escapeHtml(row.SalesReason)}</span>`);
  if (!parts.length) return '';
  return `<div class="queue-card__extra">${parts.join('')}</div>`;
}

function renderEmptyState(title, desc) {
  return `
    <div class="empty-state">
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
      <p class="empty-state__title">${escapeHtml(title)}</p>
      ${desc ? `<p class="empty-state__desc">${escapeHtml(desc)}</p>` : ''}
    </div>
  `;
}

function formatTodayDisplay() {
  const now = new Date();
  return now.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(el) {
  el.classList.add('hidden');
}

const CURRENT_USER_KEY = 'queue_close_current_user';
let currentEmployee = null;

function getBasePath() {
  if (typeof window !== 'undefined' && window.__BASE_PATH__ != null) {
    return String(window.__BASE_PATH__).replace(/\/+$/, '');
  }
  return '';
}

function appPath(url) {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const [pathPart, query] = String(url).split('?');
  let path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const base = getBasePath();
  if (base && (path === base || path.startsWith(`${base}/`))) {
    return `${path}${query ? `?${query}` : ''}`;
  }
  return `${base}${path}${query ? `?${query}` : ''}`;
}

function getCurrentUserCode() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = (params.get('currentUser') || '').trim();
  if (fromUrl) {
    sessionStorage.setItem(CURRENT_USER_KEY, fromUrl);
    return fromUrl;
  }
  return (sessionStorage.getItem(CURRENT_USER_KEY) || '').trim();
}

function withCurrentUser(url) {
  const code = getCurrentUserCode();
  const resolved = appPath(url);
  if (!code) return resolved;
  const u = new URL(resolved, window.location.origin);
  u.searchParams.set('currentUser', code);
  return u.pathname + u.search + u.hash;
}

function syncNavLinks() {
  document.querySelectorAll('a.nav-link').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http')) return;
    a.setAttribute('href', withCurrentUser(href));
  });
}

function formatEmployeeDisplayName(name) {
  if (!name) return '-';
  // Pattern: (ชื่อเล่น) ชื่อ นามสกุล → ตัด (ชื่อเล่น) ออก
  return String(name)
    .replace(/^\s*\([^)]*\)\s*/, '')
    .trim() || String(name).trim();
}

function renderUserChip() {
  const actions = document.querySelector('.page-header__actions');
  const mobileHeader = document.querySelector('.mobile-header');
  if (!currentEmployee) return;

  const displayName = formatEmployeeDisplayName(currentEmployee.emp_name);
  const initial = displayName.charAt(0) || '?';

  const chipHtml = `
    <div class="user-chip" title="${escapeHtml(displayName)}">
      <div class="user-chip__avatar">${escapeHtml(initial)}</div>
      <div class="user-chip__meta">
        <div class="user-chip__name">${escapeHtml(displayName)}</div>
      </div>
    </div>
  `;

  if (actions && !document.getElementById('user-chip')) {
    const wrap = document.createElement('div');
    wrap.id = 'user-chip';
    wrap.innerHTML = chipHtml;
    actions.prepend(wrap.firstElementChild);
  }

  if (mobileHeader && !document.getElementById('user-chip-mobile')) {
    const wrap = document.createElement('div');
    wrap.id = 'user-chip-mobile';
    wrap.innerHTML = chipHtml.replace('user-chip', 'user-chip user-chip--mobile');
    mobileHeader.appendChild(wrap.firstElementChild);
  }
}

function showAuthGate() {
  document.body.innerHTML = `
    <div class="auth-gate">
      <div class="auth-gate__card">
        <div class="auth-gate__logo">Q</div>
        <h1>ต้องระบุรหัสพนักงาน</h1>
      </div>
    </div>
  `;
}

async function requireCurrentUser() {
  const code = getCurrentUserCode();
  if (!code) {
    showAuthGate();
    throw new Error('missing currentUser');
  }

  syncNavLinks();

  // Keep currentUser visible in URL
  const url = new URL(window.location.href);
  if (url.searchParams.get('currentUser') !== code) {
    url.searchParams.set('currentUser', code);
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  const me = await apiFetch(`/api/auth/me?currentUser=${encodeURIComponent(code)}`);
  currentEmployee = {
    emp_code: me.emp_code,
    emp_name: me.emp_name,
  };
  renderUserChip();
  return currentEmployee;
}

async function apiFetch(url, options = {}) {
  const code = getCurrentUserCode();
  const headers = new Headers(options.headers || {});
  if (code) headers.set('X-Current-User', code);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(appPath(url), { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
