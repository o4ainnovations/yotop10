import { apiFetch } from '../client';

export interface ShareResponse {
  success: boolean;
}

export const shareApi = {
  trackShare: (slug: string) =>
    apiFetch<ShareResponse>(`/posts/${slug}/share`, {
      method: 'POST',
    }),
};
