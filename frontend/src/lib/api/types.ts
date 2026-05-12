export interface CategoriesResponse { categories: Category[]; }

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

export interface SingleCategoryResponse { category: Category; }

export interface PostsResponse {
  posts: Post[];
  pagination?: { page: number; totalPages: number; total: number };
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  post_type: string;
  intro: string;
  comment_count: number;
  view_count: number;
  author_username: string;
  author_display_name: string;
  category_slug: string;
  format: 'list_only' | 'hero_list' | 'full_list';
  hero_image_url?: string | null;
  created_at: string;
}

export interface PostHistoryResponse { versions: PostVersion[]; }

export interface PostVersion {
  version_number: number;
  title: string;
  intro: string;
  items: Array<{ rank: number; title: string; justification: string }>;
  created_at: string;
  author_username: string;
  change_summary?: string;
}

export interface CommentsResponse { comments: CommentEntry[]; total: number; }

export interface CommentEntry {
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
  replies?: CommentEntry[];
}

export interface PostSubmission {
  title: string;
  post_type: string;
  intro: string;
  category_slug: string;
  items: Array<{
    rank: number;
    title: string;
    justification: string;
    image_url?: string;
    source_url?: string;
  }>;
  author_display_name?: string;
  format?: 'list_only' | 'hero_list' | 'full_list';
  hero_image_url?: string;
}

export interface TitleCheckResponse {
  allowed: boolean;
  blocked: boolean;
  warning: boolean;
  matches: Array<{ title: string; slug: string; category_slug: string; similarity: number }>;
  pending_conflicts: Array<{ title: string; submitted_at: string }>;
  suggestion?: string;
  etag: string;
  format_check?: { valid: boolean; code?: string; error?: string; number?: number };
}

export interface PostSubmissionResponse {
  message: string;
  post: { id: string; title: string; status: string; created_at: string };
  items: Array<{ id: string; rank: number; title: string }>;
  rate_limit: { remaining: number; resetTime: number };
}
