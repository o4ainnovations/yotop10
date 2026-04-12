import mongoose, { Schema, Document } from 'mongoose';
import { Category } from './Category';
import { updateUserTrustScore } from '../lib/trustScore';

export interface IPost extends Document {
  author_id: string;
  author_username: string;
  author_display_name: string;
  title: string;
  slug: string;
  post_type: string;
  intro: string;
  status: 'pending_review' | 'approved' | 'rejected';
  category_id: mongoose.Types.ObjectId;
  comment_count: number;
  view_count: number;
  is_public: boolean;
  published_at?: Date;
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
    category_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
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

// Auto-generate slug before saving
postSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('title')) {
    this.slug = generateUniqueSlug(this.title, this._id.toString());
  }
  next();
});

// Add a validator that runs after slug generation
postSchema.pre('validate', function(next) {
  if (this.isNew) {
    // Generate slug early for validation
    this.slug = generateUniqueSlug(this.title, this._id.toString());
  }
  next();
});

// Auto-increment category post count when post is approved and created
postSchema.post('save', async function(doc, next) {
  // Increment count when post is newly approved
  if (doc.status === 'approved') {
    await Category.findByIdAndUpdate(doc.category_id, { $inc: { post_count: 1 } });
  }
  next();
});

// Auto-decrement category post count when post is removed or rejected
postSchema.post('findOneAndUpdate', async function(doc) {
  // If post was approved and now rejected/removed
  if (doc && doc.status === 'rejected') {
    await Category.findByIdAndUpdate(doc.category_id, { $inc: { post_count: -1 } });
  }
});

// Auto-decrement category post count when post is deleted
postSchema.post('findOneAndDelete', async function(doc) {
  if (doc && doc.status === 'approved') {
    await Category.findByIdAndUpdate(doc.category_id, { $inc: { post_count: -1 } });
  }
});

// Auto-update user trust score when post status changes
postSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.author_id) {
    await updateUserTrustScore(doc.author_id);
  }
});

// Indexes for efficient queries
postSchema.index({ status: 1, created_at: -1 });
postSchema.index({ category_id: 1, status: 1 });
postSchema.index({ author_id: 1, status: 1 });
postSchema.index({ post_type: 1, status: 1 });
postSchema.index({ title: 'text', intro: 'text' });
postSchema.index({ slug: 1 }, { unique: true });

export const Post = mongoose.model<IPost>('Post', postSchema);
