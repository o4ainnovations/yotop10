import { postsApi } from './api/endpoints/posts';
import { categoriesApi } from './api/endpoints/categories';
import { reactionsApi } from './api/endpoints/reactions';
import { usersApi } from './api/endpoints/users';
import { identityApi } from './api/endpoints/identity';
import { adminApi } from './api/endpoints/admin';
import { articlesApi } from './api/endpoints/articles';
import { exploreApi } from './api/endpoints/explore';

export { apiFetch, getBaseUrl } from './api/client';
export * from './api/types';

export const API = {
  ...categoriesApi,
  ...postsApi,
  toggleReaction: reactionsApi.toggleReaction,
  getReactionState: reactionsApi.getReactionState,
  ...usersApi,
  ...identityApi,
  ...articlesApi,
  ...exploreApi,
  adminLogin: adminApi.login,
  adminLogout: adminApi.logout,
  adminGetMe: adminApi.getMe,
  adminSetup: adminApi.setup,
  adminValidateSetupToken: adminApi.validateSetupToken,
  adminGetAlertThresholds: adminApi.getAlertThresholds,
  adminCreateAlertThreshold: adminApi.createAlertThreshold,
  adminUpdateAlertThreshold: adminApi.updateAlertThreshold,
  adminDeleteAlertThreshold: adminApi.deleteAlertThreshold,
  adminToggleAlertThreshold: adminApi.toggleAlertThreshold,
  adminGetAlertNotifications: adminApi.getAlertNotifications,
  adminGetAlertNotificationCount: adminApi.getAlertNotificationCount,
  adminMarkAlertNotificationRead: adminApi.markAlertNotificationRead,
  adminMarkAllAlertNotificationsRead: adminApi.markAllAlertNotificationsRead,
  adminDismissAlertNotification: adminApi.dismissAlertNotification,
  adminGetAlertHistory: adminApi.getAlertHistory,
};
