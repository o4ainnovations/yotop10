import mongoose, { Schema, Document } from 'mongoose';

export interface IReaction extends Document {
  user_device_fingerprint: string;
  target_type: 'comment';
  target_id: mongoose.Types.ObjectId;
  reaction_type: 'fire';
  created_at: Date;
}

const reactionSchema = new Schema<IReaction>(
  {
    user_device_fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    target_type: {
      type: String,
      required: true,
      enum: ['comment'],
      index: true,
    },
    target_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reaction_type: {
      type: String,
      required: true,
      enum: ['fire'],
      default: 'fire',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Compound index to ensure one reaction per user per target
reactionSchema.index(
  { user_device_fingerprint: 1, target_type: 1, target_id: 1 },
  { unique: true }
);

// Index for querying reactions by target
reactionSchema.index({ target_type: 1, target_id: 1 });

export const Reaction = mongoose.model<IReaction>('Reaction', reactionSchema);
