import api from './api.js';

// ── State ──────────────────────────────────────────────────────────
let calendar;
let resources = [];          // S_Resource[]
let resourceTypes = [];      // S_ResourceType[]
let statusList = [];         // AD_Ref_List[] {Value, Name, Description(color)}
let assignments = [];        // cached assignments for current view range
let selectedResources = new Set();
let showCancelled = false;
let editingAssignment = null;

// Resource colors (auto-assigned)
const RESOURCE_COLORS = ['#4285f4','#34a853','#fbbc04','#ea4335','#8e24aa','#00acc1','#ff7043','#5c6bc0'];

// Service presets: name → default duration in minutes
const SERVICE_PRESETS = [
  { name: '諮詢', minutes: 15 },
  { name: '洗牙', minutes: 30 },
  { name: '補牙', minutes: 30 },
  { name: '根管治療', minutes: 60 },
  { name: '植牙', minutes: 90 },
  { name: '矯正回診', minutes: 30 },
  { name: '拔牙', minutes: 45 },
  { name: '其他', minutes: 30 },
];

const TERMINAL_STATUSES = ['CXL', 'ABS'];

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  api.init();
  try {
    const data = await api.getInit();
    resourceTypes = data.resourceTypes || [];
    resources = data.resources || [];
    statusList = data.statusList || [];
    resources.forEach((r, i) => { r._color = RESOURCE_COLORS[i % RESOURCE_COLORS.length]; });
    // resources default: none selected
    renderResourcePanel();
    renderStatusLegend();
    renderServiceOptions();
    renderStatusOptions();
    initCalendar();
    initSearch();
    initDialog();
    initShowCancelledToggle();
  } catch (e) {
    toast('載入失敗：' + (e.message || e), 'error');
  }
}

// ── Calendar ───────────────────────────────────────────────────────
function initCalendar() {
  const el = document.getElementById('calendarContainer');
  calendar = new FullCalendar.Calendar(el, {
    initialView: 'timeGridWeek',
    locale: 'zh-tw',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay',
    },
    buttonText: { month: '月', week: '週', day: '日', today: '今天', list: '列表' },
    slotDuration: '00:15:00',
    slotMinTime: '09:00:00',
    slotMaxTime: '18:00:00',
    allDaySlot: false,
    nowIndicator: true,
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: true,
    selectable: true,
    height: '100%',
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },

    datesSet: (info) => loadAssignments(info.startStr, info.endStr),
    select: (info) => openDialog(null, info.startStr, info.endStr),
    eventClick: (info) => openDialog(info.event.extendedProps._assignment),
    eventDrop: (info) => handleEventMove(info),
    eventResize: (info) => handleEventMove(info),
  });
  calendar.render();
}

async function loadAssignments(start, end) {
  const rangeStart = start.slice(0, 10);
  const rangeEnd = end.slice(0, 10);
  try {
    assignments = await api.getEvents(rangeStart, rangeEnd);
    renderEvents();
  } catch (e) {
    toast('查詢預約失敗', 'error');
  }
}

function renderEvents() {
  calendar.removeAllEvents();
  const visible = assignments.filter(a => {
    if (!selectedResources.has(getResourceId(a))) return false;
    if (!showCancelled && TERMINAL_STATUSES.includes(getStatus(a))) return false;
    return true;
  });
  visible.forEach(a => {
    const res = resources.find(r => r.id === getResourceId(a));
    const status = getStatus(a);
    const statusDef = statusList.find(s => s.Value === status);
    const color = statusDef?.Description || res?._color || '#999';
    const isTerminal = TERMINAL_STATUSES.includes(status);
    calendar.addEvent({
      id: String(a.id),
      title: a.Name || '',
      start: a.AssignDateFrom,
      end: a.AssignDateTo,
      backgroundColor: color,
      borderColor: color,
      textColor: '#fff',
      classNames: isTerminal ? ['event-cancelled'] : [],
      extendedProps: { _assignment: a },
    });
  });
}

