let editCurrentRow = null;
let editOnSaved = null;

function initEditModal() {
  if (document.getElementById('edit-modal')) return;

  document.body.insertAdjacentHTML(
    'beforeend',
    `
    <div id="edit-modal" class="modal hidden">
      <div class="modal-content" role="dialog" aria-labelledby="edit-modal-title">
        <div class="modal-content__header">
          <h2 id="edit-modal-title">
            แก้ไขข้อมูลคิว
            <span class="modal-queue-no" id="edit-queue-no"></span>
          </h2>
          <button type="button" class="modal-close-btn" id="edit-cancel" aria-label="ปิด">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form id="edit-form">
          <label class="field">
            <span class="field__label">ชื่อลูกค้า</span>
            <input class="field__input" type="text" id="edit-ar-name" maxlength="100" autocomplete="off" placeholder="ระบุชื่อลูกค้า">
          </label>
          <label class="field">
            <span class="field__label">ทะเบียนรถ</span>
            <input class="field__input" type="text" id="edit-carlicense" maxlength="20" autocomplete="off" placeholder="เช่น กข-1234">
          </label>
          <label class="field">
            <span class="field__label">เบอร์โทร</span>
            <input class="field__input" type="tel" id="edit-telephone" maxlength="30" autocomplete="off" placeholder="08x-xxx-xxxx">
          </label>
          <label class="field">
            <span class="field__label">หมายเหตุพนักงานขาย</span>
            <textarea class="field__input" id="edit-sales-reason" rows="3" maxlength="300" placeholder="บันทึกหมายเหตุเพิ่มเติม"></textarea>
          </label>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary" id="edit-save">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
    `
  );

  document.getElementById('edit-form').addEventListener('submit', handleEditSave);
  document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeEditModal();
  });
}

function openEditModal(row, onSaved) {
  editCurrentRow = row;
  editOnSaved = onSaved;

  document.getElementById('edit-queue-no').textContent = row.QueueNo;
  document.getElementById('edit-carlicense').value = row.CARLICENSE || '';
  document.getElementById('edit-ar-name').value = row.AR_NAME || '';
  document.getElementById('edit-telephone').value = row.Telephone || '';
  document.getElementById('edit-sales-reason').value = row.SalesReason || '';
  document.getElementById('edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('edit-ar-name').focus();
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  editCurrentRow = null;
  editOnSaved = null;
}

async function handleEditSave(e) {
  e.preventDefault();
  if (!editCurrentRow) return;

  const saveBtn = document.getElementById('edit-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'กำลังบันทึก...';

  try {
    await apiFetch('/api/queue/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seq: editCurrentRow.SEQ,
        ship_point: editCurrentRow.Ship_point,
        wadat_ist: editCurrentRow.WADAT_IST,
        carlicense: document.getElementById('edit-carlicense').value.trim(),
        ar_name: document.getElementById('edit-ar-name').value.trim(),
        telephone: document.getElementById('edit-telephone').value.trim(),
        sales_reason: document.getElementById('edit-sales-reason').value.trim(),
      }),
    });

    closeEditModal();
    if (editOnSaved) editOnSaved();
  } catch (err) {
    alert(`บันทึกไม่สำเร็จ: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'บันทึก';
  }
}

initEditModal();
