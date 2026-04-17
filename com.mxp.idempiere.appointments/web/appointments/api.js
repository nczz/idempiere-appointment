const BASE = `${window.location.origin}/api/v1`;
let token = null;
let tokenResolve = null;
let tokenPayload = null; // decoded JWT payload

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

/** Decode JWT payload (no verification — token is already trusted from server). */
function decodeJwtPayload(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return {};
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch { return {}; }
}

/** Get AD_Org_ID from the current token context. */
function getOrgId() { return tokenPayload?.AD_Org_ID ?? 0; }

/** Get AD_Client_ID from the current token context. */
function getClientId() { return tokenPayload?.AD_Client_ID ?? 0; }

async function refreshToken() {
  return new Promise((resolve) => {
    tokenResolve = resolve;
    window.parent.postMessage({ type: 'refresh-token' }, '*');
    setTimeout(() => { if (tokenResolve) { tokenResolve(); tokenResolve = null; } }, 10000);
  });
}

async function api(path, opts = {}, retry = true) {
  const res = await fetch(`${BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (res.status === 401 && retry) {
    await refreshToken();
    return api(path, opts, false);
  }
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.title || res.statusText);
  return json;
}

function get(path) { return api(path); }
function post(path, data) { return api(path, { method: 'POST', body: JSON.stringify(data) }); }
function put(path, data) { return api(path, { method: 'PUT', body: JSON.stringify(data) }); }
function del(path) { return api(path, { method: 'DELETE' }); }

function getResourceTypes() {
  return get('models/S_ResourceType?$filter=IsActive eq true').then(r => r?.records || []);
}

function getResources() {
  return get('models/S_Resource?$filter=IsActive eq true&$orderby=Name').then(r => r?.records || []);
}

async function getStatusList(referenceUU) {
  if (referenceUU) {
    const r = await get(`models/AD_Ref_List?$filter=AD_Reference_ID.AD_Reference_UU eq '${referenceUU}'&$orderby=Value`);
    return r?.records || [];
  }
  const ref = await get("models/AD_Reference?$filter=Name eq 'X_AppointmentStatus'&$top=1");
  const id = ref?.records?.[0]?.id;
  if (!id) return [];
  const r = await get(`models/AD_Ref_List?$filter=AD_Reference_ID eq ${id}&$orderby=Value`);
  return r?.records || [];
}

function getAssignments(resourceId, rangeStart, rangeEnd) {
  return get(`models/S_ResourceAssignment?$filter=AssignDateFrom ge '${rangeStart}' and AssignDateFrom lt '${rangeEnd}' and S_Resource_ID eq ${resourceId}`).then(r => r?.records || []);
}

function getUnavailable(resourceId, rangeStart, rangeEnd) {
  return get(`models/S_ResourceUnAvailable?$filter=DateFrom lt '${rangeEnd}' and DateTo ge '${rangeStart}' and S_Resource_ID eq ${resourceId}`).then(r => r?.records || []);
}

function createAssignment(data) { return post('models/S_ResourceAssignment', data); }
function updateAssignment(id, data) { return put(`models/S_ResourceAssignment/${id}`, data); }
function deleteAssignment(id) { return del(`models/S_ResourceAssignment/${id}`); }

function searchAssignments(keyword) {
  return get(`models/S_ResourceAssignment?$filter=contains(Name,'${keyword}')&$orderby=AssignDateFrom desc&$top=20`).then(r => r?.records || []);
}

function searchBPartners(keyword) {
  return get(`models/C_BPartner?$filter=contains(Name,'${keyword}') and IsCustomer eq true&$top=10`).then(r => r?.records || []);
}

function getBPartner(id) {
  return get(`models/C_BPartner/${id}?$select=Name,Phone,Phone2,EMail`);
}

function createOrder(data) { return post('models/C_Order', data); }
function createOrderLine(data) { return post('models/C_OrderLine', data); }

function completeOrder(orderId) {
  return post('processes/c_order-process', { 'Record_ID': orderId, 'DocAction': 'CO' });
}

export default {
  init, getOrgId, getClientId,
  getResourceTypes, getResources, getStatusList,
  getAssignments, getUnavailable,
  createAssignment, updateAssignment, deleteAssignment,
  searchAssignments, searchBPartners, getBPartner,
  createOrder, createOrderLine, completeOrder,
};
