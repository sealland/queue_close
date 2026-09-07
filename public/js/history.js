const errorEl = document.getElementById('error');
const tbody = document.getElementById('history-body');
const listEl = document.getElementById('history-list');
const lastUpdateEl = document.getElementById('last-update');
const countEl = document.getElementById('count');
const btnSearch = document.getElementById('btn-search');
const dateFrom = document.getElementById('date-from');
const dateTo = document.getElementById('date-to');
const statusFilter = document.getElementById('status-filter');

let historyRows = [];

function renderTableRows(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">${renderEmptyState('ไม่พบข้อมูล', 'ลองเปลี่ยนช่วงวันที่หรือสถานะ')}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((row, index) => {
      const status = formatStatus(row.visit_Status, row.OutTime);
      return `
        <tr data-index="${index}">
          <td class="queue-no">${escapeHtml(row.QueueNo)}</td>
          <td>${escapeHtml(formatLicense(row.CARLICENSE, row.CAR_PROVINCE))}</td>
          <td>${escapeHtml(row.AR_NAME || '-')}</td>
          <td><span class="${status.badgeClass}">${escapeHtml(status.text)}</span></td>
          <td>${escapeHtml(formatTime(row.VisitTime))}</td>
          <td>${escapeHtml(formatTime(row.OutTime))}</td>
          <td class="actions">
            <button class="btn btn-secondary btn-sm btn-edit" type="button">แก้ไข</button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', handleEdit);
  });
}

function renderCardRows(rows) {
  if (!rows.length) {
    listEl.innerHTML = renderEmptyState('ไม่พบข้อมูล', 'ลองเปลี่ยนช่วงวันที่หรือสถานะ');
    return;
  }

  listEl.innerHTML = rows
    .map((row, index) => {
      const status = formatStatus(row.visit_Status, row.OutTime);
      return `
        <article class="queue-card" data-index="${index}">
          <div class="queue-card__left">
            <div class="queue-card__no">${escapeHtml(row.QueueNo)}</div>
            <div class="queue-card__body">
              <div class="queue-card__license">${escapeHtml(formatLicense(row.CARLICENSE, row.CAR_PROVINCE))}</div>
              <div class="queue-card__meta">
                <span class="${status.badgeClass}">${escapeHtml(status.text)}</span>
              </div>
              <div class="queue-card__extra">
                <span>เข้า ${escapeHtml(formatTime(row.VisitTime))}</span>
                <span>ออก ${escapeHtml(formatTime(row.OutTime))}</span>
              </div>
              ${renderCustomerExtra(row)}
            </div>
          </div>
          <div class="queue-card__actions">
            <button class="btn btn-secondary btn-sm btn-edit" type="button">แก้ไข</button>
          </div>
        </article>
      `;
    })
    .join('');

  listEl.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', handleEdit);
  });
}

function renderRows(rows) {
  historyRows = rows;
  renderTableRows(rows);
  renderCardRows(rows);
}

function handleEdit(e) {
  const el = e.target.closest('[data-index]');
  const row = historyRows[Number(el.dataset.index)];
  if (!row) return;
  openEditModal(row, loadHistory);
}

async function loadHistory() {
  hideError(errorEl);
  btnSearch.disabled = true;

  const params = new URLSearchParams({
    status: statusFilter.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value,
  });

  try {
    const rows = await apiFetch(`/api/queue/history?${params}`);
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
    btnSearch.disabled = false;
  }
}

btnSearch.addEventListener('click', loadHistory);

dateFrom.value = todayISO();
dateTo.value = todayISO();

loadHistory();