// ── Event drag/resize ──────────────────────────────────────────────
async function handleEventMove(info) {
  const a = info.event.extendedProps._assignment;
  const newStart = info.event.startStr;
  const newEnd = info.event.endStr;
  const resId = getResourceId(a);
  const resType = getResourceTypeFor(resId);
  if (resType?.IsSingleAssignment && hasConflict(resId, newStart, newEnd, a.id)) {
    info.revert();
    toast('該時段已有預約，無法移動', 'error');
    return;
  }
  try {
    await api.updateAssignment(a.id, { AssignDateFrom: newStart, AssignDateTo: newEnd });
    a.AssignDateFrom = newStart;
    a.AssignDateTo = newEnd;
    // Sync grouped assignments
    const groupId = parseDesc(a).group_id;
    if (groupId) await syncGroupTime(groupId, a.id, newStart, newEnd);
    toast('預約時間已更新');
  } catch (e) {
    info.revert();
    toast('更新失敗', 'error');
  }
}

async function syncGroupTime(groupId, excludeId, start, end) {
  const grouped = assignments.filter(a => parseDesc(a).group_id === groupId && a.id !== excludeId);
  for (const ga of grouped) {
    try {
      await api.updateAssignment(ga.id, { AssignDateFrom: start, AssignDateTo: end });
      ga.AssignDateFrom = start;
      ga.AssignDateTo = end;
    } catch (_) { /* best effort */ }
  }
  renderEvents();
}

// ── Conflict detection ─────────────────────────────────────────────
function hasConflict(resourceId, start, end, excludeId) {
  return assignments.some(a =>
    getResourceId(a) === resourceId &&
    a.id !== excludeId &&
    a.AssignDateFrom < end &&
    a.AssignDateTo > start &&
    !TERMINAL_STATUSES.includes(getStatus(a))
  );
}

// ── Dialog ─────────────────────────────────────────────────────────
function initDialog() {
  document.getElementById('dlgCancel').onclick = closeDialog;
  document.getElementById('dialogOverlay').onclick = (e) => { if (e.target === e.currentTarget) closeDialog(); };
  document.getElementById('dlgSave').onclick = saveDialog;
  document.getElementById('dlgDelete').onclick = cancelAppointment;
  document.getElementById('dlgCopyNext').onclick = copyToNextWeek;
  document.getElementById('dlgCreateBill').onclick = createBill;
  document.getElementById('dlgService').onchange = onServiceChange;
  document.getElementById('dlgBpSearch').oninput = debounce(onBpSearch, 300);
}

function openDialog(assignment, start, end) {
  editingAssignment = assignment;
  const dlg = document.getElementById('dialogOverlay');
  const title = document.getElementById('dialogTitle');
  const deleteBtn = document.getElementById('dlgDelete');
  const copyBtn = document.getElementById('dlgCopyNext');
  const billBtn = document.getElementById('dlgCreateBill');
  const conflictWarn = document.getElementById('dlgConflictWarning');
  const bpInfo = document.getElementById('dlgBpInfo');
  conflictWarn.style.display = 'none';
  bpInfo.style.display = 'none';

  if (assignment) {
    title.textContent = '編輯預約';
    deleteBtn.style.display = '';
    copyBtn.style.display = '';
    const desc = parseDesc(assignment);
    const status = getStatus(assignment);
    const hasBill = !!desc.order_id;
    billBtn.style.display = (status === 'DON' && !hasBill) ? '' : 'none';
    document.getElementById('dlgName').value = assignment.Name || '';
    document.getElementById('dlgDate').value = assignment.AssignDateFrom?.slice(0, 10) || '';
    document.getElementById('dlgStart').value = assignment.AssignDateFrom?.slice(11, 16) || '';
    document.getElementById('dlgEnd').value = assignment.AssignDateTo?.slice(11, 16) || '';
    document.getElementById('dlgStatus').value = status || 'SCH';
    document.getElementById('dlgNotes').value = desc.notes || '';
    document.getElementById('dlgBpId').value = getBpId(assignment) || '';
    document.getElementById('dlgBpSearch').value = '';
    // Show BP info if linked
    if (getBpId(assignment)) loadBpInfo(getBpId(assignment));
    // Render resource checkboxes (show which resources are in this group)
    renderDlgResources(assignment);
  } else {
    title.textContent = '新增預約';
    deleteBtn.style.display = 'none';
    copyBtn.style.display = 'none';
    billBtn.style.display = 'none';
    document.getElementById('dlgName').value = '';
    document.getElementById('dlgDate').value = start?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    document.getElementById('dlgStart').value = start?.slice(11, 16) || '09:00';
    document.getElementById('dlgEnd').value = end?.slice(11, 16) || '09:30';
    document.getElementById('dlgStatus').value = 'SCH';
    document.getElementById('dlgNotes').value = '';
    document.getElementById('dlgBpId').value = '';
    document.getElementById('dlgBpSearch').value = '';
    renderDlgResources(null);
  }
  dlg.style.display = 'flex';
}

