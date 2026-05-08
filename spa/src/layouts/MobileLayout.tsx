import { useState, useEffect } from 'react';
import type { AppState } from '../hooks/useAppState';
import type { Appointment } from '../types';
import { toDateStr } from '../utils/date';
import BottomTabs from '../components/mobile/BottomTabs';
import AgendaView from '../components/mobile/AgendaView';
import MobileCalendar from '../components/mobile/MobileCalendar';
import MobileSearch from '../components/mobile/MobileSearch';
import MobileSettings from '../components/mobile/MobileSettings';
import MobileFilters from '../components/mobile/MobileFilters';
import QuickActions from '../components/mobile/QuickActions';
import BookingSheet from '../components/mobile/BookingSheet';
import '../styles/mobile.css';

interface Props {
  state: AppState;
  tablet?: boolean;
}

export default function MobileLayout({ state, tablet = false }: Props) {
  const [tab, setTab] = useState('today');
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [showFilters, setShowFilters] = useState(false);
  const [quickAppt, setQuickAppt] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState<{ mode: 'create' | 'edit'; appt?: Appointment; date?: string; start?: string; end?: string } | null>(null);

  // Load events when date changes
  useEffect(() => {
    const d = new Date(date + 'T00:00:00');
    const start = new Date(d); start.setDate(start.getDate() - 1);
    const end = new Date(d); end.setDate(end.getDate() + 7);
    state.loadEvents(toDateStr(start), toDateStr(end));
  }, [date]);

  function handleDateChange(d: string) {
    setDate(d);
  }

  function handleCardClick(appt: Appointment) {
    setQuickAppt(appt);
  }

  function handleEdit(appt: Appointment) {
    setBooking({ mode: 'edit', appt });
  }

  async function handleStatusChange(appt: Appointment, newStatus: string) {
    await state.updateAppointment(appt, {
      name: appt.name,
      status: newStatus,
      date: appt.start.slice(0, 10),
      startTime: appt.start.slice(11, 16),
      endTime: appt.end.slice(11, 16),
      notes: appt.notes,
      service: appt.service,
    });
  }

  async function handleQuickStatus(appt: Appointment, newStatus: string) {
    try {
      await handleStatusChange(appt, newStatus);
      state.toast(`已更新為${state.statusList.find(s => s.Value === newStatus)?.Name || newStatus}`);
    } catch {
      state.toast('更新失敗', 'error');
    }
  }

  async function handleCopyNext(appt: Appointment) {
    const d = new Date(appt.start.slice(0, 10) + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    await state.bookAppointment({
      name: appt.name,
      date: toDateStr(d),
      startTime: appt.start.slice(11, 16),
      endTime: appt.end.slice(11, 16),
      service: appt.service,
      notes: appt.notes,
      resourceIds: appt.resources.map(r => r.resourceId),
      bpartnerId: appt.bpartnerId || 0,
    });
  }

  function handleSearchSelect(selectedDate: string) {
    setDate(selectedDate);
    setTab('today');
  }

  function handleSlotSelect(slotDate: string, start: string, end: string) {
    setBooking({ mode: 'create', date: slotDate, start, end });
  }

  function handleRefresh() {
    const d = new Date(date + 'T00:00:00');
    const start = new Date(d); start.setDate(start.getDate() - 1);
    const end = new Date(d); end.setDate(end.getDate() + 7);
    state.loadEvents(toDateStr(start), toDateStr(end));
  }

  return (
    <div className={`mobile-layout${tablet ? ' tablet' : ''}`}>
      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'today' && (
          <AgendaView
            date={date}
            appointments={state.appointments}
            resources={state.resources}
            statusList={state.statusList}
            onDateChange={handleDateChange}
            onCardClick={handleCardClick}
            onFilterClick={() => setShowFilters(true)}
            onQuickStatus={handleQuickStatus}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'calendar' && (
          <MobileCalendar
            date={date}
            appointments={state.appointments}
            resources={state.resources}
            statusList={state.statusList}
            tablet={tablet}
            onDateChange={handleDateChange}
            onDatesSet={(start, end) => state.loadEvents(start, end)}
            onEventClick={handleCardClick}
            onSlotSelect={handleSlotSelect}
            onFilterClick={() => setShowFilters(true)}
          />
        )}
        {tab === 'search' && (
          <MobileSearch onSelect={handleSearchSelect} />
        )}
        {tab === 'settings' && (
          <MobileSettings
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
          />
        )}
      </div>

      {/* FAB */}
      {(tab === 'today' || tab === 'calendar') && (
        <button className="fab" onClick={() => setBooking({ mode: 'create', date })} aria-label="新增預約">
          +
        </button>
      )}

      {/* Bottom Tabs */}
      <BottomTabs active={tab} onChange={setTab} />

      {/* Overlays */}
      {showFilters && (
        <MobileFilters
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
          onClose={() => setShowFilters(false)}
        />
      )}

      {quickAppt && (
        <QuickActions
          appointment={quickAppt}
          resources={state.resources}
          statusList={state.statusList}
          onClose={() => setQuickAppt(null)}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          onCancel={state.cancelAppointment}
          onCopyNext={handleCopyNext}
          toast={state.toast}
        />
      )}

      {booking && (
        <BookingSheet
          mode={booking.mode}
          appointment={booking.appt}
          defaultDate={booking.date}
          defaultStart={booking.start}
          defaultEnd={booking.end}
          resources={state.resources}
          statusList={state.statusList}
          serviceList={state.serviceList}
          onClose={() => setBooking(null)}
          onBook={state.bookAppointment}
          onUpdate={state.updateAppointment}
          onCancel={state.cancelAppointment}
          onGroupAdd={state.addResource}
          onGroupRemove={state.removeResource}
          toast={state.toast}
        />
      )}
    </div>
  );
}
