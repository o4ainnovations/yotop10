'use client';

import { useState, useEffect } from 'react';
import { initToast, type ToastItem } from '@/lib/toast';

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
  error: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
  info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    initToast(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '480px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              backgroundColor: c.bg,
              border: `1px solid ${c.border}`,
              color: c.text,
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              animation: 'toastSlideUp 0.3s ease-out',
              pointerEvents: 'auto',
              textAlign: 'center',
            }}
          >
            {t.message}
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
