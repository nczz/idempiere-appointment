import { useEffect, useState, lazy, Suspense } from 'react';
import { useAppState } from './hooks/useAppState';
import './style.css';

const DesktopLayout = lazy(() => import('./layouts/DesktopLayout'));
const MobileLayout = lazy(() => import('./layouts/MobileLayout'));

export default function App() {
  const state = useAppState();
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  const [tablet, setTablet] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024);

  useEffect(() => { state.loadInit(); }, []);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setMobile(w < 1024);
      setTablet(w >= 768 && w < 1024);
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="app-container">
      <Suspense fallback={<div style={{ padding: 24 }}>載入中...</div>}>
        {mobile ? <MobileLayout state={state} tablet={tablet} /> : <DesktopLayout state={state} />}
      </Suspense>

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000 }}>
        {state.toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {state.error && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,.3)', zIndex: 3000 }}>
          <p style={{ color: '#d32f2f' }}>{state.error}</p>
        </div>
      )}
    </div>
  );
}
