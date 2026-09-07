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

async function apiFetch(url, options) {
  const res = await fetch(url, options);
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
