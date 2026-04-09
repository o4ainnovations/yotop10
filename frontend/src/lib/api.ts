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

  // Get fingerprint if available (client-side only)
  let deviceFingerprint: string | null = null;
  if (typeof window !== 'undefined') {
    deviceFingerprint = localStorage.getItem('yotop10_fp');
  }

  const headers: any = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add fingerprint header to all requests if available
  if (deviceFingerprint) {
    headers['X-Device-Fingerprint'] = deviceFingerprint;
  }

  const response = await fetch(url, {
    ...options,
    headers,
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
  slug: string;
  title: string;
  post_type: string;
  intro: string;
  fire_count: number;
  comment_count: number;
  view_count: number;
  author_username: string;
  author_display_name: string;
  category: Category;
  created_at: string;
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
  total: number;
}

export interface Comment {
  id: string;
  content: string;
  depth: number;
  fire_count: number;
  reply_count: number;
  spark_score: number;
  author_username: string;
  author_display_name: string;
  created_at: string;
  updated_at?: string;
  list_item_id?: string;
  parent_comment_id?: string;
  replies?: Comment[];
}

// API Endpoints
export const API = {
  getCategories: (): Promise<CategoriesResponse> => apiFetch('/categories'),
  getCategory: (slug: string): Promise<SingleCategoryResponse> => apiFetch(`/categories/${slug}`),
  getPosts: (page?: number | { category?: string; page?: number; limit?: number }): Promise<PostsResponse> => {
    if (typeof page === 'object') {
      const { category, page: p = 1, limit = 20 } = page;
      return apiFetch(`/posts?page=${p}&limit=${limit}${category ? `&category=${category}` : ''}`);
    }
    return apiFetch(`/posts?page=${page || 1}`);
  },
  getPost: (idOrSlug: string): Promise<{ post: Post; items: Array<{ id: string; rank: number; title: string; justification: string; image_url?: string; source_url?: string; fire_count: number }> }> => 
    apiFetch(`/posts/${idOrSlug}`),
  getPostHistory: (idOrSlug: string): Promise<PostHistoryResponse> => 
    apiFetch(`/posts/${idOrSlug}/history`),
  getComments: (postId: string): Promise<CommentsResponse> => 
    apiFetch(`/posts/${postId}/comments`),
  addComment: (postId: string, content: string, parent_comment_id?: string, list_item_id?: string) => 
    apiFetch(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parent_comment_id, list_item_id }),
    }),
  toggleReaction: (target_type: 'post' | 'list_item' | 'comment', target_id: string, device_fingerprint: string) => 
    apiFetch('/reactions', {
      method: 'POST',
      body: JSON.stringify({ target_type, target_id, device_fingerprint }),
    }),
  
  // User endpoints
  getCurrentUser: () => apiFetch('/users/me'),
  updateDisplayName: (display_name: string) => 
    apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name }),
    }),
  getUserProfile: (username: string) => apiFetch(`/users/${username}`),
};
