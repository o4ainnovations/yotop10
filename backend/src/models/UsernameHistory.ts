import mongoose, { Schema, Document } from 'mongoose';

export interface IUsernameHistory extends Document {
  user_id: string;
  username: string;
  custom_display_name: string;
  previous_username: string | null;
  released_at: Date | null;
  created_at: Date;
}

const usernameHistorySchema = new Schema<IUsernameHistory>(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    custom_display_name: {
      type: String,
      required: true,
      index: true,
    },
    previous_username: {
      type: String,
      default: null,
    },
    released_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Compound index for fast username lookups
usernameHistorySchema.index({ username: 1, released_at: 1 });
usernameHistorySchema.index({ custom_display_name: 1, released_at: 1 });

export const UsernameHistory = mongoose.model<IUsernameHistory>('UsernameHistory', usernameHistorySchema);
