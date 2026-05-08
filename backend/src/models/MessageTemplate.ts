import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageTemplate extends Document {
  name: string;
  title: string;
  body: string;
  priority: 'info' | 'important' | 'urgent';
  created_at: Date;
}

const messageTemplateSchema = new Schema<IMessageTemplate>(
  {
    name: { type: String, required: true, unique: true, maxlength: 50 },
    title: { type: String, required: true, maxlength: 100 },
    body: { type: String, required: true, maxlength: 2000 },
    priority: { type: String, required: true, enum: ['info', 'important', 'urgent'], default: 'info' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const MessageTemplate = mongoose.model<IMessageTemplate>('MessageTemplate', messageTemplateSchema);
