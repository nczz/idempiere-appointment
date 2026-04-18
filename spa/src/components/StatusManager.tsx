import { useState } from 'react';
import * as api from '../api';
import type { Status } from '../types';

interface Props {
  statuses: Status[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function StatusManager({ statuses, onClose, onUpdated }: Props) {
  const [edits, setEdits] = useState<Record<string, { name: string; color: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function startEdit(s: Status) {
    setEdits(prev => ({ ...prev, [s.Value]: { name: s.Name, color: s.Description } }));
  }

  function cancelEdit(value: string) {
    setEdits(prev => { const n = { ...prev }; delete n[value]; return n; });
  }

  async function save(value: string) {
    const e = edits[value];
    if (!e || !e.name.trim()) return;
    setSaving(value);
    try {
      await api.apptFetch('statuses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, name: e.name.trim(), color: e.color }),
      });
      cancelEdit(value);
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
    setSaving(null);
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" style={{ maxWidth: 440 }}>
        <h3>狀態管理</h3>
        <p style={{ fontSize: '0.85em', color: '#666', margin: '0 0 12px' }}>
          修改僅影響您的租戶，不影響其他租戶。狀態代碼不可變更。
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', fontSize: '0.85em', color: '#666' }}>
              <th style={{ textAlign: 'left', padding: '4px' }}>代碼</th>
              <th style={{ textAlign: 'left', padding: '4px' }}>名稱</th>
              <th style={{ textAlign: 'center', padding: '4px' }}>顏色</th>
              <th style={{ textAlign: 'right', padding: '4px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map(s => {
              const e = edits[s.Value];
              return (
                <tr key={s.Value} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontSize: '0.85em' }}>{s.Value}</td>
                  {e ? (
                    <>
                      <td style={{ padding: '4px' }}>
                        <input type="text" value={e.name}
                          onChange={ev => setEdits(prev => ({ ...prev, [s.Value]: { ...prev[s.Value], name: ev.target.value } }))}
                          style={{ width: '100%', padding: '2px 4px' }} />
                      </td>
                      <td style={{ padding: '4px', textAlign: 'center' }}>
                        <input type="color" value={e.color}
                          onChange={ev => setEdits(prev => ({ ...prev, [s.Value]: { ...prev[s.Value], color: ev.target.value } }))}
                          style={{ width: 32, height: 24, border: 'none', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => save(s.Value)} disabled={saving === s.Value}
                          style={{ marginRight: 4, padding: '2px 8px' }}>
                          {saving === s.Value ? '...' : '儲存'}
                        </button>
                        <button onClick={() => cancelEdit(s.Value)} style={{ padding: '2px 8px' }}>取消</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '6px 4px' }}>{s.Name}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', width: 20, height: 20, borderRadius: 4,
                          backgroundColor: s.Description, border: '1px solid #ccc', verticalAlign: 'middle'
                        }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                        <button onClick={() => startEdit(s)} style={{ padding: '2px 8px' }}>編輯</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