function closeDialog() {
  document.getElementById('dialogOverlay').style.display = 'none';
  editingAssignment = null;
  document.getElementById('dlgBpResults').style.display = 'none';
}

function renderDlgResources(assignment) {
  const container = document.getElementById('dlgResources');
  const desc = assignment ? parseDesc(assignment) : {};
  const groupedIds = desc.group_id
    ? assignments.filter(a => parseDesc(a).group_id === desc.group_id).map(a => getResourceId(a))
    : assignment ? [getResourceId(assignment)] : [];

  container.innerHTML = resources.map(r => {
    const checked = assignment ? groupedIds.includes(r.id) : selectedResources.has(r.id);
    const type = assignment ? 'checkbox disabled' : 'checkbox';
    return `<label class="resource-item" style="display:block;margin:2px 0;">
      <input type="${type}" value="${r.id}" ${checked && !assignment ? 'checked' : ''} ${assignment && checked ? 'checked disabled' : ''} class="dlg-resource-cb">
      <span class="color-dot" style="background:${r._color}"></span> ${r.Name}
    </label>`;
  }).join('');
}

async function saveDialog() {
  const name = document.getElementById('dlgName').value.trim();
  const date = document.getElementById('dlgDate').value;
  const startTime = document.getElementById('dlgStart').value;
  const endTime = document.getElementById('dlgEnd').value;
  const status = document.getElementById('dlgStatus').value;
  const notes = document.getElementById('dlgNotes').value.trim();
  const bpId = document.getElementById('dlgBpId').value;
  const service = document.getElementById('dlgService').value;

  if (!name) { toast('請輸入姓名', 'error'); return; }
  if (!date || !startTime || !endTime) { toast('請填寫完整時段', 'error'); return; }

  const startISO = `${date}T${startTime}:00Z`;
  const endISO = `${date}T${endTime}:00Z`;

  if (editingAssignment) {
    // Update existing — server handles group sync
    try {
      await api.updateAssignment(editingAssignment.id, {
        name, status, date, startTime, endTime, notes,
      });
      toast('預約已更新');
    } catch (e) {
      toast('更新失敗：' + (e.message || e), 'error');
      return;
    }
  } else {
    // Create new
    const checkedResources = [...document.querySelectorAll('.dlg-resource-cb:checked')].map(cb => parseInt(cb.value));
    if (checkedResources.length === 0) { toast('請選擇至少一個資源', 'error'); return; }

    // Conflict check
    const conflictWarn = document.getElementById('dlgConflictWarning');
    for (const rid of checkedResources) {
      const resType = getResourceTypeFor(rid);
      if (resType?.IsSingleAssignment && hasConflict(rid, startISO, endISO, null)) {
        const res = resources.find(r => r.id === rid);
        conflictWarn.textContent = `⚠️ ${res?.Name || '資源'} 在此時段已有預約`;
        conflictWarn.style.display = 'block';
        return;
      }
    }
    conflictWarn.style.display = 'none';

    try {
      await api.bookAppointment({
        name, date, startTime, endTime, service, notes,
        resourceIds: checkedResources,
        bpartnerId: bpId ? parseInt(bpId) : 0,
      });
      // Auto-select booked resources so events are visible
      checkedResources.forEach(rid => {
        selectedResources.add(rid);
        const cb = document.querySelector(`.resource-cb[value="${rid}"]`);
        if (cb) cb.checked = true;
      });
      toast('預約已建立');
    } catch (e) {
      toast('建立失敗：' + (e.message || e), 'error');
      return;
    }
  }
  closeDialog();
  reloadCurrentView();
}

