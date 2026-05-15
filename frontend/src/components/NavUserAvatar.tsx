'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/auth';

export function NavUserAvatar() {
  const user = useAuthStore((s) => s.user);
  const initial = user?.custom_display_name?.[0] || user?.username?.[0] || '?';
  const profileSlug = user?.custom_display_name?.replace(/^a_/, '') || user?.username?.replace(/^a_/, '') || '';

  return (
    <Link
      href={user ? `/a/${profileSlug}` : '/profile'}
      className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-zinc-400 transition hover:border-orange-500/30 hover:text-orange-400"
    >
      {user?.profile_image_url ? (
        <Image
          src={user.profile_image_url}
          alt=""
          width={28}
          height={28}
          className="rounded-full object-cover"
        />
      ) : (
        initial.toUpperCase()
      )}
    </Link>
  );
}
