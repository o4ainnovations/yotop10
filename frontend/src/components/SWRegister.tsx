'use client';

import { useEffect, useState } from 'react';
import { registerSW, sendSkipWaiting } from '@/app/sw-register';

export default function SWRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    registerSW({
      onUpdate: () => setUpdateAvailable(true),
      onSuccess: () => {
        // no-op for now
      },
    });

    // Listen for broadcast messages from service worker
    navigator.serviceWorker?.addEventListener('message', (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      // narrow to known shape
      if ((data as { type?: string }).type === 'NEW_VERSION_AVAILABLE') setUpdateAvailable(true);
    });
  }, []);

  if (!updateAvailable) return null;

  const triggerReplay = () => {
    try {
      // typed global from src/types/sw.d.ts - access via narrowed unknown to avoid 'as any'
      const w = window as unknown as { __yotop10_replayQueue?: () => void };
      w.__yotop10_replayQueue?.();
    } catch {}
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13 }}>A new version is available</span>
        <button onClick={() => sendSkipWaiting()} style={{ padding: '6px 10px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 6 }}>Update</button>
        <button onClick={triggerReplay} style={{ padding: '6px 10px', background: '#222', color: '#fff', border: 'none', borderRadius: 6 }}>Flush queue</button>
      </div>
    </div>
  );
}
