import { useRef, useState } from 'react';
import type { Appointment, Resource, Status } from '../../types';
import { toDateStr, todayStr } from '../../utils/date';

interface Props {
  date: string;
  appointments: Appointment[];
  resources: Resource[];
  statusList: Status[];
  onDateChange: (date: string) => void;
  onCardClick: (appt: Appointment) => void;
  onFilterClick: () => void;
  onQuickStatus: (appt: Appointment, status: string) => void;
  onRefresh: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = '日一二三四五六'[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekday})`;
}

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

export default function AgendaView({ date, appointments, resources, statusList, onDateChange, onCardClick, onFilterClick, onQuickStatus, onRefresh }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  const dayAppts = appointments
    .filter(a => a.start.slice(0, 10) === date)
    .sort((a, b) => a.start.localeCompare(b.start));

  // Pull-to-refresh
  const contentRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const pulling = useRef(false);

  function handleContentTouchStart(e: React.TouchEvent) {
    if (contentRef.current && contentRef.current.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }
  function handleContentTouchEnd(e: React.TouchEvent) {
    if (!pulling.current) return;
    pulling.current = false;
    const dy = e.changedTouches[0].clientY - pullStartY.current;
    if (dy > 80) onRefresh();
  }

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
    if (pickerRef.current) {
      pickerRef.current.showPicker?.();
      setShowPicker(true);
    }
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      onDateChange(e.target.value);
    }
    setShowPicker(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Date navigation */}
      <div className="mobile-header">
        <div className="m-date-nav">
          <button onClick={goBack} aria-label="前一天">‹</button>
          <span onClick={handleDateClick} style={{ cursor: 'pointer', position: 'relative' }}>
            {formatDate(date)}
            {/* Hidden native date picker */}
            <input
              ref={pickerRef}
              type="date"
              value={date}
              onChange={handlePickerChange}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, top: 0, left: 0 }}
            />
          </span>
          <button onClick={goForward} aria-label="後一天">›</button>
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

      {/* Appointment list */}
      <div
        className="mobile-content"
        ref={contentRef}
        onTouchStart={handleContentTouchStart}
        onTouchEnd={handleContentTouchEnd}
      >
        {dayAppts.length === 0 ? (
          <div className="agenda-empty">
            <span style={{ fontSize: 48 }}>📅</span>
            <p>今天沒有預約</p>
          </div>
        ) : (
          <div className="agenda-cards">
            {dayAppts.map(appt => (
              <SwipeCard
                key={appt.key}
                appointment={appt}
                resources={resources}
                statusList={statusList}
                onClick={() => onCardClick(appt)}
                onQuickStatus={onQuickStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// === Swipeable Card ===

interface SwipeCardProps {
  appointment: Appointment;
  resources: Resource[];
  statusList: Status[];
  onClick: () => void;
  onQuickStatus: (appt: Appointment, status: string) => void;
}

function SwipeCard({ appointment: appt, resources, statusList, onClick, onQuickStatus }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const status = statusList.find(s => s.Value === appt.status);
  const color = status?.Description || '#999';
  const resNames = appt.resources
    .map(r => resources.find(x => x.id === r.resourceId)?.Name)
    .filter(Boolean)
    .join(', ');

  const statusFlow: Record<string, string> = { SCH: 'CFM', CFM: 'CHK', CHK: 'INP', INP: 'DON' };
  const nextStatus = statusFlow[appt.status];
  const nextStatusDef = nextStatus ? statusList.find(s => s.Value === nextStatus) : null;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    swiping.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -20) {
      swiping.current = true;
      currentX.current = Math.max(dx, -120);
      if (cardRef.current) {
        cardRef.current.style.transform = `translateX(${currentX.current}px)`;
      }
    }
  }

  function handleTouchEnd() {
    if (!swiping.current) return;
    const triggered = currentX.current < -80;
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform .2s ease-out';
      cardRef.current.style.transform = 'translateX(0)';
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = ''; }, 200);
    }
    if (triggered && nextStatus) {
      onQuickStatus(appt, nextStatus);
    }
    swiping.current = false;
  }

  function handleClick() {
    if (!swiping.current) onClick();
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', margin: '8px 16px', borderRadius: 8 }}>
      {nextStatusDef && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 120,
          background: nextStatusDef.Description || '#4CAF50',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 500,
        }}>
          → {nextStatusDef.Name}
        </div>
      )}
      <div
        ref={cardRef}
        className="agenda-card"
        style={{ margin: 0 }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="agenda-card-bar" style={{ background: color }} />
        <div className="agenda-card-body">
          <div className="agenda-card-name">{appt.name}</div>
          <div className="agenda-card-meta">
            {appt.serviceName || appt.service}{resNames ? ` · ${resNames}` : ''}
          </div>
          <div className="agenda-card-time">
            {formatTime(appt.start)} - {formatTime(appt.end)}
          </div>
        </div>
        <span className="agenda-card-badge" style={{ background: color }}>
          {status?.Name || appt.status}
        </span>
      </div>
    </div>
  );
}
