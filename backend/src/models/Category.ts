import mongoose, { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: mongoose.Types.ObjectId;
  post_count: number;
  is_featured: boolean;
  is_archived: boolean;
  sort_order: number;
  status: 'draft' | 'published' | 'hidden';
  publish_at: Date | null;
  archive_at: Date | null;
  featured_in: string[];
  slug_history: Array<{ old: string; new: string; changed_at: Date }>;
  template: string | null;
  created_at: Date;
  updated_at: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    icon: { type: String },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    post_count: { type: Number, default: 0 },
    is_featured: { type: Boolean, default: false, index: true },
    is_archived: { type: Boolean, default: false, index: true },
    sort_order: { type: Number, default: 0, index: true },
    status: { type: String, enum: ['draft', 'published', 'hidden'], default: 'published' },
    publish_at: { type: Date, default: null },
    archive_at: { type: Date, default: null },
    featured_in: { type: [String], default: [] },
    slug_history: { type: [{ old: String, new: String, changed_at: { type: Date, default: Date.now } }], default: [] },
    template: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

categorySchema.index({ parent_id: 1, is_archived: 1 });
categorySchema.index({ is_featured: 1, is_archived: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ publish_at: 1 });
categorySchema.index({ archive_at: 1 });

export const Category = registerModel<ICategory>('Category', categorySchema);
