'use client';

import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import AdminAlertBell from './AdminAlertBell';

export default function HeaderBells() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="flex items-center gap-2">
      {!isAdmin && <NotificationBell />}
      {isAdmin && <AdminAlertBell />}
    </div>
  );
}
