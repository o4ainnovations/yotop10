import mongoose, { Schema, Document } from 'mongoose';

export interface IListItem extends Document {
  post_id: mongoose.Types.ObjectId;
  rank: number;
  title: string;
  justification: string;
  image_url?: string;
  source_url?: string;
  fire_count: number;
  created_at: Date;
  updated_at: Date;
}

const listItemSchema = new Schema<IListItem>(
  {
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    rank: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    justification: {
      type: String,
      required: true,
    },
    image_url: {
      type: String,
    },
    source_url: {
      type: String,
    },
    fire_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes for efficient queries
listItemSchema.index({ post_id: 1, rank: 1 });
listItemSchema.index({ post_id: 1, fire_count: -1 });

export const ListItem = mongoose.model<IListItem>('ListItem', listItemSchema);
