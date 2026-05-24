'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';
import { Icon } from '@/components/icons/Icon';

export default function AdminProfileClient() {
  const router = useRouter();
  const admin = useAdminStore((s) => s.admin);
  const loading = useAdminStore((s) => s.loading);
  const authenticated = useAdminStore((s) => s.authenticated);
  const initialized = useAdminStore((s) => s.initialized);
  const checkSession = useAdminStore((s) => s.checkSession);
  const logout = useAdminStore((s) => s.logout);

  useEffect(() => {
    if (!initialized) checkSession();
  }, [initialized, checkSession]);

  useEffect(() => {
    if (initialized && !authenticated) {
      router.push('/admin/login');
    }
  }, [initialized, authenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  if (loading || !initialized) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-white text-lg font-bold flex items-center gap-2">
        <Icon name="User" size={20} className="text-orange-400" />
        Admin Profile
      </h2>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-lg shrink-0">
            {(admin?.username || 'A')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold">{admin?.username}</p>
            <p className="text-white/40 text-xs font-mono">ID: {admin?.id?.slice(0, 8)}...</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Role</span>
            <span className="text-white font-medium">
              {admin?.role === 'super_admin' ? 'Super Admin' : 'Moderator'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Permissions</span>
            <span className="text-white font-medium tabular-nums">
              {admin?.permissions?.length ?? 0}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-11"
      >
        <Icon name="LogOut" size={16} />
        Logout
      </button>
    </div>
  );
}
