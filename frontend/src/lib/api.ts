import { postsApi } from './api/endpoints/posts';
import { categoriesApi } from './api/endpoints/categories';
import { reactionsApi } from './api/endpoints/reactions';
import { usersApi } from './api/endpoints/users';
import { identityApi } from './api/endpoints/identity';
import { adminApi } from './api/endpoints/admin';
import { articlesApi } from './api/endpoints/articles';
import { exploreApi } from './api/endpoints/explore';
import { bookmarksApi } from './api/endpoints/bookmarks';
import { shareApi } from './api/endpoints/share';
import { argumentsApi } from './api/endpoints/arguments';
import { searchApi } from './api/endpoints/search';

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
  ...bookmarksApi,
  ...shareApi,
  ...argumentsApi,
  ...searchApi,
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
  // Hall of Fame (admin)
  getHallOfFame: adminApi.getHallOfFame,
  addToHallOfFame: adminApi.addToHallOfFame,
  removeFromHallOfFame: adminApi.removeFromHallOfFame,
  reorderHallOfFame: adminApi.reorderHallOfFame,
  updateEditorialNote: adminApi.updateEditorialNote,
  getHallOfFameCandidates: adminApi.getHallOfFameCandidates,
  // Mods
  getMods: adminApi.getMods,
  getMod: adminApi.getMod,
  createMod: adminApi.createMod,
  updateMod: adminApi.updateMod,
  deleteMod: adminApi.deleteMod,
  resetModPassword: adminApi.resetModPassword,
  getPermissionCatalog: adminApi.getPermissionCatalog,
  getPresets: adminApi.getPresets,
};

export async function getPublicHallOfFame() {
  const { apiFetch } = await import('./api/client');
  return apiFetch('/hall-of-fame');
}
