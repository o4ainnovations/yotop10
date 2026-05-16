import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IArticle extends Document {
  author_id: string;
  author_username: string;
  author_display_name: string;
  title: string;
  slug: string;
  body: string;
  reading_time: number;
  cover_image?: string;
  sources: Array<{ url: string; title: string; accessed_at: Date }>;
  fact_check_status: 'unverified' | 'verified' | 'disputed';
  related_posts: Schema.Types.ObjectId[];
  status: 'pending_review' | 'approved' | 'rejected';
  view_count: number;
  comment_count: number;
  bookmark_count: number;
  category_slug: string;
  created_at: Date;
  updated_at: Date;
}

const articleSchema = new Schema<IArticle>(
  {
    author_id: { type: String, required: true, index: true },
    author_username: { type: String, required: true, index: true },
    author_display_name: { type: String, required: true },
    title: { type: String, required: true, index: true },
    slug: { type: String, unique: true, index: true },
    body: { type: String, required: true },
    reading_time: { type: Number, default: 1 },
    cover_image: { type: String },
    sources: [{
      url: { type: String, required: true },
      title: { type: String, required: true },
      accessed_at: { type: Date, default: Date.now },
    }],
    fact_check_status: { type: String, enum: ['unverified', 'verified', 'disputed'], default: 'unverified' },
    related_posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    status: { type: String, enum: ['pending_review', 'approved', 'rejected'], default: 'pending_review', index: true },
    view_count: { type: Number, default: 0 },
    comment_count: { type: Number, default: 0 },
    bookmark_count: { type: Number, default: 0 },
    category_slug: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

articleSchema.index({ status: 1, created_at: -1 });
articleSchema.index({ author_id: 1, created_at: -1 });

export const Article = registerModel<IArticle>('Article', articleSchema);
