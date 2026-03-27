import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: mongoose.Types.ObjectId;
  post_count: number;
  is_featured: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
    },
    icon: {
      type: String,
    },
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    post_count: {
      type: Number,
      default: 0,
    },
    is_featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_archived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes for efficient queries
categorySchema.index({ parent_id: 1, is_archived: 1 });
categorySchema.index({ is_featured: 1, is_archived: 1 });
categorySchema.index({ slug: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
