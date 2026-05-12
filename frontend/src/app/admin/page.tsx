'use client';

import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

export default function AdminDashboard() {
  const router = useRouter();
  const admin = useAdminStore(s => s.admin);

  const actionCards = [
    { title: 'Pending Posts', icon: 'FileText', desc: 'Review and moderate submitted posts', href: '/admin/posts/pending', color: '#e3f2fd' },
    { title: 'Statistics', icon: 'ChartBar', desc: 'Deep platform analytics and trends', href: '/admin/statistics', color: '#e8f5e9' },
    { title: 'Audit Logs', icon: 'ClipboardList', desc: 'All admin actions and login history', href: '/admin/audit', color: '#fff3e0' },
    { title: 'Profile', icon: 'User', desc: 'View your admin account', href: '/admin/profile', color: '#f3e5f5' },
  ];

  return (
    <div>
      <h2>Welcome, {admin?.username || 'Admin'}</h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>Use the sidebar to navigate. Quick actions below.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {actionCards.map(card => (
          <button key={card.href} onClick={() => router.push(card.href)}
            style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', background: card.color, display: 'block' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name={card.icon as LucideIconName} size={18} /> {card.title}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
