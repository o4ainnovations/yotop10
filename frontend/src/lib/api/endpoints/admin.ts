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

  // Alert system
  getAlertThresholds: () => apiFetch('/admin/alerts/thresholds'),
  createAlertThreshold: (body: Record<string, unknown>) =>
    apiFetch('/admin/alerts/thresholds', { method: 'POST', body: JSON.stringify(body) }),
  updateAlertThreshold: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/admin/alerts/thresholds/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAlertThreshold: (id: string) =>
    apiFetch(`/admin/alerts/thresholds/${id}`, { method: 'DELETE' }),
  toggleAlertThreshold: (id: string) =>
    apiFetch(`/admin/alerts/thresholds/${id}/toggle`, { method: 'PATCH' }),

  getAlertNotifications: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/alerts/notifications${qs ? '?' + qs : ''}`);
  },
  getAlertNotificationCount: () => apiFetch('/admin/alerts/notifications/count'),
  markAlertNotificationRead: (id: string) =>
    apiFetch(`/admin/alerts/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAlertNotificationsRead: () =>
    apiFetch('/admin/alerts/notifications/read-all', { method: 'PATCH' }),
  dismissAlertNotification: (id: string) =>
    apiFetch(`/admin/alerts/notifications/${id}`, { method: 'DELETE' }),

  getAlertHistory: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/alerts/history${qs ? '?' + qs : ''}`);
  },

  // Outbound messaging
  sendMessage: (body: Record<string, unknown>) =>
    apiFetch('/admin/messages', { method: 'POST', body: JSON.stringify(body) }),
  getMessages: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/messages${qs ? '?' + qs : ''}`);
  },
  retractMessage: (id: string) =>
    apiFetch(`/admin/messages/${id}`, { method: 'DELETE' }),
  getMessageStats: (id: string) =>
    apiFetch(`/admin/messages/${id}/stats`),
  createMessageTemplate: (body: Record<string, unknown>) =>
    apiFetch('/admin/messages/templates', { method: 'POST', body: JSON.stringify(body) }),
  getMessageTemplates: () => apiFetch('/admin/messages/templates'),
  deleteMessageTemplate: (id: string) =>
    apiFetch(`/admin/messages/templates/${id}`, { method: 'DELETE' }),
};
