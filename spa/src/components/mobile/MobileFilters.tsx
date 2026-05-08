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
  onClose: () => void;
}

export default function MobileFilters({
  resources, serviceList, selectedResources, selectedServices, showCancelled,
  onToggleResource, onToggleAllResources, onToggleService, onToggleAllServices, onSetShowCancelled, onClose,
}: Props) {
  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>篩選</h2>
          <button onClick={() => { onToggleAllResources(); onToggleAllServices(); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, cursor: 'pointer' }}>
            重置
          </button>
        </div>
        <div className="sheet-body">
          {/* Resources */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>資源</label>
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
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>服務</label>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, cursor: 'pointer' }}>
            <input type="checkbox" checked={showCancelled} onChange={e => onSetShowCancelled(e.target.checked)} style={{ width: 20, height: 20 }} />
            顯示已取消/未到
          </label>
        </div>
      </div>
    </>
  );
}
