'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';

const SIDEBAR_STYLE: Record<string, React.CSSProperties> = {
  sidebar: { width: '200px', minHeight: '100vh', borderRight: '1px solid #ddd', padding: '16px 0', background: '#fafafa', flexShrink: 0 },
  logo: { padding: '0 16px 16px', fontWeight: 'bold', fontSize: '16px', borderBottom: '1px solid #eee', marginBottom: '8px' },
  navItem: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#333' },
  navItemActive: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', background: '#e3f2fd', cursor: 'pointer', fontSize: '13px', color: '#1565c0', fontWeight: 'bold' },
  main: { flex: 1, padding: '20px', overflow: 'auto' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, initialized, authenticated, checkSession } = useAdminStore();

  useEffect(() => { checkSession(); }, [checkSession]);
  useEffect(() => { if (initialized && !authenticated && pathname !== '/admin/login' && pathname !== '/admin/setup') router.push('/admin/login'); }, [initialized, authenticated, router, pathname]);

  if (loading || !initialized) return <div>Loading...</div>;

  const nav = (href: string, label: string) => <button onClick={() => router.push(href)} style={pathname === href || pathname.startsWith(href + '/') ? SIDEBAR_STYLE.navItemActive : SIDEBAR_STYLE.navItem}>{label}</button>;

  return <div style={{ display: 'flex', minHeight: '100vh' }}>
    <div style={SIDEBAR_STYLE.sidebar}>
      <div style={SIDEBAR_STYLE.logo}>YoTop10 Admin</div>
      {nav('/admin', 'Dashboard')}
      {nav('/admin/posts/pending', 'Pending Posts')}
      {nav('/admin/posts', 'All Posts')}
      {nav('/admin/comments', 'Comments')}
      {nav('/admin/categories', 'Categories')}
      {nav('/admin/statistics', 'Statistics')}
      {nav('/admin/alerts', 'Alerts')}
      {nav('/admin/notifications', 'Notifications')}
      {nav('/admin/search', 'Search')}
      {nav('/admin/audit', 'Audit Logs')}
      <div style={{ borderTop: '1px solid #eee', marginTop: '16px', paddingTop: '8px' }}>
        {nav('/admin/profile', 'Profile')}
        <button onClick={async () => { const { API } = await import('@/lib/api'); await API.adminLogout(); router.push('/admin/login'); }} style={{ ...SIDEBAR_STYLE.navItem, color: '#c62828' }}>Logout</button>
      </div>
    </div>
    <div style={SIDEBAR_STYLE.main}>{children}</div>
  </div>;
}
