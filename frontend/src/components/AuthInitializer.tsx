'use client';

import { useEffect } from 'react';
import { getFingerprint } from '@/lib/fingerprint';
import { useAuthStore } from '@/stores/auth';

export default function AuthInitializer() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) {
      getFingerprint().then(() => fetchUser());
    }
  }, [initialized, fetchUser]);

  return null;
}
