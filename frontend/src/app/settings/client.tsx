'use client';

import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

const SECTIONS = [
  {
    icon: 'User' as const,
    label: 'Account',
    description: 'Display name, logout, identity transfer',
    href: '/settings/account',
  },
];

export default function SettingsClient() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 min-h-[calc(100vh-56px)]">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-orange-400 hover:text-orange-300 transition">
          &larr; Back to Home
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      <div className="space-y-3">
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-5 py-4 transition hover:border-orange-500/20 hover:bg-white/[0.06]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
              <Icon name={s.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{s.label}</p>
              <p className="text-2xs text-zinc-500 mt-0.5">{s.description}</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-zinc-600 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