async function cancelAppointment() {
  if (!editingAssignment) return;
  if (!confirm('確定要取消此預約？')) return;
  try {
    const desc = parseDesc(editingAssignment);
    await api.updateAssignment(editingAssignment.id, {
      Description: JSON.stringify({ ...parseDesc(editingAssignment), status: 'CXL' })
    });
    if (desc.group_id) {
      const grouped = assignments.filter(a => parseDesc(a).group_id === desc.group_id && a.id !== editingAssignment.id);
      if (grouped.length > 0 && confirm(`此預約關聯 ${grouped.length} 個其他資源，是否一併取消？`)) {
        for (const ga of grouped) {
          await api.updateAssignment(ga.id, {
            Description: JSON.stringify({ ...parseDesc(ga), status: 'CXL' })
          });
        }
      }
    }
    toast('預約已取消');
    closeDialog();
    reloadCurrentView();
  } catch (e) {
    toast('取消失敗', 'error');
  }
}

async function copyToNextWeek() {
  if (!editingAssignment) return;
  const a = editingAssignment;
  const newStart = addDays(a.AssignDateFrom, 7);
  const newEnd = addDays(a.AssignDateTo, 7);
  const resId = getResourceId(a);
  const resType = getResourceTypeFor(resId);
  if (resType?.IsSingleAssignment && hasConflict(resId, newStart, newEnd, null)) {
    toast('下週同時段已有預約', 'error');
    return;
  }
  try {
    const desc = parseDesc(a);
    delete desc.order_id;
    const data = {
      AD_Org_ID: api.getOrgId(),
      S_Resource_ID: resId,
      Name: a.Name,
      Description: JSON.stringify(desc),
      AssignDateFrom: newStart,
      AssignDateTo: newEnd,
      X_AppointmentStatus: 'SCH',
      Qty: a.Qty || 1,
    };
    const bpId = getBpId(a);
    if (bpId) data.C_BPartner_ID = bpId;
    await api.createAssignment(data);
    toast('已複製到下週');
    closeDialog();
    reloadCurrentView();
  } catch (e) {
    toast('複製失敗', 'error');
  }
}

async function createBill() {
  if (!editingAssignment) return;
  const bpId = getBpId(editingAssignment);
  if (!bpId) { toast('請先關聯病患才能建立帳單', 'error'); return; }
  try {
    const resId = getResourceId(editingAssignment);
    const res = resources.find(r => r.id === resId);
    const productId = res?._productId;
    if (!productId) { toast('找不到資源對應的產品', 'error'); return; }
    const order = await api.createOrder({
      AD_Org_ID: api.getOrgId(),
      C_DocTypeTarget_ID: 132,
      IsSOTrx: true,
      C_BPartner_ID: bpId,
      M_Warehouse_ID: 103,
      M_PriceList_ID: 101,
      C_PaymentTerm_ID: 105,
      C_Currency_ID: 100,
      SalesRep_ID: 100,
      DateOrdered: editingAssignment.AssignDateFrom.slice(0, 10),
      DatePromised: editingAssignment.AssignDateFrom.slice(0, 10),
      DateAcct: editingAssignment.AssignDateFrom.slice(0, 10),
    });
    await api.createOrderLine({
      AD_Org_ID: api.getOrgId(),
      C_Order_ID: order.id,
      M_Product_ID: productId,
      S_ResourceAssignment_ID: editingAssignment.id,
      QtyEntered: 1,
      QtyOrdered: 1,
    });
    await api.completeOrder(order.id);
    const desc = parseDesc(editingAssignment);
    desc.order_id = order.id;
    await api.updateAssignment(editingAssignment.id, { Description: JSON.stringify(desc) });
    toast('帳單已建立並完成');
    closeDialog();
    reloadCurrentView();
  } catch (e) {
    toast('建立帳單失敗：' + (e.message || e), 'error');
  }
}

