import { useState, useMemo, useCallback, useRef } from 'react';
import type {
  Resource, ResourceType, Status, Assignment, Appointment,
  AppointmentResource, AssignmentDesc, DialogState,
  BookRequest, UpdateRequest, ServicePreset,
} from '../types';
import { TERMINAL_STATUSES, RESOURCE_COLORS } from '../types';
import * as api from '../api';

// ── Description JSON parser ───────────────────────────────────────

function parseDesc(desc: string): AssignmentDesc {
  try { return JSON.parse(desc || '{}'); }
  catch { return {}; }
}

// ── Group assignments into appointments ───────────────────────────

function groupAssignments(assignments: Assignment[]): Appointment[] {
  const groups: Record<string, Appointment> = {};

  for (const a of assignments) {
    const desc = parseDesc(a.Description);
    const status = a.X_AppointmentStatus || desc.status || '';
    const key = desc.group_id || `s_${a.id}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        primaryId: a.id,
        name: a.Name,
        start: a.AssignDateFrom,
        end: a.AssignDateTo,
        status,
        service: desc.service || '',
        notes: desc.notes || '',
        bpartnerId: a.C_BPartner_ID ?? desc.bpartner_id ?? null,
        orderId: desc.order_id ?? null,
        resources: [],
        assignments: [],
      };
    }

    groups[key].resources.push({
      assignmentId: a.id,
      resourceId: a.S_Resource_ID,
    });
    groups[key].assignments.push(a);
  }

  return Object.values(groups);
}

// ── Hook ──────────────────────────────────────────────────────────

export function useAppState() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [statusList, setStatusList] = useState<Status[]>([]);
  const [serviceList, setServiceList] = useState<ServicePreset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedResources, setSelectedResources] = useState<Set<number>>(new Set());
  const [showCancelled, setShowCancelled] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current date range for reload
  const dateRangeRef = useRef({ start: '', end: '' });

  // ── Derived state ───────────────────────────────────────────────

  const appointments = useMemo(
    () => groupAssignments(assignments),
    [assignments]
  );

  const visibleAppointments = useMemo(() => {
    return appointments.filter(appt => {
      const hasSelected = appt.resources.some(r => selectedResources.has(r.resourceId));
      if (!hasSelected) return false;
      if (!showCancelled && TERMINAL_STATUSES.includes(appt.status)) return false;
      return true;
    });
  }, [appointments, selectedResources, showCancelled]);

  // ── Load initial data ───────────────────────────────────────────

  const loadInit = useCallback(async () => {
    try {
      setLoading(true);
      api.initToken();
      const data = await api.getInit();
      const res = (data.resources || []).map((r, i) => ({
        ...r,
        _color: r._color || RESOURCE_COLORS[i % RESOURCE_COLORS.length],
      }));
      setResourceTypes(data.resourceTypes || []);
      setResources(res);
      setStatusList(data.statusList || []);
      setServiceList(data.serviceList || []);
      // Default: all resources selected
      setSelectedResources(new Set(res.map(r => r.id)));
      // Load events for current date range (token is now ready)
      const { start, end } = dateRangeRef.current;
      if (start && end) {
        const events = await api.getEvents(start.slice(0, 10), end.slice(0, 10));
        setAssignments(events);
      }
    } catch (e) {
      setError('載入失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load events for date range ──────────────────────────────────

  const loadEvents = useCallback(async (start: string, end: string) => {
    dateRangeRef.current = { start, end };
    if (!api.hasToken()) return; // Skip if token not yet initialized
    try {
      const events = await api.getEvents(start.slice(0, 10), end.slice(0, 10));
      setAssignments(events);
    } catch {
      setError('查詢預約失敗');
    }
  }, []);

  // ── Refresh after write operation ───────────────────────────────

  const refreshAfterAction = useCallback(async (involvedResourceIds: number[] = [], updateDialogKey?: string) => {
    if (involvedResourceIds.length > 0) {
      setSelectedResources(prev => {
        const next = new Set(prev);
        involvedResourceIds.forEach(id => next.add(id));
        return next;
      });
    }
    const { start, end } = dateRangeRef.current;
    if (start && end) {
      const events = await api.getEvents(start.slice(0, 10), end.slice(0, 10));
      setAssignments(events);
      // If dialog is open, update its appointment reference with fresh data
      if (updateDialogKey) {
        const freshAppts = groupAssignments(events);
        const fresh = freshAppts.find(a => a.key === updateDialogKey)
          || freshAppts.find(a => a.resources.some(r => r.assignmentId === dialog?.appointment?.primaryId));
        if (fresh) {
          setDialog(prev => prev ? { ...prev, appointment: fresh } : null);
        }
      }
    }
  }, []);

  // ── Write operations ────────────────────────────────────────────

  const bookAppointment = useCallback(async (data: BookRequest) => {
    await api.bookAppointment(data);
    await refreshAfterAction(data.resourceIds);
  }, [refreshAfterAction]);

  const updateAppointment = useCallback(async (appt: Appointment, data: UpdateRequest) => {
    await api.updateAppointment(appt.primaryId, data);
    const rids = appt.resources.map(r => r.resourceId);
    await refreshAfterAction(rids);
  }, [refreshAfterAction]);

  const cancelAppointment = useCallback(async (appt: Appointment) => {
    // Cancel primary + all group members via update
    for (const a of appt.assignments) {
      await api.updateAppointment(a.id, {
        name: appt.name, status: 'CXL',
        date: appt.start.slice(0, 10),
        startTime: appt.start.slice(11, 16),
        endTime: appt.end.slice(11, 16),
        notes: appt.notes,
        service: appt.service,
      });
    }
    const rids = appt.resources.map(r => r.resourceId);
    await refreshAfterAction(rids);
  }, [refreshAfterAction]);

  const addResource = useCallback(async (appt: Appointment, resourceId: number) => {
    await api.groupAdd(appt.primaryId, resourceId);
    await refreshAfterAction([resourceId, ...appt.resources.map(r => r.resourceId)], appt.key);
  }, [refreshAfterAction]);

  const removeResource = useCallback(async (assignmentId: number, appt: Appointment) => {
    await api.groupRemove(assignmentId);
    const rids = appt.resources.map(r => r.resourceId);
    await refreshAfterAction(rids, appt.key);
  }, [refreshAfterAction]);

  // ── Resource selection helpers ──────────────────────────────────

  const toggleResource = useCallback((resourceId: number) => {
    setSelectedResources(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  }, []);

  // ── Toast messages ──────────────────────────────────────────────

  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((msg: string, type = 'info') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return {
    // State
    resources, resourceTypes, statusList, serviceList,
    appointments: visibleAppointments,
    allAppointments: appointments,
    selectedResources, showCancelled,
    dialog, loading, error, toasts,

    // Actions
    loadInit, loadEvents,
    bookAppointment, updateAppointment, cancelAppointment,
    addResource, removeResource,
    toggleResource, setShowCancelled,
    setDialog, toast,
  };
}
