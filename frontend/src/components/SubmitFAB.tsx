'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons/Icon';

const HIDE_PATHS = ['/new', '/submit', '/submit-article', '/admin'];

export function SubmitFAB() {
  const pathname = usePathname();
  if (HIDE_PATHS.some(p => pathname.startsWith(p))) return null;

  return (
    <Link
      href="/new"
      className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-95"
      aria-label="Create new post"
    >
      <Icon name="Plus" size={24} />
    </Link>
  );
}
