import { apiFetch } from '../client';
import type { BookmarkResponse, SavedPostsResponse } from '../types';

export const bookmarksApi = {
  save: (postId: string) =>
    apiFetch<BookmarkResponse>('/bookmarks/save', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId }),
    }),

  unsave: (postId: string) =>
    apiFetch<BookmarkResponse>('/bookmarks/save', {
      method: 'DELETE',
      body: JSON.stringify({ post_id: postId }),
    }),

  getSaved: (page = 1, limit = 20) =>
    apiFetch<SavedPostsResponse>(`/bookmarks/saved?page=${page}&limit=${limit}`),

  checkBookmark: (postId: string) =>
    apiFetch<{ bookmarked: boolean }>(`/bookmarks/check?post_id=${encodeURIComponent(postId)}`),
};
