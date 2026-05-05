import mongoose, { Schema, Document } from 'mongoose';
import { Category } from './Category';
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
      index: true,
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

// Auto-generate slug and normalized title before saving
postSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('title')) {
    this.slug = generateUniqueSlug(this.title, (this._id as { toString(): string }).toString());
    this.normalized_title = normalizeTitle(this.title);
  }
  next();
});

// Indexes for efficient queries
postSchema.index({ status: 1, created_at: -1 });
postSchema.index({ category_id: 1, created_at: -1, status: 1 });
postSchema.index({ category_id: 1, status: 1 });
postSchema.index({ author_id: 1, status: 1 });
postSchema.index({ post_type: 1, status: 1 });
postSchema.index({ title: 'text', intro: 'text' });
postSchema.index({ slug: 1 }, { unique: true });
postSchema.index({ normalized_title: 1 });

// Unique partial index for pending posts - exactly one pending per normalized title
postSchema.index({ normalized_title: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'pending_review' }
});

export const Post = mongoose.model<IPost>('Post', postSchema);
