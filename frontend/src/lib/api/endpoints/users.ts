import { apiFetch } from '../client';

export const usersApi = {
  getCurrentUser: () => apiFetch('/users/me'),

  updateDisplayName: (display_name: string) =>
    apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name }),
    }),

  getUserProfile: (username: string) => apiFetch(`/users/${username}`),

  getUsernameHistory: () => apiFetch('/users/me/history'),
};
