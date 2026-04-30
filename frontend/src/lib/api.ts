import { postsApi } from './api/endpoints/posts';
import { categoriesApi } from './api/endpoints/categories';
import { reactionsApi } from './api/endpoints/reactions';
import { usersApi } from './api/endpoints/users';
import { adminApi } from './api/endpoints/admin';

export { apiFetch, getBaseUrl } from './api/client';
export * from './api/types';

export const API = {
  ...categoriesApi,
  ...postsApi,
  toggleReaction: reactionsApi.toggleReaction,
  getReactionState: reactionsApi.getReactionState,
  ...usersApi,
  adminLogin: adminApi.login,
  adminLogout: adminApi.logout,
  adminGetMe: adminApi.getMe,
  adminSetup: adminApi.setup,
  adminValidateSetupToken: adminApi.validateSetupToken,
};