// ── Service preset ─────────────────────────────────────────────────
function renderServiceOptions() {
  const sel = document.getElementById('dlgService');
  SERVICE_PRESETS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = `${s.name} (${s.minutes}分)`;
    sel.appendChild(opt);
  });
}

function onServiceChange() {
  const name = document.getElementById('dlgService').value;
  const preset = SERVICE_PRESETS.find(s => s.name === name);
  if (!preset) return;
  const startTime = document.getElementById('dlgStart').value;
  if (!startTime) return;
  const [h, m] = startTime.split(':').map(Number);
  const endMin = h * 60 + m + preset.minutes;
  const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
  const endM = String(endMin % 60).padStart(2, '0');
  document.getElementById('dlgEnd').value = `${endH}:${endM}`;
}

// ── BPartner search ────────────────────────────────────────────────
async function onBpSearch() {
  const keyword = document.getElementById('dlgBpSearch').value.trim();
  const container = document.getElementById('dlgBpResults');
  if (keyword.length < 2) { container.style.display = 'none'; return; }
  try {
    const results = await api.searchBPartners(keyword);
    if (results.length === 0) { container.style.display = 'none'; return; }
    container.innerHTML = results.map(bp =>
      `<div class="search-result-item" data-id="${bp.id}" data-name="${bp.Name}" data-phone="${bp.Phone || ''}" data-email="${bp.EMail || ''}">${bp.Name}${bp.Phone ? ' 📞' + bp.Phone : ''}</div>`
    ).join('');
    container.style.display = 'block';
    container.querySelectorAll('.search-result-item').forEach(el => {
      el.onclick = () => {
        document.getElementById('dlgBpId').value = el.dataset.id;
        document.getElementById('dlgName').value = el.dataset.name;
        container.style.display = 'none';
        // Show contact info from search result
        const info = document.getElementById('dlgBpInfo');
        const parts = [];
        if (el.dataset.phone) parts.push(`📞 ${el.dataset.phone}`);
        if (el.dataset.email) parts.push(`✉️ ${el.dataset.email}`);
        if (parts.length > 0) {
          info.innerHTML = parts.join(' &nbsp;|&nbsp; ');
          info.style.display = 'block';
        }
      };
    });
  } catch (e) { console.error('BPartner search failed:', e); container.style.display = 'none'; }
}

async function loadBpInfo(bpId) {
  try {
    const bp = await api.getBPartner(bpId);
    const info = document.getElementById('dlgBpInfo');
    const parts = [];
    if (bp.Phone) parts.push(`📞 ${bp.Phone}`);
    if (bp.Phone2) parts.push(`📱 ${bp.Phone2}`);
    if (bp.EMail) parts.push(`✉️ ${bp.EMail}`);
    if (parts.length > 0) {
      info.innerHTML = parts.join(' &nbsp;|&nbsp; ');
      info.style.display = 'block';
    }
  } catch (_) { /* ignore */ }
}

// ── Sidebar: Resources ─────────────────────────────────────────────
function renderResourcePanel() {
  const panel = document.getElementById('resourcePanel');
  const byType = {};
  resources.forEach(r => {
    const typeId = r.S_ResourceType_ID?.id || r.S_ResourceType_ID;
    if (!byType[typeId]) byType[typeId] = [];
    byType[typeId].push(r);
  });
  let html = '';
  for (const [typeId, items] of Object.entries(byType)) {
    const typeName = resourceTypes.find(t => t.id === parseInt(typeId))?.Name || '其他';
    html += `<div style="margin-bottom:8px;"><strong>${typeName}</strong></div>`;
    items.forEach(r => {
      html += `<label class="resource-item">
        <input type="checkbox" value="${r.id}" class="resource-cb">
        <span class="color-dot" style="background:${r._color}"></span> ${r.Name}
      </label>`;
    });
  }
  panel.innerHTML = html;
  panel.querySelectorAll('.resource-cb').forEach(cb => {
    cb.onchange = () => {
      if (cb.checked) selectedResources.add(parseInt(cb.value));
      else selectedResources.delete(parseInt(cb.value));
      renderEvents();
    };
  });
}

