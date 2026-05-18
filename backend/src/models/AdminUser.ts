import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IAdminUser extends Document {
  username: string;
  password_hash: string;
  role: 'super_admin' | 'mod';
  permissions: string[];
  permissions_version: number;
  token_version: number;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_by: string;
  is_active: boolean;
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
    role: {
      type: String,
      enum: ['super_admin', 'mod'],
      default: 'mod',
    },
    permissions: {
      type: [String],
      default: [],
    },
    permissions_version: {
      type: Number,
      default: 1,
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
    created_by: {
      type: String,
      default: 'system',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const AdminUser = registerModel<IAdminUser>('AdminUser', adminUserSchema);
