'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useSlideMenu } from '@/stores/slideMenu';
import { Icon } from './icons/Icon';
import { ThemeToggle } from './ThemeToggle';

export function SlideMenuPanel() {
  const open = useSlideMenu((s) => s.open);
  const setOpen = useSlideMenu((s) => s.setOpen);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const displayName = user?.custom_display_name || user?.username || 'User';
  const rawUsername = user?.username || 'unknown';
  const cleanUsername = rawUsername.replace(/^a_/, '');

  const navItems = [
    { icon: 'User' as const, label: 'Profile', href: user ? `/a/${cleanUsername}` : '/a' },
    { icon: 'Folder' as const, label: 'Categories', href: '/categories' },
    { icon: 'MessageCircle' as const, label: 'Argument', href: '/arguments', badge: 'Beta' },
    { icon: 'Search' as const, label: 'Explore', href: '/explore' },
    { icon: 'Bookmark' as const, label: 'Saved', href: '/saved' },
    { icon: 'FileText' as const, label: 'Articles', href: '/articles' },
    { icon: 'Crown' as const, label: 'Hall of Fame', href: '/hall-of-fame' },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 z-[70] h-full w-80 bg-[var(--color-bg)] border-l border-white/5 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 pt-10 pb-4">
          <div className="flex items-center gap-3">
            {user?.profile_image_url ? (
              <Image src={user.profile_image_url} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover shrink-0" unoptimized />
            ) : (
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-lg shrink-0">
                {displayName[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white truncate">{displayName}</span>
                <Icon name="BadgeCheck" size={15} className="text-orange-400 shrink-0" />
              </div>
              <p className="text-sm2 text-zinc-500 font-mono">@{cleanUsername}</p>
            </div>
          </div>
        </div>

        <hr className="border-white/5 mx-6" />

        <nav className="flex-1 px-3 pt-6 pb-2 overflow-y-auto flex flex-col justify-center gap-1"> 
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition text-base2 ${
                  isActive
                    ? 'text-white bg-white/10 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-2xs font-semibold uppercase text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="pt-8 pb-3">
            <hr className="border-white/5 mx-6" />
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-6 py-3 text-base2 text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <Icon name="Settings" size={18} />
            <span>Settings &amp; Doc</span>
          </Link>
          <div className="px-6 py-3 mb-6">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}
