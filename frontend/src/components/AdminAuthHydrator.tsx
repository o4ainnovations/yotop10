'use client';

import { useEffect } from 'react';
import { useAdminStore } from '@/stores/admin';

interface AdminData {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}

export function AdminAuthHydrator({ admin }: { admin: AdminData | null }) {
  useEffect(() => {
    if (admin) {
      useAdminStore.getState().hydrate(admin);
    }
  }, [admin]);

  return null;
}
