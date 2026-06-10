import { create } from 'zustand';
import { apiFetch } from '@/lib/api/client';

interface RateLimitStatus {
  trust_score: number;
  current_tier: 'ghost' | 'newbie' | 'troll' | 'neutral' | 'scholar';
  limits: {
    posts: { total: number; remaining: number; reset_in_seconds: number };
    comments: { total: number; remaining: number; reset_in_seconds: number };
    counter_lists: { total: string; remaining: string; reset_in_seconds: null };
  };
}

interface RateLimitState {
  status: RateLimitStatus | null;
  countdown: number | null;
  loading: boolean;
  errorCount: number;
  fetchStatus: () => Promise<void>;
  tickCountdown: () => void;
  setCountdown: (value: number | null) => void;
}

export const useRateLimitStore = create<RateLimitState>((set, get) => ({
  status: null,
  countdown: null,
  loading: false,
  errorCount: 0,

  fetchStatus: async () => {
    try {
      const data = await apiFetch<RateLimitStatus>('/users/me/rate-limits');
      set({
        status: data,
        countdown: data.limits.posts.reset_in_seconds,
        errorCount: 0,
      });
    } catch {
      set((state) => ({ errorCount: state.errorCount + 1 }));
    }
  },

  tickCountdown: () => {
    const { countdown, fetchStatus } = get();
    if (countdown === null || countdown <= 0) return;
    const next = countdown - 1;
    set({ countdown: next });
    if (next <= 0) fetchStatus();
  },

  setCountdown: (value: number | null) => set({ countdown: value }),
}));
