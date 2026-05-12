import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IUserDevice extends Document {
  device_fingerprint: string;
  user_id: string;
  authority_id: string;
  label?: string;
  linked_at: Date;
}

const userDeviceSchema = new Schema<IUserDevice>(
  {
    device_fingerprint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    authority_id: {
      type: String,
      required: true,
      index: true,
    },
    label: {
      type: String,
    },
    linked_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

userDeviceSchema.index({ user_id: 1, device_fingerprint: 1 });

export const UserDevice = registerModel<IUserDevice>('UserDevice', userDeviceSchema);
