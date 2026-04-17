'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await API.adminGetMe();
      } catch {
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>YoTop10 Admin</h1>
          </div>
          <div>
            <button onClick={() => router.push('/admin/profile')} style={{ marginRight: '10px' }}>Profile</button>
            <button onClick={() => router.push('/admin/posts/pending')} style={{ marginRight: '10px' }}>Pending Posts</button>
            <button onClick={() => router.push('/admin')}>Dashboard</button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
