'use client';

import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

const actionCards = [
  { title: 'Pending Posts', icon: 'FileText' as const, desc: 'Review and moderate submitted posts', href: '/admin/posts/pending' },
  { title: 'Statistics', icon: 'ChartBar' as const, desc: 'Deep platform analytics and trends', href: '/admin/statistics' },
  { title: 'Audit Logs', icon: 'ClipboardList' as const, desc: 'All admin actions and login history', href: '/admin/audit' },
  { title: 'Profile', icon: 'User' as const, desc: 'View your admin account', href: '/admin/profile' },
];

const quickLinks = [
  { title: 'All Posts', icon: 'FileText' as const, href: '/admin/posts' },
  { title: 'Comments', icon: 'MessageCircle' as const, href: '/admin/comments' },
  { title: 'Categories', icon: 'FolderTree' as const, href: '/admin/categories' },
  { title: 'Users', icon: 'Users' as const, href: '/admin/users' },
  { title: 'Search', icon: 'Search' as const, href: '/admin/search' },
  { title: 'Alerts', icon: 'BellDot' as const, href: '/admin/alerts' },
  { title: 'Notifications', icon: 'Mail' as const, href: '/admin/notifications' },
  { title: 'Hall of Fame', icon: 'Star' as const, href: '/admin/hall-of-fame' },
  { title: 'Mods', icon: 'Shield' as const, href: '/admin/settings/mods' },
  { title: 'AI Moderation', icon: 'Bot' as const, href: '/admin/settings/ai-moderation' },
  { title: 'Config', icon: 'Settings' as const, href: '/admin/config' },
];

export default function AdminClient() {
  const router = useRouter();
  const admin = useAdminStore(s => s.admin);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-xl font-bold">Welcome, {admin?.username || 'Admin'}</h2>
        <p className="text-white/50 text-sm mt-1">Use the sidebar to navigate. Quick actions below.</p>
      </div>

      {/* Action cards: stack on mobile, 2-col on small, 4-col on large */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {actionCards.map(card => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 text-left transition-all duration-200 hover:border-orange-500/50 hover:bg-white/5 cursor-pointer w-full"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <Icon name={card.icon as LucideIconName} size={18} color="var(--color-orange-400)" />
              <span className="text-white font-semibold text-sm sm:text-base">{card.title}</span>
            </div>
            <p className="text-white/40 text-xs leading-relaxed">{card.desc}</p>
          </button>
        ))}
      </div>

      {/* Quick links: 2-column grid on mobile, wider on desktop */}
      <div>
        <h3 className="text-white text-sm font-bold mb-3">Quick Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {quickLinks.map(link => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:border-orange-500/50 hover:bg-white/5 cursor-pointer flex items-center gap-2 min-h-11 w-full"
            >
              <Icon name={link.icon as LucideIconName} size={14} color="var(--color-orange-400)" />
              <span className="text-white/60 text-xs">{link.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
