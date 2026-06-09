import { apiFetch } from '../client';

export const usersApi = {
  getCurrentUser: () => apiFetch('/users/me'),

  updateDisplayName: (display_name: string) =>
    apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name }),
    }),

  updateProfileImage: (url: string) =>
    apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ profile_image_url: url }),
    }),

  uploadProfileImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/upload/profile', {
      method: 'POST',
      body: formData,
      headers: {},  // Let browser set multipart boundary
    });
  },

  getUserProfile: (username: string) => apiFetch(`/users/${username}`),

  getUsernameHistory: () => apiFetch('/users/me/history'),
};
