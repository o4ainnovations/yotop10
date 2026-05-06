import mongoose, { Schema, Document } from 'mongoose';

export interface IUserEvent extends Document {
  user_id: string;
  fingerprint: string;
  event: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

const userEventSchema = new Schema<IUserEvent>(
  {
    user_id: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true },
    event: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

userEventSchema.index({ user_id: 1, created_at: -1 });
userEventSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const UserEvent = mongoose.model<IUserEvent>('UserEvent', userEventSchema);
