'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';

export default function AdminHomePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const adminData = await API.adminGetMe() as { id: string; username: string };
        setAdmin(adminData);
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
    <div>
      <h2>Admin Dashboard</h2>
      <p>Welcome, {admin?.username}</p>
      
      <div style={{ marginTop: '30px' }}>
        <h3>Quick Links</h3>
        <ul>
          <li><button onClick={() => router.push('/admin/posts/pending')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Pending Posts</button></li>
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
