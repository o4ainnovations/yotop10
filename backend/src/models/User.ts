import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  user_id: string;
  username: string;
  custom_display_name?: string;
  device_fingerprint: string;
  trust_score: number;
  trust_locked: boolean;
  is_admin: boolean;
  rate_limit_override?: {
    posts_per_hour?: number | null;
    comments_per_hour?: number | null;
  };
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    custom_display_name: {
      type: String,
      sparse: true,
    },
    device_fingerprint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    is_admin: {
      type: Boolean,
      default: false,
    },
    trust_score: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 2.0,
    },
    trust_locked: {
      type: Boolean,
      default: false,
    },
    rate_limit_override: {
      posts_per_hour: { type: Number, default: null },
      comments_per_hour: { type: Number, default: null },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Index for efficient queries
userSchema.index({ device_fingerprint: 1 });
userSchema.index({ username: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
