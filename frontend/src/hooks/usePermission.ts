'use client';
import { useAdminStore } from '@/stores/admin';

export function usePermission(permission: string): { allowed: boolean; loading: boolean } {
  const admin = useAdminStore((s) => s.admin);
  const initialized = useAdminStore((s) => s.initialized);

  if (!initialized) return { allowed: false, loading: true };
  if (!admin) return { allowed: false, loading: false };
  if (admin.role === 'super_admin') return { allowed: true, loading: false };
  return { allowed: (admin.permissions as string[])?.includes(permission) ?? false, loading: false };
}
