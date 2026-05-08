import { useState } from 'react';
import Calendar from '../components/Calendar';
import Sidebar from '../components/Sidebar';
import AppointmentDialog from '../components/AppointmentDialog';
import ServiceManager from '../components/ServiceManager';
import ResourceManager from '../components/ResourceManager';
import StatusManager from '../components/StatusManager';
import type { Appointment } from '../types';
import type { AppState } from '../hooks/useAppState';

interface Props {
  state: AppState;
}

export default function DesktopLayout({ state }: Props) {
  const [showServiceMgr, setShowServiceMgr] = useState(false);
  const [showResourceMgr, setShowResourceMgr] = useState(false);
  const [showStatusMgr, setShowStatusMgr] = useState(false);

  function handleDatesSet(start: string, end: string) {
    state.loadEvents(start, end);
  }

  function handleSelect(start: string, end: string) {
    state.setDialog({
      mode: 'create',
      defaultDate: start.slice(0, 10),
      defaultStart: start.slice(11, 16),
      defaultEnd: end.slice(11, 16),
    });
  }

  function handleEventClick(appt: Appointment) {
    state.setDialog({ mode: 'edit', appointment: appt });
  }

  return (
    <>
      <Sidebar
        resources={state.resources}
        resourceTypes={state.resourceTypes}
        statusList={state.statusList}
        serviceList={state.serviceList}
        selectedResources={state.selectedResources}
        selectedServices={state.selectedServices}
        showCancelled={state.showCancelled}
        onToggleResource={state.toggleResource}
        onToggleAllResources={state.toggleAllResources}
        onToggleService={state.toggleService}
        onToggleAllServices={state.toggleAllServices}
        onSetShowCancelled={state.setShowCancelled}
        onJumpToDate={() => {}}
        onManageServices={() => setShowServiceMgr(true)}
        onManageResources={() => setShowResourceMgr(true)}
        onManageStatuses={() => setShowStatusMgr(true)}
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

      {showServiceMgr && (
        <ServiceManager onClose={() => setShowServiceMgr(false)} onUpdated={() => state.loadInit()} />
      )}
      {showResourceMgr && (
        <ResourceManager onClose={() => setShowResourceMgr(false)} onUpdated={() => state.loadInit()} />
      )}
      {showStatusMgr && (
        <StatusManager statuses={state.statusList} onClose={() => setShowStatusMgr(false)} onUpdated={() => state.loadInit()} />
      )}
    </>
  );
}
