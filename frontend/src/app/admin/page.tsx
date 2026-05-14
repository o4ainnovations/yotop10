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
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-xl font-bold">Welcome, {admin?.username || 'Admin'}</h2>
        <p className="text-white/50 text-sm mt-1">Use the sidebar to navigate. Quick actions below.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {actionCards.map(card => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 text-left transition-all duration-200 hover:border-orange-500/50 hover:bg-white/[0.07] cursor-pointer w-full"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <Icon name={card.icon as LucideIconName} size={18} color="var(--color-orange-400)" />
              <span className="text-white font-semibold text-sm sm:text-base">{card.title}</span>
            </div>
            <p className="text-white/40 text-xs leading-relaxed">{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
