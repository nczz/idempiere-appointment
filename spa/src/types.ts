// ── Server data types ──────────────────────────────────────────────

export interface ResourceType {
  id: number;
  Name: string;
  IsTimeSlot: boolean;
  TimeSlotStart: string;
  TimeSlotEnd: string;
  IsSingleAssignment: boolean;
  OnMonday: boolean;
  OnTuesday: boolean;
  OnWednesday: boolean;
  OnThursday: boolean;
  OnFriday: boolean;
  OnSaturday: boolean;
  OnSunday: boolean;
}

export interface Resource {
  id: number;
  Name: string;
  S_ResourceType_ID: number;
  IsAvailable: boolean;
  _color: string; // assigned client-side
}

export interface Status {
  Value: string;
  Name: string;
  Description: string; // hex color
}

/** Raw S_ResourceAssignment from /appointment/events */
export interface Assignment {
  id: number;
  S_Resource_ID: number;
  Name: string;
  Description: string;
  AssignDateFrom: string;
  AssignDateTo: string;
  X_AppointmentStatus: string;
  C_BPartner_ID?: number;
  IsConfirmed: boolean;
  Qty: number;
}

/** Parsed from Assignment.Description JSON */
export interface AssignmentDesc {
  group_id?: string;
  status?: string;
  service?: string;
  notes?: string;
  bpartner_id?: number;
  order_id?: number;
}

// ── Client-side grouped types ─────────────────────────────────────

export interface AppointmentResource {
  assignmentId: number;
  resourceId: number;
}

/** Grouped appointment — one per patient visit, may span multiple resources */
export interface Appointment {
  key: string;                    // group_id or "s_{id}"
  primaryId: number;              // first assignment ID (for API calls)
  name: string;
  start: string;
  end: string;
  status: string;
  service: string;
  notes: string;
  bpartnerId: number | null;
  orderId: number | null;
  resources: AppointmentResource[];
  assignments: Assignment[];
}

// ── Dialog state ──────────────────────────────────────────────────

export interface DialogState {
  mode: 'create' | 'edit';
  appointment?: Appointment;
  defaultDate?: string;
  defaultStart?: string;
  defaultEnd?: string;
}

// ── API request types ─────────────────────────────────────────────

export interface BookRequest {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  service: string;
  notes: string;
  resourceIds: number[];
  bpartnerId: number;
}

export interface UpdateRequest {
  name: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export interface BPartnerResult {
  id: number;
  Name: string;
  Phone?: string;
  EMail?: string;
}

// ── Constants ─────────────────────────────────────────────────────

export interface ServicePreset {
  Value: string;
  Name: string;
  minutes: number;
}

export const TERMINAL_STATUSES = ['CXL', 'ABS'];

export const RESOURCE_COLORS = [
  '#4285f4', '#34a853', '#fbbc04', '#ea4335',
  '#8e24aa', '#00acc1', '#ff7043', '#5c6bc0',
];
