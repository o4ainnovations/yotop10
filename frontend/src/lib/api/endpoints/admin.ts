import { apiFetch } from '../client';

export const adminApi = {
  login: (username: string, password: string) =>
    apiFetch('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () => apiFetch('/admin/logout', { method: 'POST' }),

  getMe: () => apiFetch('/admin/me'),

  setup: (token: string, username: string, password: string) =>
    apiFetch('/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ token, username, password }),
    }),

  validateSetupToken: (token: string) =>
    apiFetch(`/admin/setup/validate?token=${token}`),
};
