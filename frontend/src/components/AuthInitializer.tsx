'use client';

import { useEffect } from 'react';
import { getFingerprint } from '@/lib/fingerprint';
import { useAuthStore } from '@/stores/auth';

export default function AuthInitializer() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (initialized) return;

    const init = () => {
      getFingerprint().then(() => fetchUser());
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(init, { timeout: 2000 });
    } else {
      setTimeout(init, 300);
    }
  }, [initialized, fetchUser]);

  return null;
}
