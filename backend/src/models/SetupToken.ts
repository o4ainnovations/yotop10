import mongoose, { Schema, Document } from 'mongoose';

export interface ISetupToken extends Document {
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

const setupTokenSchema = new Schema<ISetupToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

export const SetupToken = mongoose.model<ISetupToken>('SetupToken', setupTokenSchema);
