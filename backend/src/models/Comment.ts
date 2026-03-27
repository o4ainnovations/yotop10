import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  post_id: mongoose.Types.ObjectId;
  list_item_id?: mongoose.Types.ObjectId;
  parent_comment_id?: mongoose.Types.ObjectId;
  depth: number;
  author_id: string;
  author_username: string;
  author_display_name: string;
  content: string;
  fire_count: number;
  reply_count: number;
  created_at: Date;
  updated_at: Date;
}

const commentSchema = new Schema<IComment>(
  {
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    list_item_id: {
      type: Schema.Types.ObjectId,
      ref: 'ListItem',
      index: true,
    },
    parent_comment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      index: true,
    },
    depth: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 3,
    },
    author_id: {
      type: String,
      required: true,
      index: true,
    },
    author_username: {
      type: String,
      required: true,
      index: true,
    },
    author_display_name: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    fire_count: {
      type: Number,
      default: 0,
    },
    reply_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes for efficient queries
commentSchema.index({ post_id: 1, created_at: -1 });
commentSchema.index({ post_id: 1, list_item_id: 1, created_at: -1 });
commentSchema.index({ parent_comment_id: 1, created_at: 1 });
commentSchema.index({ author_id: 1, created_at: -1 });
commentSchema.index({ depth: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
