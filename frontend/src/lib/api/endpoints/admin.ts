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

  // Users
  getUsers: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users${qs ? '?' + qs : ''}`);
  },
  getUser: (userId: string) => apiFetch(`/admin/users/${userId}`),
  restrictUser: (userId: string, body: Record<string, unknown>) =>
    apiFetch(`/admin/users/${userId}/restrict`, { method: 'PATCH', body: JSON.stringify(body) }),
  overrideRateLimits: (userId: string, body: Record<string, unknown>) =>
    apiFetch(`/admin/users/${userId}/rate-limits`, { method: 'PATCH', body: JSON.stringify(body) }),
  adjustTrust: (userId: string, body: Record<string, unknown>) =>
    apiFetch(`/admin/users/${userId}/trust`, { method: 'PATCH', body: JSON.stringify(body) }),
  getTrustHistory: (userId: string) =>
    apiFetch(`/admin/users/${userId}/trust-history`),

  // Config
  getConfig: () => apiFetch('/admin/config'),
  updateConfig: (body: Record<string, unknown>) =>
    apiFetch('/admin/config', { method: 'PUT', body: JSON.stringify(body) }),
  getConfigImpact: (body: Record<string, unknown>) =>
    apiFetch('/admin/config/impact', { method: 'POST', body: JSON.stringify(body) }),

  // Hall of Fame
  getHallOfFame: () => apiFetch('/admin/hall-of-fame'),
  addToHallOfFame: (postId: string, editorialNote?: string) =>
    apiFetch('/admin/hall-of-fame', { method: 'POST', body: JSON.stringify({ post_id: postId, editorial_note: editorialNote || null }) }),
  removeFromHallOfFame: (id: string) =>
    apiFetch(`/admin/hall-of-fame/${id}`, { method: 'DELETE' }),
  reorderHallOfFame: (order: { id: string; sort_order: number }[]) =>
    apiFetch('/admin/hall-of-fame/reorder', { method: 'PATCH', body: JSON.stringify({ order }) }),
  updateEditorialNote: (id: string, editorialNote: string) =>
    apiFetch(`/admin/hall-of-fame/${id}/editorial-note`, { method: 'PATCH', body: JSON.stringify({ editorial_note: editorialNote }) }),
  getHallOfFameCandidates: () => apiFetch('/admin/hall-of-fame/candidates'),

  // Mods
  getMods: () => apiFetch('/admin/mods'),
  getMod: (id: string) => apiFetch(`/admin/mods/${id}`),
  createMod: (body: Record<string, unknown>) =>
    apiFetch('/admin/mods', { method: 'POST', body: JSON.stringify(body) }),
  updateMod: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/admin/mods/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMod: (id: string) =>
    apiFetch(`/admin/mods/${id}`, { method: 'DELETE' }),
  resetModPassword: (id: string) =>
    apiFetch(`/admin/mods/${id}/reset-password`, { method: 'POST' }),
  getPermissionCatalog: () => apiFetch('/admin/mods/permissions'),
  getPresets: () => apiFetch('/admin/mods/presets'),
};
