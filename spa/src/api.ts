import type {
  ResourceType, Resource, Status, Assignment,
  BookRequest, UpdateRequest, BPartnerResult, ServicePreset,
} from './types';

const APPT_BASE = `${window.location.origin}/appointment`;
const REST_BASE = `${window.location.origin}/api/v1`;

let token: string | null = null;

// ── Token management ──────────────────────────────────────────────

export function initToken(): void {
  const h = window.location.hash;
  if (h) {
    const raw = h.startsWith('#token=') ? h.substring(7) : h.substring(1);
    token = decodeURIComponent(raw);
  }
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'token-refreshed') {
      token = e.data.token;
    }
  });
}

function getTokenPayload(): Record<string, unknown> {
  if (!token) return {};
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

export function getOrgId(): number {
  return (getTokenPayload().AD_Org_ID as number) ?? 0;
}

export function hasToken(): boolean {
  return token !== null;
}

// ── Custom API (no auth, same origin) ─────────────────────────────

async function apptFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${APPT_BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || res.statusText);
  return json as T;
}

// ── REST API (needs JWT token) ────────────────────────────────────

async function restFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${REST_BASE}/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (res.status === 401) {
    window.parent.postMessage({ type: 'refresh-token' }, '*');
    throw new Error('Token expired');
  }
  if (res.status === 204) return null as T;
  const json = await res.json();
  if (!res.ok) throw new Error((json as { detail?: string; title?: string }).detail || (json as { title?: string }).title || res.statusText);
  return json as T;
}

// ── Read endpoints (custom API) ───────────────────────────────────

interface InitResponse {
  resourceTypes: ResourceType[];
  resources: Resource[];
  statusList: Status[];
  serviceList: ServicePreset[];
}

export async function getInit(): Promise<InitResponse> {
  return apptFetch<InitResponse>('init');
}

interface EventsResponse {
  events: Assignment[];
}

export async function getEvents(start: string, end: string): Promise<Assignment[]> {
  const data = await apptFetch<EventsResponse>(`events?start=${start}&end=${end}`);
  return data.events || [];
}

export async function searchBPartners(q: string): Promise<BPartnerResult[]> {
  const data = await apptFetch<{ results: BPartnerResult[] }>(`bpartners?q=${encodeURIComponent(q)}`);
  return data.results || [];
}

// ── Write endpoints (custom API) ──────────────────────────────────

export async function bookAppointment(data: BookRequest): Promise<{ ids: number[] }> {
  return apptFetch<{ ids: number[] }>('book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateAppointment(id: number, data: UpdateRequest): Promise<void> {
  await apptFetch<{ ok: boolean }>(`update?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function groupAdd(assignmentId: number, resourceId: number): Promise<{ id: number }> {
  return apptFetch<{ id: number }>('group-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId, resourceId }),
  });
}

export async function groupRemove(assignmentId: number): Promise<void> {
  await apptFetch<{ ok: boolean }>(`group-remove?id=${assignmentId}`, { method: 'DELETE' });
}

// ── REST API (for operations not yet migrated to custom API) ──────

// ── Service management ────────────────────────────────────────────

export async function getServices(): Promise<ServicePreset[]> {
  const data = await apptFetch<{ services: ServicePreset[] }>('services');
  return data.services || [];
}

export async function createService(name: string, minutes: number): Promise<void> {
  await apptFetch('services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, minutes: String(minutes) }),
  });
}

export async function updateService(id: number, name: string, minutes: number): Promise<void> {
  await apptFetch('services', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: String(id), name, minutes: String(minutes) }),
  });
}

export async function deleteService(id: number): Promise<void> {
  await apptFetch(`services?id=${id}`, { method: 'DELETE' });
}

// ── Search (REST API) ─────────────────────────────────────────────

export async function searchAssignments(keyword: string): Promise<Assignment[]> {
  const data = await restFetch<{ records: Assignment[] }>(
    `models/S_ResourceAssignment?$filter=contains(Name,'${keyword}')&$orderby=AssignDateFrom desc&$top=20`
  );
  return data?.records || [];
}
