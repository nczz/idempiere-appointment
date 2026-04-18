import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
import type { Appointment, Resource, Status, DialogState } from '../types';
import { TERMINAL_STATUSES } from '../types';

interface Props {
  appointments: Appointment[];
  resources: Resource[];
  statusList: Status[];
  onDatesSet: (start: string, end: string) => void;
  onSelect: (start: string, end: string) => void;
  onEventClick: (appointment: Appointment) => void;
}

export default function Calendar({ appointments, resources, statusList, onDatesSet, onSelect, onEventClick }: Props) {
  const events = appointments.map(appt => {
    const statusDef = statusList.find(s => s.Value === appt.status);
    const color = statusDef?.Description || '#999';
    const isTerminal = TERMINAL_STATUSES.includes(appt.status);
    const resNames = appt.resources.map(r => {
      const res = resources.find(x => x.id === r.resourceId);
      return res?.Name || '';
    }).filter(Boolean).join(', ');

    return {
      id: appt.key,
      title: appt.name,
      start: appt.start,
      end: appt.end,
      backgroundColor: color,
      borderColor: color,
      textColor: '#fff',
      classNames: isTerminal ? ['event-cancelled'] : [],
      extendedProps: { _appointment: appt, _resNames: resNames },
    };
  });

  function handleDatesSet(info: DatesSetArg) {
    onDatesSet(info.startStr, info.endStr);
  }

  function handleSelect(info: DateSelectArg) {
    onSelect(info.startStr, info.endStr);
  }

  function handleEventClick(info: EventClickArg) {
    const appt = info.event.extendedProps._appointment as Appointment;
    onEventClick(appt);
  }

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="zh-tw"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay',
      }}
      buttonText={{ month: '月', week: '週', day: '日', today: '今天', list: '列表' }}
      slotDuration="00:15:00"
      slotMinTime="09:00:00"
      slotMaxTime="18:00:00"
      allDaySlot={false}
      nowIndicator={true}
      editable={true}
      selectable={true}
      height="100%"
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      events={events}
      datesSet={handleDatesSet}
      select={handleSelect}
      eventClick={handleEventClick}
      eventContent={(arg) => {
        const resNames = arg.event.extendedProps._resNames as string;
        return (
          <div style={{ overflow: 'hidden', fontSize: '11px', lineHeight: '1.3', padding: '1px 2px' }}>
            <div style={{ fontWeight: 'bold' }}>{arg.event.title}</div>
            {resNames && <div style={{ opacity: 0.8, fontSize: '10px' }}>{resNames}</div>}
          </div>
        );
      }}
    />
  );
}
