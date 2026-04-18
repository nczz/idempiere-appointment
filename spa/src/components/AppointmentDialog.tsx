import { useState, useEffect } from 'react';
import type { Appointment, Resource, Status, DialogState, BPartnerResult } from '../types';
import { SERVICE_PRESETS } from '../types';
import * as api from '../api';

interface Props {
  dialog: DialogState;
  resources: Resource[];
  statusList: Status[];
  onClose: () => void;
  onBook: (data: { name: string; date: string; startTime: string; endTime: string; service: string; notes: string; resourceIds: number[]; bpartnerId: number }) => Promise<void>;
  onUpdate: (appt: Appointment, data: { name: string; status: string; date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  onCancel: (appt: Appointment) => Promise<void>;
  onGroupAdd: (appt: Appointment, resourceId: number) => Promise<void>;
  onGroupRemove: (assignmentId: number, appt: Appointment) => Promise<void>;
  toast: (msg: string, type?: string) => void;
}

export default function AppointmentDialog({
  dialog, resources, statusList, onClose,
  onBook, onUpdate, onCancel, onGroupAdd, onGroupRemove, toast,
}: Props) {
  const isEdit = dialog.mode === 'edit';
  const appt = dialog.appointment;

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState('SCH');
  const [service, setService] = useState('');
  const [notes, setNotes] = useState('');
  const [bpId, setBpId] = useState(0);
  const [selectedRids, setSelectedRids] = useState<number[]>([]);
  const [bpSearch, setBpSearch] = useState('');
  const [bpResults, setBpResults] = useState<BPartnerResult[]>([]);
  const [bpInfo, setBpInfo] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize form from dialog state
  useEffect(() => {
    if (isEdit && appt) {
      setName(appt.name);
      setDate(appt.start.slice(0, 10));
      setStartTime(appt.start.slice(11, 16));
      setEndTime(appt.end.slice(11, 16));
      setStatus(appt.status || 'SCH');
      setService(appt.service);
      setNotes(appt.notes);
      setBpId(appt.bpartnerId || 0);
    } else {
      setName('');
      setDate(dialog.defaultDate || new Date().toISOString().slice(0, 10));
      setStartTime(dialog.defaultStart || '09:00');
      setEndTime(dialog.defaultEnd || '09:30');
      setStatus('SCH');
      setService('');
      setNotes('');
      setBpId(0);
      setSelectedRids([]);
    }
    setBpSearch('');
    setBpResults([]);
    setBpInfo('');
  }, [dialog, isEdit, appt]);

  // Service preset → auto-calculate end time
  function handleServiceChange(svc: string) {
    setService(svc);
    const preset = SERVICE_PRESETS.find(s => s.name === svc);
    if (!preset || !startTime) return;
    const [h, m] = startTime.split(':').map(Number);
    const endMin = h * 60 + m + preset.minutes;
    setEndTime(`${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`);
  }

  // BPartner search
  useEffect(() => {
    if (bpSearch.length < 2) { setBpResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await api.searchBPartners(bpSearch);
        setBpResults(results);
      } catch { setBpResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [bpSearch]);

  function selectBp(bp: BPartnerResult) {
    setBpId(bp.id);
    setName(bp.Name);
    setBpResults([]);
    setBpSearch('');
    const parts: string[] = [];
    if (bp.Phone) parts.push(`📞 ${bp.Phone}`);
    if (bp.EMail) parts.push(`✉️ ${bp.EMail}`);
    setBpInfo(parts.join(' | '));
  }

  // Save
  async function handleSave() {
    if (!name.trim()) { toast('請輸入姓名', 'error'); return; }
    if (!date || !startTime || !endTime) { toast('請填寫完整時段', 'error'); return; }
    setSaving(true);
    try {
      if (isEdit && appt) {
        await onUpdate(appt, { name: name.trim(), status, date, startTime, endTime, notes: notes.trim() });
        toast('預約已更新');
      } else {
        if (selectedRids.length === 0) { toast('請選擇至少一個資源', 'error'); setSaving(false); return; }
        await onBook({ name: name.trim(), date, startTime, endTime, service, notes: notes.trim(), resourceIds: selectedRids, bpartnerId: bpId });
        toast('預約已建立');
      }
      onClose();
    } catch (e) {
      toast((isEdit ? '更新' : '建立') + '失敗：' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setSaving(false);
    }
  }

  // Cancel appointment
  async function handleCancel() {
    if (!appt || !confirm('確定要取消此預約？')) return;
    try {
      await onCancel(appt);
      toast('預約已取消');
      onClose();
    } catch (e) {
      toast('取消失敗', 'error');
    }
  }

  // Resource tag editor (edit mode)
  async function handleAddResource(rid: number) {
    if (!appt) return;
    try {
      await onGroupAdd(appt, rid);
      toast('資源已加入');
    } catch (e) {
      toast(e instanceof Error ? e.message : '加入失敗', 'error');
    }
  }

  async function handleRemoveResource(assignmentId: number) {
    if (!appt) return;
    try {
      await onGroupRemove(assignmentId, appt);
      toast('資源已移除');
    } catch (e) {
      toast(e instanceof Error ? e.message : '移除失敗', 'error');
    }
  }

  // Linked / unlinked resources for edit mode
  const linkedRids = appt?.resources.map(r => r.resourceId) || [];
  const unlinkedResources = resources.filter(r => !linkedRids.includes(r.id));

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog">
        <h3>{isEdit ? '編輯預約' : '新增預約'}</h3>

        <div className="dialog-field">
          <label>姓名</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="病患姓名" />
        </div>

        <div className="dialog-field">
          <label>病患搜尋</label>
          <input type="text" value={bpSearch} onChange={e => setBpSearch(e.target.value)} placeholder="搜尋已有病患..." />
          {bpResults.length > 0 && (
            <div className="search-results" style={{ display: 'block' }}>
              {bpResults.map(bp => (
                <div key={bp.id} className="search-result-item" onClick={() => selectBp(bp)}>
                  {bp.Name}{bp.Phone ? ` 📞${bp.Phone}` : ''}
                </div>
              ))}
            </div>
          )}
          {bpInfo && <div style={{ fontSize: '0.85em', marginTop: 4, padding: 8, background: '#f9fafb', borderRadius: 4 }}>{bpInfo}</div>}
        </div>

        <div className="dialog-field">
          <label>資源</label>
          {isEdit && appt ? (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {appt.resources.map(r => {
                  const res = resources.find(x => x.id === r.resourceId);
                  return (
                    <span key={r.assignmentId} className="resource-tag"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 8px', borderRadius: 12, fontSize: 12, background: res?._color || '#999', color: '#fff' }}>
                      {res?.Name}
                      <span style={{ cursor: 'pointer', marginLeft: 2, fontSize: 14, opacity: 0.7 }}
                        onClick={() => handleRemoveResource(r.assignmentId)}>✕</span>
                    </span>
                  );
                })}
              </div>
              {unlinkedResources.length > 0 && (
                <select value="" onChange={e => { const v = parseInt(e.target.value); if (v) handleAddResource(v); }}
                  style={{ fontSize: 12, padding: '2px 4px' }}>
                  <option value="">＋ 加入資源...</option>
                  {unlinkedResources.map(r => <option key={r.id} value={r.id}>{r.Name}</option>)}
                </select>
              )}
            </div>
          ) : (
            <div>
              {resources.map(r => (
                <label key={r.id} style={{ display: 'block', margin: '2px 0' }}>
                  <input type="checkbox" checked={selectedRids.includes(r.id)}
                    onChange={e => setSelectedRids(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} />
                  <span className="color-dot" style={{ background: r._color }} /> {r.Name}
                </label>
              ))}
            </div>
          )}
        </div>

        {!isEdit && (
          <div className="dialog-field">
            <label>服務項目</label>
            <select value={service} onChange={e => handleServiceChange(e.target.value)}>
              <option value="">-- 選擇 --</option>
              {SERVICE_PRESETS.map(s => <option key={s.name} value={s.name}>{s.name} ({s.minutes}分)</option>)}
            </select>
          </div>
        )}

        <div className="dialog-field">
          <label>日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="dialog-field">
          <label>開始時間</label>
          <input type="time" step={900} value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div className="dialog-field">
          <label>結束時間</label>
          <input type="time" step={900} value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>

        {isEdit && (
          <div className="dialog-field">
            <label>狀態</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {statusList.map(s => <option key={s.Value} value={s.Value}>{s.Name}</option>)}
            </select>
          </div>
        )}

        <div className="dialog-field">
          <label>備註</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>取消</button>
          {isEdit && <button className="btn btn-danger" onClick={handleCancel}>取消預約</button>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '處理中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
