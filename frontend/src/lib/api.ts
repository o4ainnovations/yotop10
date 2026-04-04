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
};