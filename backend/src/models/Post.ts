import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';
// import { updateUserTrustScore } from '../lib/trustScore';

export interface IPost extends Document {
  author_id: string;
  author_username: string;
  author_display_name: string;
  title: string;
  normalized_title: string;
  slug: string;
  post_type: string;
  intro: string;
  status: 'pending_review' | 'approved' | 'rejected';
  rejection_reason?: string;
  revision_guidance?: string;
  revision_requested_at?: Date;
  revision_count: number;
  category_id: string;
  category_slug: string;
  published_at?: Date;
  view_count: number;
  comment_count: number;
  trust_score_updated: boolean;
  is_public: boolean;
  status_history: Array<{ status: string; changed_at: Date }>;
  version: number;
  deleted: boolean;
  deleted_at: Date | null;
  auto_hard_delete_at: Date | null;
  featured: boolean;
  featured_at: Date | null;
  editorial_note: string | null;
  bookmark_count: number;
  share_count: number;
  comments_locked: boolean;
  bumped_at: Date | null;
  format: 'list_only' | 'hero_list' | 'full_list';
  hero_image_url: string | null;
  meta_robots: string | null;
  created_at: Date;
  updated_at: Date;
}

// Generate unique slug from title and ID
export const generateUniqueSlug = (title: string, id: string): string => {
  // Normalize title
  let slug = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Truncate to 60 characters
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-+$/, '');
  }
  
  // Append last 6 characters of ID
  const idSuffix = id.substring(id.length - 6);
  
  return `${slug}-${idSuffix}`;
};

const postSchema = new Schema<IPost>(
  {
    author_id: {
      type: String,
      required: true,
      index: true,
    },
    author_username: {
      type: String,
      required: true,
      index: true,
    },
    author_display_name: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    normalized_title: {
      type: String,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      required: false,
      default: null,
    },
  post_type: {
    type: String,
    required: true,
    enum: ['top_list', 'this_vs_that', 'who_is_better', 'fact_drop', 'best_of', 'worst_of', 'hidden_gems', 'counter_list'],
    index: true,
  },
    intro: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending_review', 'approved', 'rejected'],
      default: 'pending_review',
      index: true,
    },
    rejection_reason: {
      type: String,
      required: false,
    },
    revision_guidance: {
      type: String,
      required: false,
    },
    revision_requested_at: {
      type: Date,
      required: false,
    },
    revision_count: {
      type: Number,
      default: 0,
    },
    trust_score_updated: {
      type: Boolean,
      default: false,
    },
    category_id: {
      type: String,
      required: false,
      index: true,
    },
    category_slug: {
      type: String,
      required: true,
      index: true,
      default: '__orphan__',
    },
    comment_count: {
      type: Number,
      default: 0,
    },
    view_count: {
      type: Number,
      default: 0,
    },
    is_public: {
      type: Boolean,
      default: true,
      index: true,
    },
    status_history: {
      type: [{ status: String, changed_at: Date }],
      default: [],
    },
    version: { type: Number, default: 0 },
    deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
    auto_hard_delete_at: { type: Date, default: null },
    featured: { type: Boolean, default: false },
    featured_at: { type: Date, default: null },
    editorial_note: { type: String, default: null },
    bookmark_count: { type: Number, default: 0 },
    share_count: { type: Number, default: 0 },
    comments_locked: { type: Boolean, default: false },
    bumped_at: { type: Date, default: null },
    format: {
      type: String,
      enum: ['list_only', 'hero_list', 'full_list'],
      default: 'list_only',
    },
    hero_image_url: { type: String, default: null },
    meta_robots: { type: String, default: null },
    published_at: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Title normalization utility
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s:']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(the|and|of|in)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Track status changes and version increments
postSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (!this.status_history) this.status_history = [];
    this.status_history.push({ status: this.status, changed_at: new Date() });
  }
  if (this.isModified() && !this.isNew) {
    const modifiedPaths = this.modifiedPaths();
    const nonStatusPaths = modifiedPaths.filter(p => p !== 'status' && p !== 'status_history' && p !== 'version');
    if (nonStatusPaths.length > 0) this.version = (this.version || 0) + 1;
  }
  next();
});

// Auto-generate slug and normalized title before saving
postSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('title')) {
    this.slug = generateUniqueSlug(this.title, (this._id as { toString(): string }).toString());
    this.normalized_title = normalizeTitle(this.title);
  }
  next();
});

// Indexes for efficient queries
// ─── Primary query indexes ─────────────────────────────────────────
postSchema.index({ status: 1, deleted: 1, created_at: -1 });        // Public feed (newest first)
postSchema.index({ status: 1, deleted: 1, comment_count: -1 });     // Public feed (most commented)
postSchema.index({ status: 1, deleted: 1, view_count: -1 });        // Public feed (most viewed)

// ─── Category feed indexes ─────────────────────────────────────────
postSchema.index({ category_slug: 1, status: 1, deleted: 1, created_at: -1 });  // Category feed
postSchema.index({ category_id: 1, status: 1, deleted: 1 });                     // Admin category filter

// ─── User & type indexes ───────────────────────────────────────────
postSchema.index({ author_id: 1, status: 1, created_at: -1 });      // User profile
postSchema.index({ post_type: 1, status: 1, deleted: 1 });          // Type filter

postSchema.index({ title: 'text', intro: 'text' });

// ─── Unique partial index for pending posts ─────────────────────────
// Exactly one pending per normalized title
postSchema.index({ normalized_title: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'pending_review' }
});

export const Post = registerModel<IPost>('Post', postSchema);
