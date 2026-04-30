'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';

export default function AdminProfilePage() {
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

  if (loading || !initialized) return <div>Loading...</div>;

  return (
    <div>
      <h2>Admin Profile</h2>
      <div style={{ marginTop: '20px' }}>
        <p><strong>Username:</strong> {admin?.username}</p>
        <p><strong>Admin ID:</strong> {admin?.id}</p>
        <button onClick={handleLogout} style={{ marginTop: '20px', padding: '10px 20px' }}>
          Logout
        </button>
      </div>
    </div>
  );
}
