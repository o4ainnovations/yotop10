'use client';

import { usePathname } from 'next/navigation';
import { SlideMenuPanel } from './SlideMenuPanel';
import { AdminSlideMenu } from './AdminSlideMenu';

export function SlideMenuRouter() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) return <AdminSlideMenu />;
  return <SlideMenuPanel />;
}
