import { useState, useEffect } from 'react';
import * as api from '../api';

interface ResType { id: number; Name: string; IsActive: boolean; }
interface Res { id: number; Name: string; S_ResourceType_ID: number; IsActive: boolean; }

interface Props {
  onClose: () => void;
  onUpdated: () => void;
}

export default function ResourceManager({ onClose, onUpdated }: Props) {
  const [types, setTypes] = useState<ResType[]>([]);
  const [resources, setResources] = useState<Res[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newResName, setNewResName] = useState<Record<number, string>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState<'type' | 'res'>('res');
  const [loading, setLoading] = useState(false);

  async function load() {
    const [t, r] = await Promise.all([
      fetch(`${location.origin}/appointment/resource-types`).then(r => r.json()),
      fetch(`${location.origin}/appointment/resources`).then(r => r.json()),
    ]);
    setTypes(t.types || []);
    setResources(r.resources || []);
  }

  useEffect(() => { load(); }, []);

  async function apiCall(path: string, opts: RequestInit) {
    const res = await fetch(`${location.origin}/appointment/${path}`, {
      ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed');
    return json;
  }

  async function addType() {
    if (!newTypeName.trim()) return;
    setLoading(true);
    try {
      await apiCall('resource-types', { method: 'POST', body: JSON.stringify({ name: newTypeName.trim() }) });
      setNewTypeName('');
      await load(); onUpdated();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    setLoading(false);
  }

  async function addResource(typeId: number) {
    const name = newResName[typeId]?.trim();
    if (!name) return;
    setLoading(true);
    try {
      await apiCall('resources', { method: 'POST', body: JSON.stringify({ name, resourceTypeId: String(typeId) }) });
      setNewResName(prev => ({ ...prev, [typeId]: '' }));
      await load(); onUpdated();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    setLoading(false);
  }

  async function handleUpdate() {
    if (editId == null || !editName.trim()) return;
    setLoading(true);
    try {
      const path = editTarget === 'type' ? 'resource-types' : 'resources';
      await apiCall(path, { method: 'PUT', body: JSON.stringify({ id: String(editId), name: editName.trim() }) });
      setEditId(null);
      await load(); onUpdated();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    setLoading(false);
  }

  async function handleDeactivate(id: number, name: string, target: 'type' | 'res') {
    if (!confirm(`確定停用「${name}」？`)) return;
    setLoading(true);
    try {
      const path = target === 'type' ? 'resource-types' : 'resources';
      await apiCall(`${path}?id=${id}`, { method: 'DELETE' });
      await load(); onUpdated();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    setLoading(false);
  }

  function startEdit(id: number, name: string, target: 'type' | 'res') {
    setEditId(id); setEditName(name); setEditTarget(target);
  }

  const activeTypes = types.filter(t => t.IsActive);

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" style={{ maxWidth: 520, maxHeight: '80vh', overflowY: 'auto' }}>
        <h3>資源管理</h3>

        {activeTypes.map(type => {
          const typeResources = resources.filter(r => r.S_ResourceType_ID === type.id && r.IsActive);
          return (
            <div key={type.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {editId === type.id && editTarget === 'type' ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ flex: 1, fontWeight: 'bold', fontSize: 14, padding: '2px 4px' }} />
                    <button onClick={handleUpdate} disabled={loading} style={{ fontSize: 11 }}>✓</button>
                    <button onClick={() => setEditId(null)} style={{ fontSize: 11 }}>✗</button>
                  </>
                ) : (
                  <>
                    <strong style={{ flex: 1 }}>{type.Name}</strong>
                    <button onClick={() => startEdit(type.id, type.Name, 'type')}
                      style={{ fontSize: 11, padding: '1px 6px' }}>編輯</button>
                    <button onClick={() => handleDeactivate(type.id, type.Name, 'type')}
                      style={{ fontSize: 11, padding: '1px 6px', color: '#d32f2f' }}>停用</button>
                  </>
                )}
              </div>

              {typeResources.map(res => (
                <div key={res.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0 3px 16px' }}>
                  {editId === res.id && editTarget === 'res' ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        style={{ flex: 1, fontSize: 13, padding: '2px 4px' }} />
                      <button onClick={handleUpdate} disabled={loading} style={{ fontSize: 11 }}>✓</button>
                      <button onClick={() => setEditId(null)} style={{ fontSize: 11 }}>✗</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13 }}>{res.Name}</span>
                      <button onClick={() => startEdit(res.id, res.Name, 'res')}
                        style={{ fontSize: 11, padding: '1px 6px' }}>編輯</button>
                      <button onClick={() => handleDeactivate(res.id, res.Name, 'res')}
                        style={{ fontSize: 11, padding: '1px 6px', color: '#d32f2f' }}>停用</button>
                    </>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 6, padding: '4px 0 0 16px' }}>
                <input placeholder="新增資源..." value={newResName[type.id] || ''}
                  onChange={e => setNewResName(prev => ({ ...prev, [type.id]: e.target.value }))}
                  style={{ flex: 1, fontSize: 12, padding: '3px 6px' }} />
                <button onClick={() => addResource(type.id)} disabled={loading || !newResName[type.id]?.trim()}
                  style={{ fontSize: 11, padding: '2px 10px' }}>＋</button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e0e0e0' }}>
          <input placeholder="新增資源類型..." value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
            style={{ flex: 1, fontSize: 13, padding: '4px 8px' }} />
          <button onClick={addType} disabled={loading || !newTypeName.trim()}
            className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }}>新增類型</button>
        </div>

        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
