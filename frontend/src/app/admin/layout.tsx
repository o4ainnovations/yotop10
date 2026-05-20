import { cookies } from 'next/headers';
import { AdminAuthHydrator } from '@/components/AdminAuthHydrator';
import AdminClientShell from './AdminClientShell';

interface AdminData {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  let admin = null;
  if (token) {
    try {
      const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${baseUrl}/admin/me`, {
        headers: { Cookie: `admin_token=${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        admin = {
          id: data.id,
          username: data.username,
          role: data.role,
          permissions: data.permissions,
        };
      }
    } catch {
      // auth failed — render login
    }
  }

  return (
    <>
      <AdminAuthHydrator admin={admin as AdminData | null} />
      <AdminClientShell admin={admin as AdminData | null}>{children}</AdminClientShell>
    </>
  );
}
