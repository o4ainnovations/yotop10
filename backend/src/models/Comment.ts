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
  spark_score: number;
  last_engaged_at: Date;
  deleted: boolean;
  deleted_at: Date | null;
  hidden: boolean;
  hidden_reason: string | null;
  highlighted: boolean;
  content_history: Array<{ content: string; changed_at: Date }>;
  flag_type: string | null;
  flag_evidence: Record<string, unknown> | null;
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
      max: 10,
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
    spark_score: {
      type: Number,
      default: 0,
      index: true,
    },
    last_engaged_at: {
      type: Date,
      default: Date.now,
    },
    deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
    hidden: { type: Boolean, default: false },
    hidden_reason: { type: String, default: null },
    highlighted: { type: Boolean, default: false },
    content_history: { type: [{ content: String, changed_at: Date }], default: [] },
    flag_type: { type: String, default: null },
    flag_evidence: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes for efficient queries
commentSchema.index({ post_id: 1, created_at: -1 });
commentSchema.index({ post_id: 1, list_item_id: 1, created_at: -1 });
commentSchema.index({ post_id: 1, spark_score: -1 });
commentSchema.index({ parent_comment_id: 1, created_at: 1 });
commentSchema.index({ author_id: 1, created_at: -1 });
commentSchema.index({ depth: 1 });
commentSchema.index({ last_engaged_at: -1 });

// Track content changes
commentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    if (!this.content_history) this.content_history = [];
    this.content_history.push({ content: this.content, changed_at: new Date() });
  }
  next();
});

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
