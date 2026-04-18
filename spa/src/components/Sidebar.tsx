import { useState } from 'react';
import type { Resource, ResourceType, Status, Assignment } from '../types';
import * as api from '../api';

interface Props {
  resources: Resource[];
  resourceTypes: ResourceType[];
  statusList: Status[];
  selectedResources: Set<number>;
  showCancelled: boolean;
  onToggleResource: (id: number) => void;
  onSetShowCancelled: (v: boolean) => void;
  onJumpToDate: (date: string) => void;
  onManageServices: () => void;
  onManageResources: () => void;
  onManageStatuses: () => void;
}

export default function Sidebar({
  resources, resourceTypes, statusList,
  selectedResources, showCancelled,
  onToggleResource, onSetShowCancelled, onJumpToDate, onManageServices, onManageResources, onManageStatuses,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Assignment[]>([]);

  // Group resources by type
  const byType: Record<number, Resource[]> = {};
  resources.forEach(r => {
    const tid = r.S_ResourceType_ID;
    if (!byType[tid]) byType[tid] = [];
    byType[tid].push(r);
  });

  // Search
  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    try {
      const results = await api.searchAssignments(q.trim());
      setSearchResults(results);
    } catch { setSearchResults([]); }
  }

  function handleSearchClick(date: string) {
    onJumpToDate(date);
    setSearchQuery('');
    setSearchResults([]);
  }

  return (
    <aside className="sidebar">
      {/* Search */}
      <div className="sidebar-section">
        <input type="text" className="search-input" placeholder="🔍 搜尋預約..."
          value={searchQuery} onChange={e => handleSearch(e.target.value)} />
        {searchResults.length > 0 && (
          <div className="search-results" style={{ display: 'block', marginTop: 8 }}>
            {searchResults.map(a => {
              const date = a.AssignDateFrom?.slice(0, 10) || '';
              const time = a.AssignDateFrom?.slice(11, 16) || '';
              return (
                <div key={a.id} className="search-result-item" onClick={() => handleSearchClick(date)}>
                  <span style={{ color: '#757575', fontSize: 12 }}>{date} {time}</span>{' '}
                  <strong>{a.Name}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resource Panel */}
      <div className="sidebar-section">
        {Object.entries(byType).map(([typeId, items]) => {
          const typeName = resourceTypes.find(t => t.id === parseInt(typeId))?.Name || '其他';
          return (
            <div key={typeId} style={{ marginBottom: 8 }}>
              <strong>{typeName}</strong>
              {items.map(r => (
                <label key={r.id} className="resource-item">
                  <input type="checkbox" checked={selectedResources.has(r.id)}
                    onChange={() => onToggleResource(r.id)} />
                  <span className="color-dot" style={{ background: r._color }} /> {r.Name}
                </label>
              ))}
            </div>
          );
        })}
      </div>

      {/* Status Legend */}
      <div className="sidebar-section">
        <strong>狀態圖例</strong>
        {statusList.map(s => (
          <div key={s.Value} className="status-legend-item">
            <span className="color-dot" style={{ background: s.Description || '#999' }} /> {s.Name}
          </div>
        ))}
      </div>

      {/* Show Cancelled Toggle */}
      <div className="sidebar-section">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showCancelled} onChange={e => onSetShowCancelled(e.target.checked)} />
          顯示已取消
        </label>
      </div>

      {/* Settings */}
      <div className="sidebar-section">
        <button onClick={onManageResources} style={{ width: '100%', padding: '6px', fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
          👥 管理資源
        </button>
        <button onClick={onManageServices} style={{ width: '100%', padding: '6px', fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
          ⚙️ 管理服務項目
        </button>
        <button onClick={onManageStatuses} style={{ width: '100%', padding: '6px', fontSize: 13, cursor: 'pointer' }}>
          🎨 管理狀態
        </button>
      </div>
    </aside>
  );
}