// ── Sidebar: Status legend ─────────────────────────────────────────
function renderStatusLegend() {
  const panel = document.getElementById('statusLegend');
  panel.innerHTML = '<div style="margin-bottom:4px;"><strong>狀態圖例</strong></div>' +
    statusList.map(s =>
      `<div class="status-legend-item">
        <span class="color-dot" style="background:${s.Description || '#999'}"></span> ${s.Name}
      </div>`
    ).join('');
}

function renderStatusOptions() {
  const sel = document.getElementById('dlgStatus');
  sel.innerHTML = statusList.map(s =>
    `<option value="${s.Value}">${s.Name}</option>`
  ).join('');
}

// ── Sidebar: Search ────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  input.oninput = debounce(async () => {
    const keyword = input.value.trim();
    if (keyword.length < 2) { results.style.display = 'none'; return; }
    try {
      const data = await api.searchAssignments(keyword);
      if (data.length === 0) {
        results.innerHTML = '<div style="padding:8px;color:#999;">無結果</div>';
        results.style.display = 'block';
        return;
      }
      results.innerHTML = data.map(a => {
        const status = getStatus(a);
        const statusDef = statusList.find(s => s.Value === status);
        const color = statusDef?.Description || '#999';
        return `<div class="search-result-item" data-date="${a.AssignDateFrom?.slice(0, 10)}" data-id="${a.id}">
          <span class="color-dot" style="background:${color}"></span>
          <span>${a.AssignDateFrom?.slice(0, 10)} ${a.AssignDateFrom?.slice(11, 16)}</span>
          <strong>${a.Name}</strong>
        </div>`;
      }).join('');
      results.style.display = 'block';
      results.querySelectorAll('.search-result-item').forEach(el => {
        el.onclick = () => {
          calendar.gotoDate(el.dataset.date);
          results.style.display = 'none';
          input.value = '';
        };
      });
    } catch (_) { results.style.display = 'none'; }
  }, 300);
}

// ── Show cancelled toggle ──────────────────────────────────────────
function initShowCancelledToggle() {
  document.getElementById('showCancelled').onchange = (e) => {
    showCancelled = e.target.checked;
    renderEvents();
  };
}

// ── Helpers ────────────────────────────────────────────────────────
function getResourceId(a) {
  return a.S_Resource_ID?.id ?? a.S_Resource_ID;
}

function getStatus(a) {
  // Try AD column first, fallback to Description JSON
  const s = a.X_AppointmentStatus;
  if (s) return s?.id ?? s;
  return parseDesc(a).status || '';
}

function getBpId(a) {
  // Try AD column first, fallback to Description JSON
  const bp = a.C_BPartner_ID;
  if (bp) return bp?.id ?? bp;
  return parseDesc(a).bpartner_id || null;
}

function getResourceTypeFor(resourceId) {
  const res = resources.find(r => r.id === resourceId);
  if (!res) return null;
  const typeId = res.S_ResourceType_ID?.id ?? res.S_ResourceType_ID;
  return resourceTypes.find(t => t.id === typeId);
}

function parseDesc(a) {
  try { return JSON.parse(a.Description || '{}'); }
  catch { return {}; }
}

function addDays(isoStr, days) {
  const d = new Date(isoStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().replace(/\.\d{3}/, '');
}

function reloadCurrentView() {
  const view = calendar.view;
  loadAssignments(view.activeStart.toISOString(), view.activeEnd.toISOString());
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ── Boot ───────────────────────────────────────────────────────────
init();
