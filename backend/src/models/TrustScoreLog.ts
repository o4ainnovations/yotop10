import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface ITrustScoreLog extends Document {
  user_id: string;
  post_id: string;
  action: 'approve' | 'reject';
  delta: number;
  old_score: number;
  new_score: number;
  version: number;
  multiplier: number;
  base_delta: number;
  created_at: Date;
}

const trustScoreLogSchema = new Schema<ITrustScoreLog>(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    post_id: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['approve', 'reject'],
    },
    delta: {
      type: Number,
      required: true,
    },
    old_score: {
      type: Number,
      required: true,
    },
    new_score: {
      type: Number,
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    multiplier: {
      type: Number,
      required: true,
    },
    base_delta: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Unique index to guarantee idempotency
trustScoreLogSchema.index({ user_id: 1, post_id: 1 }, { unique: true });
trustScoreLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const TrustScoreLog = registerModel<ITrustScoreLog>('TrustScoreLog', trustScoreLogSchema);
