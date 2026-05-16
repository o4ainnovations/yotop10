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
  format?: 'list_only' | 'hero_list' | 'full_list';
  hero_image_url?: string | null;
  topItems?: Array<{ rank: number; title: string }>;
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

export interface Article {
  id: string;
  slug: string;
  title: string;
  body: string;
  reading_time: number;
  cover_image?: string;
  sources: Array<{ url: string; title: string; accessed_at: string }>;
  fact_check_status: 'unverified' | 'verified' | 'disputed';
  related_posts: string[];
  author_username: string;
  author_display_name: string;
  view_count: number;
  comment_count: number;
  bookmark_count: number;
  category_slug: string;
  created_at: string;
  updated_at: string;
}

export interface ArticlesResponse {
  articles: Article[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ArticleSubmission {
  title: string;
  body: string;
  category_slug: string;
  cover_image?: string;
  sources?: Array<{ url: string; title: string }>;
}

export interface ExplorePost {
  id: string;
  slug: string;
  title: string;
  post_type: string;
  category_slug: string;
  author_username: string;
  author_display_name: string;
  comment_count: number;
  view_count: number;
  format?: string;
  hero_image_url?: string | null;
  topItems?: Array<{ rank: number; title: string }>;
  explore_score: number;
  created_at: string;
}

export interface ExploreResponse {
  posts: ExplorePost[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
