import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface ISystemConfig extends Document {
  key: string;
  rate_limits: {
    base_posts_per_hour: number;
    base_comments_per_hour: number;
    tiers: {
      troll: { multiplier: number; min_posts: number };
      neutral: { multiplier: number; min_posts: number };
      scholar: { multiplier: number; min_posts: number };
    };
    counter_lists_unlimited: boolean;
    comment_edit_window_minutes: number;
  };
  trust_tiers: {
    troll_max: number;
    neutral_min: number;
    scholar_min: number;
    hysteresis_enter: number;
    hysteresis_lose: number;
    review_window: number;
    double_blind: boolean;
  };
  ai_moderation?: {
    enabled: boolean;
    api_key_encrypted: string;
    model: string;
    temperature: number;
    auto_approve_threshold: number;
    auto_approve_mode: 'approve_only' | 'approve_reject' | 'approve_revision';
  };
  version: number;
  updated_at: Date;
  updated_by: string;
}

const systemConfigSchema = new Schema<ISystemConfig>({
  key: { type: String, default: 'global', unique: true },
  rate_limits: {
    base_posts_per_hour: { type: Number, default: 4 },
    base_comments_per_hour: { type: Number, default: 20 },
    tiers: {
      troll: {
        multiplier: { type: Number, default: 0.5 },
        min_posts: { type: Number, default: 2 },
      },
      neutral: {
        multiplier: { type: Number, default: 1.0 },
        min_posts: { type: Number, default: 4 },
      },
      scholar: {
        multiplier: { type: Number, default: 2.0 },
        min_posts: { type: Number, default: 8 },
      },
    },
    counter_lists_unlimited: { type: Boolean, default: true },
    comment_edit_window_minutes: { type: Number, default: 120 },
  },
  trust_tiers: {
    troll_max: { type: Number, default: 0.49 },
    neutral_min: { type: Number, default: 0.5 },
    scholar_min: { type: Number, default: 1.8 },
    hysteresis_enter: { type: Number, default: 1.85 },
    hysteresis_lose: { type: Number, default: 1.70 },
    review_window: { type: Number, default: 50 },
    double_blind: { type: Boolean, default: true },
  },
  ai_moderation: { type: Schema.Types.Mixed },
  version: { type: Number, default: 1 },
  updated_at: { type: Date, default: Date.now },
  updated_by: { type: String, default: 'system' },
}, { timestamps: false });

export const SystemConfig = registerModel<ISystemConfig>('SystemConfig', systemConfigSchema);
