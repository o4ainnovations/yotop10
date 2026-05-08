'use client';

import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import AdminAlertBell from './AdminAlertBell';

export default function HeaderBells() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {!isAdmin && <NotificationBell />}
      {isAdmin && <AdminAlertBell />}
    </div>
  );
}
