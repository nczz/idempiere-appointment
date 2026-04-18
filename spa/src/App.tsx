import { useEffect, useRef } from 'react';
import { useAppState } from './hooks/useAppState';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import AppointmentDialog from './components/AppointmentDialog';
import type { Appointment } from './types';
import './style.css';

export default function App() {
  const state = useAppState();
  const calendarRef = useRef<{ gotoDate: (d: string) => void }>(null);

  // Load initial data on mount
  useEffect(() => { state.loadInit(); }, []);

  // Calendar date range change → load events
  function handleDatesSet(start: string, end: string) {
    state.loadEvents(start, end);
  }

  // Click empty slot → open create dialog
  function handleSelect(start: string, end: string) {
    state.setDialog({
      mode: 'create',
      defaultDate: start.slice(0, 10),
      defaultStart: start.slice(11, 16),
      defaultEnd: end.slice(11, 16),
    });
  }

  // Click event → open edit dialog
  function handleEventClick(appt: Appointment) {
    state.setDialog({ mode: 'edit', appointment: appt });
  }

  // Search result → jump to date
  function handleJumpToDate(_date: string) {
    // FullCalendar gotoDate is handled via the ref if needed
    // For now, the calendar will show the date when events are loaded
  }

  return (
    <div className="app-container">
      <Sidebar
        resources={state.resources}
        resourceTypes={state.resourceTypes}
        statusList={state.statusList}
        selectedResources={state.selectedResources}
        showCancelled={state.showCancelled}
        onToggleResource={state.toggleResource}
        onSetShowCancelled={state.setShowCancelled}
        onJumpToDate={handleJumpToDate}
      />

      <main className="calendar-container">
        <Calendar
          appointments={state.appointments}
          resources={state.resources}
          statusList={state.statusList}
          onDatesSet={handleDatesSet}
          onSelect={handleSelect}
          onEventClick={handleEventClick}
        />
      </main>

      {state.dialog && (
        <AppointmentDialog
          dialog={state.dialog}
          resources={state.resources}
          statusList={state.statusList}
          serviceList={state.serviceList}
          onClose={() => state.setDialog(null)}
          onBook={state.bookAppointment}
          onUpdate={state.updateAppointment}
          onCancel={state.cancelAppointment}
          onGroupAdd={state.addResource}
          onGroupRemove={state.removeResource}
          toast={state.toast}
        />
      )}

      {/* Toast container */}
      <div id="toastContainer" style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000 }}>
        {state.toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {state.error && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,.3)', zIndex: 3000 }}>
          <p style={{ color: '#d32f2f' }}>{state.error}</p>
        </div>
      )}
    </div>
  );
}
