interface Props {
  active: string;
  onChange: (tab: string) => void;
}

const TABS = [
  { id: 'today', icon: '📋', label: '今日' },
  { id: 'calendar', icon: '📅', label: '行事曆' },
  { id: 'search', icon: '🔍', label: '搜尋' },
  { id: 'settings', icon: '⚙️', label: '設定' },
];

export default function BottomTabs({ active, onChange }: Props) {
  return (
    <nav className="bottom-tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`bottom-tab${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
          aria-label={t.label}
        >
          <span className="bottom-tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
