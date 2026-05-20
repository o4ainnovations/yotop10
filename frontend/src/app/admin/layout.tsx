'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';
import AdminClientShell from './AdminClientShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, initialized, authenticated, admin, checkSession } = useAdminStore();
  const isLoginOrSetup = pathname === '/admin/login' || pathname === '/admin/setup';

  useEffect(() => { checkSession(); }, [checkSession]);

  useEffect(() => {
    if (initialized && authenticated && isLoginOrSetup) {
      router.replace('/admin');
    }
  }, [initialized, authenticated, isLoginOrSetup, router]);

  if (isLoginOrSetup) {
    if (loading || !initialized) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950">
          <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
        </div>
      );
    }
    if (authenticated) {
      return null;
    }
    return <>{children}</>;
  }

  if (loading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (authenticated && admin) {
    return (
      <AdminClientShell admin={admin}>
        {children}
      </AdminClientShell>
    );
  }

  return null;
}
