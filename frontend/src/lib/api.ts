/**
 * API Base URL utility
 * Uses INTERNAL_API_URL on server-side (for SSR/SSG)
 * Uses NEXT_PUBLIC_API_URL on client-side (for browser fetches)
 */

// Export for direct use in components
export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: use internal URL for Docker network
    return process.env.INTERNAL_API_URL || 'http://localhost:8000/api';
  }
  // Client-side: use public URL for external access
  return process.env.NEXT_PUBLIC_API_URL || 'https://yotop10.fun/api';
}

/**
 * Fetch wrapper with dynamic base URL
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[apiFetch] Error response:', errorText);
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// API Response Types
export interface CategoriesResponse {
  categories: Category[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  is_featured: boolean;
  children: ChildCategory[];
}

export interface ChildCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
}

export interface SingleCategoryResponse {
  category: Category;
}

export interface PostsResponse {
  posts: Post[];
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export interface Post {
  id: string;
  title: string;
  post_type: string;
  intro: string;
  fire_count: number;
  comment_count: number;
  view_count: number;
  author_username: string;
  author_display_name: string;
  category?: Category;
  created_at: string;
}

export interface PostDetailResponse {
  post: Post;
  items: ListItem[];
}

export interface ListItem {
  id: string;
  rank: number;
  title: string;
  justification: string;
  image_url?: string;
  source_url?: string;
  fire_count: number;
}

export interface PostHistoryResponse {
  versions: PostVersion[];
}

export interface PostVersion {
  version_number: number;
  title: string;
  intro: string;
  items: Array<{ rank: number; title: string; justification: string }>;
  created_at: string;
  author_username: string;
  change_summary?: string;
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface Comment {
  id: string;
  content: string;
  depth: number;
  fire_count: number;
  reply_count: number;
  author_username: string;
  author_display_name: string;
  created_at: string;
  updated_at?: string;
  list_item_id?: string;
  parent_comment_id?: string;
  replies?: Comment[];
}

/**
 * API endpoints with typed responses
 */
export const API = {
  // Categories
  getCategories: (): Promise<CategoriesResponse> => apiFetch('/categories'),
  getCategory: (slug: string): Promise<SingleCategoryResponse> => apiFetch(`/categories/${slug}`),

  // Posts
  getPosts: (params?: { category?: string; page?: number; limit?: number }): Promise<PostsResponse> => {
    const query = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiFetch(`/posts${query}`);
  },
  getPost: (id: string): Promise<PostDetailResponse> => apiFetch(`/posts/${id}`),
  getPostHistory: (id: string): Promise<PostHistoryResponse> => apiFetch(`/posts/${id}/history`),

  // Reactions
  getReactionState: (targets: Array<{ type: string; id: string }>) => {
    const baseUrl = typeof window === 'undefined' 
      ? process.env.INTERNAL_API_URL 
      : process.env.NEXT_PUBLIC_API_URL;
    return fetch(`${baseUrl}/reactions/state?targets=${encodeURIComponent(JSON.stringify(targets))}`, {
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json());
  },
  toggleReaction: (targetType: string, targetId: string, deviceFingerprint: string) => apiFetch('/reactions', {
    method: 'POST',
    body: JSON.stringify({ target_type: targetType, target_id: targetId, device_fingerprint: deviceFingerprint }),
  }),

  // Comments
  getComments: (postId: string): Promise<CommentsResponse> => apiFetch(`/posts/${postId}/comments`),
  addComment: (postId: string, content: string, parentCommentId?: string, listItemId?: string) => apiFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parent_comment_id: parentCommentId, list_item_id: listItemId }),
  }),
};