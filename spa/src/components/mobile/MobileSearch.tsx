import { useState, useEffect, useRef } from 'react';
import type { Assignment } from '../../types';
import * as api from '../../api';

interface Props {
  onSelect: (date: string) => void;
}

export default function MobileSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Assignment[]>([]);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function handleInput(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    timerRef.current = setTimeout(async () => {
      setSearched(true);
      try {
        const data = await api.searchAssignments(q.trim());
        setResults(data);
      } catch { setResults([]); }
    }, 400);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <input
        className="m-search-input"
        type="text"
        placeholder="🔍 搜尋預約..."
        value={query}
        onChange={e => handleInput(e.target.value)}
        autoFocus
      />
      <div className="mobile-content">
        {!searched && (
          <div className="agenda-empty">
            <p>輸入客戶姓名搜尋預約</p>
          </div>
        )}
        {searched && results.length === 0 && (
          <div className="agenda-empty">
            <p>找不到符合的預約</p>
          </div>
        )}
        {results.map(a => {
          const date = a.AssignDateFrom?.slice(0, 10) || '';
          const time = a.AssignDateFrom?.slice(11, 16) || '';
          return (
            <div key={a.id} className="m-search-result" onClick={() => onSelect(date)}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{date} {time}</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{a.Name}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
