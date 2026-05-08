import { useState, useEffect, useRef } from 'react';
import type { Appointment, Resource, Status, ServicePreset, BPartnerResult } from '../../types';
import * as api from '../../api';

interface Props {
  mode: 'create' | 'edit';
  appointment?: Appointment;
  defaultDate?: string;
  defaultStart?: string;
  defaultEnd?: string;
  resources: Resource[];
  statusList: Status[];
  serviceList: ServicePreset[];
  onClose: () => void;
  onBook: (data: { name: string; date: string; startTime: string; endTime: string; service: string; notes: string; resourceIds: number[]; bpartnerId: number }) => Promise<void>;
  onUpdate: (appt: Appointment, data: { name: string; status: string; date: string; startTime: string; endTime: string; notes: string; service: string }) => Promise<void>;
  onCancel: (appt: Appointment) => Promise<void>;
  onGroupAdd?: (appt: Appointment, resourceId: number) => Promise<void>;
  onGroupRemove?: (assignmentId: number, appt: Appointment) => Promise<void>;
  toast: (msg: string, type?: string) => void;
}

export default function BookingSheet({ mode, appointment: appt, defaultDate, defaultStart, defaultEnd, resources, statusList, serviceList, onClose, onBook, onUpdate, onCancel, onGroupAdd, onGroupRemove, toast }: Props) {
  const isEdit = mode === 'edit';
  const sheetRef = useRef<HTMLDivElement>(null);

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
  const [saving, setSaving] = useState(false);

  // Keyboard handling: scroll focused input into view
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      if (sheetRef.current) {
        const active = document.activeElement as HTMLElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
          setTimeout(() => active.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
        }
      }
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

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
      setSelectedRids(appt.resources.map(r => r.resourceId));
    } else {
      setDate(defaultDate || new Date().toISOString().slice(0, 10));
      setStartTime(defaultStart || '09:00');
      setEndTime(defaultEnd || '09:30');
    }
  }, [defaultDate, defaultStart, defaultEnd, isEdit, appt]);

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
    setBpSearch('');
    setBpResults([]);
  }

  async function handleSave() {
    if (!name.trim()) { toast('請輸入姓名', 'error'); return; }
    if (!date || !startTime || !endTime) { toast('請填寫完整時段', 'error'); return; }
    setSaving(true);
    try {
      if (isEdit && appt) {
        await onUpdate(appt, { name: name.trim(), status, date, startTime, endTime, notes: notes.trim(), service });
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

  async function handleCancel() {
    if (!appt || !confirm('確定要取消此預約？')) return;
    try {
      await onCancel(appt);
      toast('預約已取消');
      onClose();
    } catch { toast('取消失敗', 'error'); }
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet sheet-full" ref={sheetRef}>
        {/* Header */}
        <div className="sheet-header">
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          <h2>{isEdit ? '編輯預約' : '新增預約'}</h2>
          <button className="m-btn m-btn-primary" style={{ padding: '8px 16px', width: 'auto' }} onClick={handleSave} disabled={saving}>
            {saving ? '...' : '儲存'}
          </button>
        </div>

        {/* Form */}
        <div className="sheet-body">
          <div className="m-field">
            <label>客戶</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="客戶姓名" />
          </div>

          <div className="m-field">
            <label>搜尋客戶</label>
            <input type="text" value={bpSearch} onChange={e => setBpSearch(e.target.value)} placeholder="搜尋已有客戶..." />
            {bpResults.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 150, overflow: 'auto' }}>
                {bpResults.map(bp => (
                  <div key={bp.id} style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => selectBp(bp)}>
                    {bp.Name}{bp.Phone ? ` · ${bp.Phone}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="m-field">
            <label>服務項目</label>
            <select value={service} onChange={e => setService(e.target.value)}>
              <option value="">-- 選擇 --</option>
              {serviceList.map(s => <option key={s.Value} value={s.Value}>{s.Name} ({s.minutes}分)</option>)}
            </select>
          </div>

          <div className="m-field">
            <label>日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="m-field" style={{ flex: 1 }}>
              <label>開始</label>
              <input type="time" step={900} value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="m-field" style={{ flex: 1 }}>
              <label>結束</label>
              <input type="time" step={900} value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="m-field">
            <label>資源</label>
            <div className="m-tags" style={{ marginBottom: 8 }}>
              {isEdit && appt ? (
                // Edit mode: show actual assignment resources, add/remove calls API immediately
                appt.resources.map(r => {
                  const res = resources.find(x => x.id === r.resourceId);
                  if (!res) return null;
                  return (
                    <span key={r.assignmentId} className="m-tag" style={{ background: res._color }}>
                      {res.Name}
                      {appt.resources.length > 1 && onGroupRemove && (
                        <button className="m-tag-remove" onClick={async () => {
                          try { await onGroupRemove(r.assignmentId, appt); toast('資源已移除'); } catch { toast('移除失敗', 'error'); }
                        }}>✕</button>
                      )}
                    </span>
                  );
                })
              ) : (
                // Create mode: local state
                selectedRids.map(rid => {
                  const res = resources.find(x => x.id === rid);
                  if (!res) return null;
                  return (
                    <span key={rid} className="m-tag" style={{ background: res._color }}>
                      {res.Name}
                      <button className="m-tag-remove" onClick={() => setSelectedRids(prev => prev.filter(id => id !== rid))}>✕</button>
                    </span>
                  );
                })
              )}
            </div>
            {isEdit && appt && onGroupAdd ? (
              // Edit mode: add calls API immediately
              resources.filter(r => !appt.resources.some(ar => ar.resourceId === r.id)).length > 0 && (
                <select value="" onChange={async e => {
                  const v = parseInt(e.target.value);
                  if (!v) return;
                  try { await onGroupAdd(appt, v); toast('資源已加入'); } catch (err) { toast(err instanceof Error ? err.message : '加入失敗', 'error'); }
                }}>
                  <option value="">＋ 加入資源...</option>
                  {resources.filter(r => !appt.resources.some(ar => ar.resourceId === r.id)).map(r => (
                    <option key={r.id} value={r.id}>{r.Name}</option>
                  ))}
                </select>
              )
            ) : (
              // Create mode: local state
              resources.filter(r => !selectedRids.includes(r.id)).length > 0 && (
                <select value="" onChange={e => { const v = parseInt(e.target.value); if (v) setSelectedRids(prev => [...prev, v]); }}>
                  <option value="">＋ 加入資源...</option>
                  {resources.filter(r => !selectedRids.includes(r.id)).map(r => (
                    <option key={r.id} value={r.id}>{r.Name}</option>
                  ))}
                </select>
              )
            )}
          </div>

          {isEdit && (
            <div className="m-field">
              <label>狀態</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {statusList.map(s => <option key={s.Value} value={s.Value}>{s.Name}</option>)}
              </select>
            </div>
          )}

          <div className="m-field">
            <label>備註</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {isEdit && appt && (
            <button className="m-btn m-btn-danger" style={{ width: '100%', marginTop: 16 }} onClick={handleCancel}>
              取消預約
            </button>
          )}
        </div>
      </div>
    </>
  );
}
