import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IPermissionPreset extends Document {
  name: string;
  description: string;
  permissions: string[];
  created_at: Date;
}

const permissionPresetSchema = new Schema<IPermissionPreset>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    permissions: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

export const PermissionPreset = registerModel<IPermissionPreset>(
  'PermissionPreset',
  permissionPresetSchema
);
