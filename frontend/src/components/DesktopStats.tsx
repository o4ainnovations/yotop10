'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons/Icon';

interface StatsData {
  total_posts: number;
  total_debates: number;
  total_users: number;
  total_facts: number;
}

export function DesktopStats({ className = '' }: { className?: string }) {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { apiFetch } = await import('@/lib/api/client');
        const data = await apiFetch<StatsData>('/stats/platform');
        setStats(data);
      } catch { /* ignore */ }
    })();
  }, []);

  if (!stats) return null;

  const items = [
    { icon: 'FileText' as const, label: 'Posts', value: stats.total_posts.toLocaleString() },
    { icon: 'MessageCircle' as const, label: 'Debates', value: stats.total_debates.toLocaleString() },
    { icon: 'Users' as const, label: 'Curators', value: stats.total_users.toLocaleString() },
    { icon: 'Lightbulb' as const, label: 'Facts', value: stats.total_facts.toLocaleString() },
  ];

  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="ChartColumn" size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Platform</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <Icon name={item.icon} size={18} className="text-orange-400/60 mx-auto mb-1" />
            <p className="text-lg font-bold font-mono text-white">{item.value}</p>
            <p className="text-3xs text-zinc-600 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
