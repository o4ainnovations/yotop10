'use client';

import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>YoTop10 Admin</h1>
          </div>
          <div>
            <button onClick={() => router.push('/admin/profile')} style={{ marginRight: '10px' }}>Profile</button>
            <button onClick={() => router.push('/admin')}>Dashboard</button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
