'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';

export default function AdminProfilePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const adminData = await API.adminGetMe();
        setAdmin(adminData);
      } catch {
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await API.adminLogout();
      router.push('/admin/login');
    } catch {
      alert('Logout failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Admin Profile</h2>
      
      <div style={{ marginTop: '20px' }}>
        <p><strong>Username:</strong> {admin?.username}</p>
        <p><strong>Admin ID:</strong> {admin?.id}</p>
        
        <button 
          onClick={handleLogout}
          style={{ marginTop: '20px', padding: '10px 20px' }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
