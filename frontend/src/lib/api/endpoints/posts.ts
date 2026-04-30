import { apiFetch } from '../client';
import type {
  PostsResponse, PostHistoryResponse, CommentsResponse, Post,
  PostSubmission, TitleCheckResponse, PostSubmissionResponse,
} from '../types';

export const postsApi = {
  getPosts: (page?: number | { category?: string; page?: number; limit?: number }): Promise<PostsResponse> => {
    if (typeof page === 'object') {
      const { category, page: p = 1, limit = 20 } = page;
      return apiFetch(`/posts?page=${p}&limit=${limit}${category ? `&category=${category}` : ''}`);
    }
    return apiFetch(`/posts?page=${page || 1}`);
  },

  getPost: (slug: string) =>
    apiFetch<{ post: Post; items: Array<{ id: string; rank: number; title: string; justification: string; image_url?: string; source_url?: string }> }>(`/posts/${slug}`),

  getPostHistory: (slug: string): Promise<PostHistoryResponse> =>
    apiFetch(`/posts/${slug}/history`),

  getComments: (postId: string): Promise<CommentsResponse> =>
    apiFetch(`/posts/${postId}/comments`),

  addComment: (postId: string, content: string, parent_comment_id?: string, list_item_id?: string) =>
    apiFetch(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parent_comment_id, list_item_id }),
    }),

  addPost: (data: PostSubmission): Promise<PostSubmissionResponse> =>
    apiFetch('/posts', { method: 'POST', body: JSON.stringify(data) }),

  checkTitle: (query: string, categoryId: string): Promise<TitleCheckResponse> =>
    apiFetch(`/posts/check-title?q=${encodeURIComponent(query)}&categoryId=${encodeURIComponent(categoryId)}`),
};
