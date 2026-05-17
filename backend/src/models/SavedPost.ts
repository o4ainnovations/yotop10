import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface ISavedPost extends Document {
  user_id: string;
  post_id: Schema.Types.ObjectId;
  saved_at: Date;
}

const savedPostSchema = new Schema<ISavedPost>(
  {
    user_id: { type: String, required: true, index: true },
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    saved_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

savedPostSchema.index({ user_id: 1, saved_at: -1 });
savedPostSchema.index({ post_id: 1, user_id: 1 }, { unique: true });

export const SavedPost = registerModel<ISavedPost>('SavedPost', savedPostSchema);
