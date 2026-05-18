import { Schema, Document, ObjectId } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IHallOfFame extends Document {
  post_id: ObjectId;
  editorial_note: string | null;
  featured_at: Date;
  sort_order: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const hallOfFameSchema = new Schema<IHallOfFame>(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true, unique: true, index: true },
    editorial_note: { type: String, default: null },
    featured_at: { type: Date, default: Date.now },
    sort_order: { type: Number, default: 0 },
    created_by: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

hallOfFameSchema.index({ sort_order: 1, featured_at: -1 });

export const HallOfFame = registerModel<IHallOfFame>('HallOfFame', hallOfFameSchema);
