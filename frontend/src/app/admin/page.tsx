'use client';

import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

export default function AdminDashboard() {
  const router = useRouter();
  const admin = useAdminStore(s => s.admin);

  const actionCards = [
    { title: 'Pending Posts', icon: 'FileText' as const, desc: 'Review and moderate submitted posts', href: '/admin/posts/pending' },
    { title: 'Statistics', icon: 'ChartBar' as const, desc: 'Deep platform analytics and trends', href: '/admin/statistics' },
    { title: 'Audit Logs', icon: 'ClipboardList' as const, desc: 'All admin actions and login history', href: '/admin/audit' },
    { title: 'Profile', icon: 'User' as const, desc: 'View your admin account', href: '/admin/profile' },
  ];

  return (
    <div>
      <h2 style={{ color: 'var(--text-primary)' }}>Welcome, {admin?.username || 'Admin'}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Use the sidebar to navigate. Quick actions below.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {actionCards.map(card => (
          <button key={card.href} onClick={() => router.push(card.href)}
            style={{
              padding: '20px',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              background: 'var(--bg-secondary)',
              transition: 'border-color var(--transition), box-shadow var(--transition)',
              boxShadow: 'var(--shadow-sm)',
              display: 'block',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Icon name={card.icon as LucideIconName} size={18} color="var(--accent)" /> {card.title}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
