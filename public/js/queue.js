const REFRESH_INTERVAL = 5000;

const errorEl = document.getElementById('error');
const listEl = document.getElementById('queue-list');
const lastUpdateEl = document.getElementById('last-update');
const countEl = document.getElementById('count');
const btnRefresh = document.getElementById('btn-refresh');
const todayDateEl = document.getElementById('today-date');

let timer = null;
let queueRows = [];

if (todayDateEl) {
  todayDateEl.textContent = formatTodayDisplay();
}

function renderQueueCard(row, index, { showClose = true } = {}) {
  const status = formatStatus(row.visit_Status, row.OutTime);
  const closeBtn = showClose
    ? `<button class="btn btn-success btn-sm btn-close" type="button">
         <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
         ปิดจบคิว
       </button>`
    : '';

  return `
    <article class="queue-card" data-index="${index}">
      <div class="queue-card__left">
        <div class="queue-card__no">${escapeHtml(row.QueueNo)}</div>
        <div class="queue-card__body">
          <div class="queue-card__license">${escapeHtml(formatLicense(row.CARLICENSE, row.CAR_PROVINCE))}</div>
          <div class="queue-card__meta">
            <span class="${status.badgeClass}">${escapeHtml(status.text)}</span>
            <span class="queue-card__time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${escapeHtml(formatTime(row.VisitTime))}
            </span>
          </div>
          ${renderCustomerExtra(row)}
        </div>
      </div>
      <div class="queue-card__actions">
        <button class="btn btn-secondary btn-sm btn-edit" type="button">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          แก้ไข
        </button>
        ${closeBtn}
      </div>
    </article>
  `;
}

function bindCardActions(container) {
  container.querySelectorAll('.btn-close').forEach((btn) => {
    btn.addEventListener('click', handleClose);
  });
  container.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', handleEdit);
  });
}

function renderRows(rows) {
  queueRows = rows;

  if (!rows.length) {
    listEl.innerHTML = renderEmptyState('ไม่มีคิวที่รอปิดจบ', 'คิวทั้งหมดปิดจบแล้ว หรือยังไม่มีรายการวันนี้');
    return;
  }

  listEl.innerHTML = rows.map((row, i) => renderQueueCard(row, i)).join('');
  bindCardActions(listEl);
}

function handleEdit(e) {
  const card = e.target.closest('[data-index]');
  const row = queueRows[Number(card.dataset.index)];
  if (!row) return;
  openEditModal(row, loadQueue);
}

async function loadQueue() {
  hideError(errorEl);
  btnRefresh.disabled = true;
  try {
    const rows = await apiFetch('/api/queue/today');
    renderRows(rows);
    countEl.textContent = rows.length;
    lastUpdateEl.textContent = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (err) {
    showError(errorEl, `โหลดข้อมูลไม่สำเร็จ: ${err.message}`);
  } finally {
    btnRefresh.disabled = false;
  }
}

async function handleClose(e) {
  const card = e.target.closest('[data-index]');
  const row = queueRows[Number(card.dataset.index)];
  if (!row) return;

  const { SEQ: seq, Ship_point: ship_point, WADAT_IST: wadat_ist } = row;

  if (!confirm(`ปิดจบคิวเลข ${row.QueueNo} ?`)) return;

  const btn = e.target.closest('.btn-close');
  btn.disabled = true;
  btn.innerHTML = 'กำลังปิด...';

  try {
    await apiFetch('/api/queue/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq, ship_point, wadat_ist }),
    });
    await loadQueue();
  } catch (err) {
    alert(`ปิดจบคิวไม่สำเร็จ: ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ปิดจบคิว`;
  }
}

btnRefresh.addEventListener('click', loadQueue);

requireCurrentUser()
  .then(() => {
    loadQueue();
    timer = setInterval(loadQueue, REFRESH_INTERVAL);
  })
  .catch(() => {
    showAuthGate();
  });

