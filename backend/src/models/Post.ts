import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  author_id: string;
  author_username: string;
  author_display_name: string;
  title: string;
  post_type: string;
  intro: string;
  status: 'pending_review' | 'approved' | 'rejected';
  category_id: mongoose.Types.ObjectId;
  fire_count: number;
  comment_count: number;
  view_count: number;
  is_public: boolean;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
}

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
    fire_count: {
      type: Number,
      default: 0,
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

// Indexes for efficient queries
postSchema.index({ status: 1, created_at: -1 });
postSchema.index({ category_id: 1, status: 1 });
postSchema.index({ author_id: 1, status: 1 });
postSchema.index({ post_type: 1, status: 1 });
postSchema.index({ title: 'text', intro: 'text' });

export const Post = mongoose.model<IPost>('Post', postSchema);
