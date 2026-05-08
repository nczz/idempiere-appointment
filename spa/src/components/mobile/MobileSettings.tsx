import type { Resource, ResourceType, Status, ServicePreset } from '../../types';

interface Props {
  resources: Resource[];
  resourceTypes: ResourceType[];
  statusList: Status[];
  serviceList: ServicePreset[];
  selectedResources: Set<number>;
  selectedServices: Set<string>;
  showCancelled: boolean;
  onToggleResource: (id: number) => void;
  onToggleAllResources: () => void;
  onToggleService: (name: string) => void;
  onToggleAllServices: () => void;
  onSetShowCancelled: (v: boolean) => void;
}

export default function MobileSettings({
  resources, resourceTypes, statusList, serviceList,
  selectedResources, selectedServices, showCancelled,
  onToggleResource, onToggleAllResources, onToggleService, onToggleAllServices, onSetShowCancelled,
}: Props) {
  return (
    <div className="mobile-content">
      {/* Filters section */}
      <div className="m-settings-section">
        <h3>篩選</h3>

        {/* Resources */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>資源</span>
            <button onClick={onToggleAllResources} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer' }}>
              {selectedResources.size === resources.length ? '取消全選' : '全選'}
            </button>
          </div>
          <div className="m-chips">
            {resources.map(r => (
              <button key={r.id} className={`m-chip${selectedResources.has(r.id) ? ' selected' : ''}`} onClick={() => onToggleResource(r.id)}>
                {r.Name}
              </button>
            ))}
          </div>
        </div>

        {/* Services */}
        {serviceList.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>服務</span>
              <button onClick={onToggleAllServices} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer' }}>
                {selectedServices.size === serviceList.length ? '取消全選' : '全選'}
              </button>
            </div>
            <div className="m-chips">
              {serviceList.map(s => (
                <button key={s.Value} className={`m-chip${selectedServices.has(s.Value) ? ' selected' : ''}`} onClick={() => onToggleService(s.Value)}>
                  {s.Name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show cancelled */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, cursor: 'pointer', padding: '8px 0' }}>
          <input type="checkbox" checked={showCancelled} onChange={e => onSetShowCancelled(e.target.checked)} style={{ width: 20, height: 20 }} />
          顯示已取消/未到
        </label>
      </div>

      {/* Status legend */}
      <div className="m-settings-section">
        <h3>狀態圖例</h3>
        {statusList.map(s => (
          <div key={s.Value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.Description || '#999', flexShrink: 0 }} />
            <span style={{ fontSize: 14 }}>{s.Name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({s.Value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
