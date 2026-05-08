import type { Appointment, Resource, Status } from '../../types';

interface Props {
  appointment: Appointment;
  resources: Resource[];
  statusList: Status[];
  onClose: () => void;
  onStatusChange: (appt: Appointment, status: string) => Promise<void>;
  onEdit: (appt: Appointment) => void;
  onCancel: (appt: Appointment) => Promise<void>;
  onCopyNext: (appt: Appointment) => Promise<void>;
  toast: (msg: string, type?: string) => void;
}

const TERMINAL = ['CXL', 'ABS'];

export default function QuickActions({ appointment: appt, resources, statusList, onClose, onStatusChange, onEdit, onCancel, onCopyNext, toast }: Props) {
  const status = statusList.find(s => s.Value === appt.status);
  const resNames = appt.resources
    .map(r => resources.find(x => x.id === r.resourceId)?.Name)
    .filter(Boolean)
    .join(', ');

  async function handleStatus(value: string) {
    if (value === appt.status) return;
    try {
      await onStatusChange(appt, value);
      toast(`已更新為${statusList.find(s => s.Value === value)?.Name || value}`);
      onClose();
    } catch (e) {
      toast('更新失敗', 'error');
    }
  }

  async function handleCancel() {
    if (!confirm('確定要取消此預約？')) return;
    try {
      await onCancel(appt);
      toast('預約已取消');
      onClose();
    } catch {
      toast('取消失敗', 'error');
    }
  }

  async function handleCopy() {
    try {
      await onCopyNext(appt);
      toast('已複製到下週');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : '複製失敗', 'error');
    }
  }

  function handleZoom() {
    if (!appt.bpartnerId) return;
    const base = window.location.origin;
    window.open(`${base}/webui/?Action=Zoom&TableName=C_BPartner&Record_ID=${appt.bpartnerId}`, '_blank');
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet quick-sheet">
        <div className="sheet-handle" />

        {/* Info */}
        <div className="quick-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div className="quick-info-name">{appt.name}</div>
            {appt.bpartnerId && (
              <button onClick={handleZoom} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--primary)', cursor: 'pointer' }}>
                🔗 客戶
              </button>
            )}
          </div>
          <div className="quick-info-detail">
            {appt.serviceName || appt.service} · {appt.start.slice(11, 16)} - {appt.end.slice(11, 16)}
          </div>
          {resNames && <div className="quick-info-detail">{resNames}</div>}
          {appt.notes && <div className="quick-info-detail" style={{ marginTop: 8 }}>📝 {appt.notes}</div>}
        </div>

        {/* Status buttons */}
        <div className="quick-status-row">
          {statusList.filter(s => !TERMINAL.includes(s.Value)).map(s => (
            <button
              key={s.Value}
              className={`quick-status-btn${s.Value === appt.status ? ' active' : ''}`}
              style={{
                borderColor: s.Description || '#999',
                background: s.Value === appt.status ? (s.Description || '#999') : 'transparent',
                color: s.Value === appt.status ? '#fff' : (s.Description || '#999'),
              }}
              onClick={() => handleStatus(s.Value)}
            >
              {s.Name}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="quick-actions-row">
          <button className="quick-action-btn" onClick={() => { onEdit(appt); onClose(); }}>✏️ 編輯</button>
          <button className="quick-action-btn" onClick={handleCopy}>📋 複製到下週</button>
          <button className="quick-action-btn danger" onClick={handleCancel}>❌ 取消</button>
        </div>
      </div>
    </>
  );
}
