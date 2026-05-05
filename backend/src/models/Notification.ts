import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  user_id: string;
  type: 'post_approved' | 'post_rejected' | 'revision_requested';
  post_id: string;
  post_title: string;
  message: string;
  read: boolean;
  created_at: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['post_approved', 'post_rejected', 'revision_requested'],
    },
    post_id: {
      type: String,
      required: true,
    },
    post_title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

notificationSchema.index({ user_id: 1, read: 1, created_at: -1 });
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export async function createNotification(params: {
  user_id: string;
  type: INotification['type'];
  post_id: string;
  post_title: string;
  message: string;
}): Promise<void> {
  await Notification.create(params);
}
