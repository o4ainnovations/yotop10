'use client';

import { useEffect, useRef } from 'react';

export default function AnalyticsBeacon() {
  const lastPath = useRef('');

  useEffect(() => {
    const sendBeacon = () => {
      const path = window.location.pathname;
      if (path === lastPath.current) return;
      lastPath.current = path;

      const fp = (() => { try { return localStorage.getItem('yotop10_fp') || null; } catch { return null; } })();

      fetch('/api/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          referer: document.referrer || null,
          user_agent: navigator.userAgent || '',
          fingerprint: fp,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    sendBeacon();
    const handlePop = () => sendBeacon();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  return null;
}
