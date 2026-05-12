import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IAdminUser extends Document {
  username: string;
  password_hash: string;
  token_version: number;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    token_version: {
      type: Number,
      default: 0,
    },
    failed_login_attempts: {
      type: Number,
      default: 0,
    },
    locked_until: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const AdminUser = registerModel<IAdminUser>('AdminUser', adminUserSchema);
