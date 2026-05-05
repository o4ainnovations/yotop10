'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';

export default function AdminHomePage() {
  const router = useRouter();
  const admin = useAdminStore((s) => s.admin);
  const loading = useAdminStore((s) => s.loading);
  const authenticated = useAdminStore((s) => s.authenticated);
  const initialized = useAdminStore((s) => s.initialized);
  const checkSession = useAdminStore((s) => s.checkSession);

  useEffect(() => {
    if (!initialized) checkSession();
  }, [initialized, checkSession]);

  useEffect(() => {
    if (initialized && !authenticated) {
      router.push('/admin/login');
    }
  }, [initialized, authenticated, router]);

  if (loading || !initialized) return <div>Loading...</div>;

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <p>Welcome, {admin?.username}</p>
      <div style={{ marginTop: '30px' }}>
        <h3>Quick Links</h3>
        <ul>
          <li><button onClick={() => router.push('/admin/posts/pending')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Pending Posts</button></li>
          <li><button onClick={() => router.push('/admin/audit')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Audit Logs</button></li>
          <li>All Posts</li>
          <li>Comments</li>
          <li>Categories</li>
          <li>Users</li>
          <li>Settings</li>
        </ul>
      </div>
    </div>
  );
}
