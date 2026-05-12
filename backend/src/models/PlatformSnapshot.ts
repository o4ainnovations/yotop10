import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IPlatformSnapshot extends Document {
  date: string;
  generated_at: Date;
  content: Record<string, unknown>;
  community: Record<string, unknown>;
  moderation: Record<string, unknown>;
  categories: Record<string, unknown>;
  engagement: Record<string, unknown>;
  traffic: Record<string, unknown>;
}

const platformSnapshotSchema = new Schema<IPlatformSnapshot>(
  {
    date: { type: String, required: true, unique: true, index: true },
    generated_at: { type: Date, required: true },
    content: { type: Schema.Types.Mixed, default: {} },
    community: { type: Schema.Types.Mixed, default: {} },
    moderation: { type: Schema.Types.Mixed, default: {} },
    categories: { type: Schema.Types.Mixed, default: {} },
    engagement: { type: Schema.Types.Mixed, default: {} },
    traffic: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false }
);

export const PlatformSnapshot = registerModel<IPlatformSnapshot>('PlatformSnapshot', platformSnapshotSchema);
