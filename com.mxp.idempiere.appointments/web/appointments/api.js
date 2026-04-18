const REST_BASE = `${window.location.origin}/api/v1`;
const APPT_BASE = `${window.location.origin}/appointment`;
let token = null;
let tokenResolve = null;
let tokenPayload = null;

function init() {
  const h = window.location.hash;
  if (h) {
    const raw = h.startsWith('#token=') ? h.substring(7) : h.substring(1);
    token = decodeURIComponent(raw);
    tokenPayload = decodeJwtPayload(token);
  }
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'token-refreshed') {
      token = e.data.token;
      tokenPayload = decodeJwtPayload(token);
      if (tokenResolve) { tokenResolve(); tokenResolve = null; }
    }
  });
}

function decodeJwtPayload(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return {};
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

function getOrgId() { return tokenPayload?.AD_Org_ID ?? 0; }
function getClientId() { return tokenPayload?.AD_Client_ID ?? 0; }

async function refreshToken() {
  return new Promise((resolve) => {
    tokenResolve = resolve;
    window.parent.postMessage({ type: 'refresh-token' }, '*');
    setTimeout(() => { if (tokenResolve) { tokenResolve(); tokenResolve = null; } }, 10000);
  });
}

// ── REST API (for write operations that need standard iDempiere endpoints) ──
async function restApi(path, opts = {}, retry = true) {
  const res = await fetch(`${REST_BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (res.status === 401 && retry) { await refreshToken(); return restApi(path, opts, false); }
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.title || res.statusText);
  return json;
}

// ── Custom API (aggregated endpoints, no auth needed — same origin) ──
async function apptApi(path) {
  const res = await fetch(`${APPT_BASE}/${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function post(path, data) { return restApi(path, { method: 'POST', body: JSON.stringify(data) }); }
function put(path, data) { return restApi(path, { method: 'PUT', body: JSON.stringify(data) }); }
function del(path) { return restApi(path, { method: 'DELETE' }); }

// ── Aggregated read endpoints (1 call instead of many) ──

/** Single call: returns { resourceTypes, resources, statusList } */
async function getInit() {
  return apptApi('init');
}

/** Single call: returns { events } for all resources in date range */
async function getEvents(rangeStart, rangeEnd) {
  const data = await apptApi(`events?start=${rangeStart}&end=${rangeEnd}`);
  return data.events || [];
}

// ── Write operations ──

/** Book appointment(s) atomically via custom API */
async function bookAppointment(data) {
  const res = await fetch(`${APPT_BASE}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

/** Add a resource to an existing appointment group */
async function groupAddResource(assignmentId, resourceId) {
  const res = await fetch(`${APPT_BASE}/group-add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId, resourceId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function createAssignment(data) { return post('models/S_ResourceAssignment', data); }
function updateAssignment(id, data) {
  return fetch(`${APPT_BASE}/update?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
}
function deleteAssignment(id) { return del(`models/S_ResourceAssignment/${id}`); }

// ── Search (still use REST API) ──

function searchAssignments(keyword) {
  return restApi(`models/S_ResourceAssignment?$filter=contains(Name,'${keyword}')&$orderby=AssignDateFrom desc&$top=20`).then(r => r?.records || []);
}

function searchBPartners(keyword) {
  return apptApi(`bpartners?q=${encodeURIComponent(keyword)}`).then(r => r?.results || []);
}

function getBPartner(id) {
  // Single BP lookup reuses the search endpoint
  return apptApi(`bpartners?q=`).then(() => null); // TODO: add /bpartners/{id} if needed
}

// ── Billing (still use REST API) ──

function createOrder(data) { return post('models/C_Order', data); }
function createOrderLine(data) { return post('models/C_OrderLine', data); }
function completeOrder(orderId) {
  return post('processes/c_order-process', { 'Record_ID': orderId, 'DocAction': 'CO' });
}

export default {
  init, getOrgId, getClientId,
  getInit, getEvents,
  bookAppointment, groupAddResource,
  createAssignment, updateAssignment, deleteAssignment,
  searchAssignments, searchBPartners, getBPartner,
  createOrder, createOrderLine, completeOrder,
};
