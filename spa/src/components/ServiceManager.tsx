import { useState, useEffect } from 'react';
import type { ServicePreset } from '../types';
import * as api from '../api';

interface Props {
  onClose: () => void;
  onUpdated: () => void;
}

export default function ServiceManager({ onClose, onUpdated }: Props) {
  const [services, setServices] = useState<(ServicePreset & { id: number })[]>([]);
  const [newName, setNewName] = useState('');
  const [newMinutes, setNewMinutes] = useState(30);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editMinutes, setEditMinutes] = useState(30);
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api.getServices();
    setServices(data as (ServicePreset & { id: number })[]);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api.createService(newName.trim(), newMinutes);
      setNewName('');
      setNewMinutes(30);
      await load();
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增失敗');
    }
    setLoading(false);
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      await api.updateService(id, editName.trim(), editMinutes);
      setEditId(null);
      await load();
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新失敗');
    }
    setLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`確定停用「${name}」？已建立的預約不受影響。`)) return;
    setLoading(true);
    try {
      await api.deleteService(id);
      await load();
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
    setLoading(false);
  }

  function startEdit(svc: ServicePreset & { id: number }) {
    setEditId(svc.id);
    setEditName(svc.Name);
    setEditMinutes(svc.minutes);
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" style={{ maxWidth: 480 }}>
        <h3>管理服務項目</h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 4px' }}>名稱</th>
              <th style={{ textAlign: 'center', padding: '6px 4px', width: 70 }}>分鐘</th>
              <th style={{ textAlign: 'center', padding: '6px 4px', width: 90 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {services.map(svc => (
              <tr key={svc.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                {editId === svc.id ? (
                  <>
                    <td style={{ padding: '4px' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        style={{ width: '100%', padding: '2px 4px', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      <input type="number" value={editMinutes} onChange={e => setEditMinutes(parseInt(e.target.value) || 0)}
                        style={{ width: 50, textAlign: 'center', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      <button onClick={() => handleUpdate(svc.id)} disabled={loading}
                        style={{ fontSize: 12, padding: '2px 8px', marginRight: 4 }}>✓</button>
                      <button onClick={() => setEditId(null)} style={{ fontSize: 12, padding: '2px 8px' }}>✗</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '6px 4px' }}>{svc.Name}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>{svc.minutes}</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      <button onClick={() => startEdit(svc)} style={{ fontSize: 12, padding: '2px 8px', marginRight: 4 }}>編輯</button>
                      <button onClick={() => handleDelete(svc.id, svc.Name)}
                        style={{ fontSize: 12, padding: '2px 8px', color: '#d32f2f' }}>停用</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <input placeholder="新服務名稱" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ flex: 1, padding: '4px 8px', fontSize: 13 }} />
          <input type="number" placeholder="分鐘" value={newMinutes} onChange={e => setNewMinutes(parseInt(e.target.value) || 0)}
            style={{ width: 60, textAlign: 'center', padding: '4px', fontSize: 13 }} />
          <button onClick={handleAdd} disabled={loading || !newName.trim()}
            className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }}>新增</button>
        </div>

        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
