import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryAudit extends Document {
  category_id: mongoose.Types.ObjectId;
  action: string;
  changes: Record<string, unknown>;
  admin_username: string;
  created_at: Date;
}

const categoryAuditSchema = new Schema<ICategoryAudit>(
  {
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    action: { type: String, required: true },
    changes: { type: Schema.Types.Mixed, default: {} },
    admin_username: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

categoryAuditSchema.index({ category_id: 1, created_at: -1 });
categoryAuditSchema.index({ created_at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const CategoryAudit = mongoose.model<ICategoryAudit>('CategoryAudit', categoryAuditSchema);
