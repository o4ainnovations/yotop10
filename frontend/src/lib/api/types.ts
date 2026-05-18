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
  status?: string;
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
  status: string;
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

export interface BookmarkResponse {
  success: boolean;
  bookmarked: boolean;
}

export interface SavedPost extends Post {
  saved_at: string;
}

export interface SavedPostsResponse {
  posts: SavedPost[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ArgumentPost {
  id: string;
  slug: string;
  title: string;
  post_type: string;
  category_slug: string;
  author_username: string;
  author_display_name: string;
  comment_count: number;
  view_count: number;
  argument_score: number;
  velocity: number;
  last_active: string;
  top_comments: Array<{
    rank: number;
    item_title: string;
    content: string;
    author_username: string;
    fire_count: number;
  }>;
  support_pct: number;
  contradict_pct: number;
}

export interface ArgumentsResponse {
  arguments: ArgumentPost[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserSummary {
  _id: string;
  id: string;
  username: string;
  display_name: string;
  trust_score: number;
  trust_tier: 'scholar' | 'neutral' | 'troll';
  trust_locked: boolean;
  post_count: number;
  comment_count: number;
  effective_rate_limit_posts: number;
  effective_rate_limit_comments: number;
  restricted: boolean;
  restricted_until: string | null;
  profile_image_url: string | null;
  created_at: string;
}

export interface UserDetail extends UserSummary {
  bio?: string;
  email?: string;
  trust_score_breakdown?: Record<string, number>;
  rate_limit_overrides?: {
    posts_per_hour: number | null;
    comments_per_hour: number | null;
  };
  restriction_history?: Array<{ action: string; date: string; reason: string }>;
}

export interface TrustHistoryEntry {
  _id: string;
  user_id: string;
  old_score: number;
  new_score: number;
  change: number;
  reason: string;
  admin_username: string | null;
  created_at: string;
}

export interface UserListResponse {
  users: UserSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

export interface SystemConfig {
  rate_limits: {
    base_posts_per_hour: number;
    base_comments_per_hour: number;
    troll_multiplier: number;
    neutral_multiplier: number;
    scholar_multiplier: number;
    counter_lists_toggle: boolean;
    comment_edit_window_minutes: number;
  };
  trust_tiers: {
    scholar_threshold: number;
    troll_threshold: number;
    hysteresis: number;
    review_window_hours: number;
    double_blind: boolean;
  };
}

export interface ConfigImpact {
  users_affected: number;
  tier_changes: {
    to_scholar: number;
    to_neutral: number;
    to_troll: number;
  };
  rate_changes: {
    increased: number;
    decreased: number;
    unchanged: number;
  };
}

export interface HallOfFameEntry {
  id: string;
  post_id: string;
  post: Post;
  editorial_note: string | null;
  featured_at: string;
  sort_order: number;
  created_by: string;
  status_warning?: string | null;
}

export interface HallOfFameCandidate {
  id: string;
  slug: string;
  title: string;
  post_type: string;
  category_slug: string;
  author_username: string;
  author_display_name: string;
  comment_count: number;
  view_count: number;
  hero_image_url?: string | null;
  format?: string;
  comment_count_last_90_days?: number;
  view_count_last_90_days?: number;
  created_at: string;
}

export interface ModUser {
  id: string;
  username: string;
  role: string;
  active: boolean;
  permissions: string[];
  presets: string[];
  created_at: string;
  updated_at: string;
}

export interface PermissionCatalog {
  permissions: Record<string, string[]>;
}

export interface ModPreset {
  id: string;
  name: string;
  permissions: string[];
}
