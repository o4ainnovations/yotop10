import mongoose, { Schema, Document } from 'mongoose';

export interface IPageVisit extends Document {
  fingerprint: string | null;
  path: string;
  referer: string | null;
  user_agent: string;
  ip: string;
  created_at: Date;
}

const pageVisitSchema = new Schema<IPageVisit>(
  {
    fingerprint: { type: String, default: null },
    path: { type: String, required: true, index: true },
    referer: { type: String, default: null },
    user_agent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

pageVisitSchema.index({ fingerprint: 1, created_at: -1 });
pageVisitSchema.index({ created_at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const PageVisit = mongoose.model<IPageVisit>('PageVisit', pageVisitSchema);
