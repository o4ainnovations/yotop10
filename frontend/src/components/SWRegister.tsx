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
    navigator.serviceWorker?.addEventListener('message', (ev) => {
      if (ev.data?.type === 'NEW_VERSION_AVAILABLE') {
        setUpdateAvailable(true);
      }
    });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13 }}>A new version is available</span>
        <button onClick={() => sendSkipWaiting()} style={{ padding: '6px 10px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 6 }}>Update</button>
      </div>
    </div>
  );
}
