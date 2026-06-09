import { create } from 'zustand';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}

// AdminSession is the same shape as AdminUser — reuse the interface
export type AdminSession = AdminUser;

interface AdminState {
  admin: AdminUser | null;
  loading: boolean;
  authenticated: boolean;
  initialized: boolean;
  hydrate: (session: AdminSession) => void;
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  admin: null,
  loading: true,
  authenticated: false,
  initialized: false,

  hydrate: (session: AdminSession) => {
    set({
      admin: {
        id: session.id,
        username: session.username,
        role: session.role || 'mod',
        permissions: session.permissions || [],
      },
      authenticated: true,
      loading: false,
      initialized: true,
    });
  },

  checkSession: async () => {
    try {
      const data = await API.adminGetMe() as AdminUser;
      set({
        admin: {
          id: data.id,
          username: data.username,
          role: data.role || 'mod',
          permissions: data.permissions || [],
        },
        authenticated: true,
        loading: false,
        initialized: true,
      });
    } catch {
      set({ admin: null, authenticated: false, loading: false, initialized: true });
    }
  },

  login: async (username: string, password: string) => {
    try {
      const data = await API.adminLogin(username, password) as { admin: AdminUser };
      set({
        admin: {
          id: data.admin.id,
          username: data.admin.username,
          role: data.admin.role || 'mod',
          permissions: data.admin.permissions || [],
        },
        authenticated: true,
        loading: false,
      });
      toast.success('Welcome back.');
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await API.adminLogout();
    } catch (err) {
      console.warn('[AdminStore] Logout API call failed, clearing local state:', err);
    } finally {
      set({ admin: null, authenticated: false, loading: false, initialized: true });
      document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  },
}));
