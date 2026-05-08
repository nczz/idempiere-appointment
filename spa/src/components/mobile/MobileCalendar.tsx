import { useRef, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DatesSetArg, DateSelectArg } from '@fullcalendar/core';
import type { Appointment, Resource, Status } from '../../types';
import { TERMINAL_STATUSES } from '../../types';
import { toDateStr, toTimeStr, todayStr } from '../../utils/date';

interface Props {
  date: string;
  appointments: Appointment[];
  resources: Resource[];
  statusList: Status[];
  tablet?: boolean;
  onDateChange: (date: string) => void;
  onDatesSet: (start: string, end: string) => void;
  onEventClick: (appt: Appointment) => void;
  onSlotSelect: (date: string, start: string, end: string) => void;
  onFilterClick: () => void;
}

export default function MobileCalendar({ date, appointments, resources, statusList, tablet, onDateChange, onDatesSet, onEventClick, onSlotSelect, onFilterClick }: Props) {
  const calRef = useRef<FullCalendar>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Navigate FullCalendar when date prop changes
  useEffect(() => {
    const api = calRef.current?.getApi();
    if (api) {
      const current = api.getDate().toISOString().slice(0, 10);
      if (current !== date) api.gotoDate(date);
    }
  }, [date]);

  function goBack() {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onDateChange(toDateStr(d));
  }

  function goForward() {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onDateChange(toDateStr(d));
  }

  function handleDateClick() {
    pickerRef.current?.showPicker?.();
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) onDateChange(e.target.value);
  }

  const events = appointments.map(appt => {
    const statusDef = statusList.find(s => s.Value === appt.status);
    const color = statusDef?.Description || '#999';
    const isTerminal = TERMINAL_STATUSES.includes(appt.status);
    return {
      id: appt.key,
      title: appt.name,
      start: appt.start,
      end: appt.end,
      backgroundColor: color,
      borderColor: color,
      textColor: '#fff',
      classNames: isTerminal ? ['event-cancelled'] : [],
      extendedProps: { _appointment: appt },
    };
  });

  function handleDatesSet(info: DatesSetArg) {
    onDatesSet(info.startStr, info.endStr);
  }

  function handleEventClick(info: EventClickArg) {
    const appt = info.event.extendedProps._appointment as Appointment;
    onEventClick(appt);
  }

  function handleSelect(info: DateSelectArg) {
    onSlotSelect(toDateStr(info.start), toTimeStr(info.start), toTimeStr(info.end));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="mobile-header">
        <div className="m-date-nav">
          <button onClick={goBack}>‹</button>
          <span onClick={handleDateClick} style={{ cursor: 'pointer', position: 'relative' }}>
            {(() => { const d = new Date(date + 'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()} (${'日一二三四五六'[d.getDay()]})`; })()}
            <input
              ref={pickerRef}
              type="date"
              value={date}
              onChange={handlePickerChange}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, top: 0, left: 0 }}
            />
          </span>
          <button onClick={goForward}>›</button>
          {date !== todayStr() && (
            <button onClick={() => onDateChange(todayStr())} style={{ fontSize: 12, width: 'auto', padding: '4px 8px', borderRadius: 12 }}>
              今天
            </button>
          )}
        </div>
        <button className="m-btn-outline m-btn" style={{ padding: '8px 12px', fontSize: 13 }} onClick={onFilterClick}>
          篩選
        </button>
      </div>

      {/* Calendar */}
      <div className="mobile-calendar-wrap">
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView={tablet ? "timeGridWeek" : "timeGridDay"}
          initialDate={date}
          headerToolbar={false}
          slotDuration="00:30:00"
          slotMinTime="08:00:00"
          slotMaxTime="19:00:00"
          allDaySlot={false}
          nowIndicator={true}
          editable={false}
          selectable={true}
          selectMirror={true}
          longPressDelay={400}
          height="100%"
          locale="zh-tw"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          select={handleSelect}
        />
      </div>
    </div>
  );
}
