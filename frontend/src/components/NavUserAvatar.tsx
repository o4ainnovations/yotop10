'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

export function NavUserAvatar() {
  const user = useAuthStore((s) => s.user);
  const initial = user?.custom_display_name?.[0] || user?.username?.[0] || '?';

  return (
    <Link
      href={user ? '/profile' : '/profile'}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-zinc-400 transition hover:border-orange-500/30 hover:text-orange-400"
    >
      {initial.toUpperCase()}
    </Link>
  );
}
