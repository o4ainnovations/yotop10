import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminMessage extends Document {
  type: 'individual' | 'broadcast';
  recipient_id: string | null;
  title: string;
  body: string;
  priority: 'info' | 'important' | 'urgent';
  created_by: string;
  dismissed_by: string[];
  expires_at: Date;
  created_at: Date;
}

const adminMessageSchema = new Schema<IAdminMessage>(
  {
    type: { type: String, required: true, enum: ['individual', 'broadcast'] },
    recipient_id: { type: String, default: null, index: true },
    title: { type: String, required: true, maxlength: 100 },
    body: { type: String, required: true, maxlength: 2000 },
    priority: { type: String, required: true, enum: ['info', 'important', 'urgent'], default: 'info' },
    created_by: { type: String, required: true },
    dismissed_by: { type: [String], default: [] },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

adminMessageSchema.index({ type: 1, created_at: -1 });
adminMessageSchema.index({ recipient_id: 1, created_at: -1 });
adminMessageSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const AdminMessage = mongoose.model<IAdminMessage>('AdminMessage', adminMessageSchema);
