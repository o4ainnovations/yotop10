import { create } from 'zustand';
import { API } from '@/lib/api';

interface AuthUser {
  user_id: string;
  username: string;
  custom_display_name?: string | null;
  profile_image_url?: string | null;
  trust_score: number;
  trust_level: 'troll' | 'neutral' | 'scholar';
  post_count: number;
  comment_count: number;
  posts_approved: number;
  posts_rejected: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  fetchUser: async () => {
    try {
      const data = await API.getCurrentUser() as AuthUser;
      set({ user: data, loading: false, initialized: true });
    } catch {
      set({ user: null, loading: false, initialized: true });
    }
  },
}));
