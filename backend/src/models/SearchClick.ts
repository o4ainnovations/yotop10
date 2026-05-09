import mongoose, { Schema, Document } from 'mongoose';

export interface ISearchClick extends Document {
  search_event_id: string;
  result_type: 'post' | 'comment';
  result_id: string;
  result_title: string;
  result_position: number;
  result_score: number;
  query: string;
  fingerprint: string | null;
  session_id: string;
  click_time_ms: number;
  timestamp: Date;
}

const searchClickSchema = new Schema<ISearchClick>(
  {
    search_event_id: { type: String, required: true, index: true },
    result_type: { type: String, required: true, enum: ['post', 'comment'] },
    result_id: { type: String, required: true },
    result_title: { type: String, required: true },
    result_position: { type: Number, required: true },
    result_score: { type: Number, default: 0 },
    query: { type: String, required: true },
    fingerprint: { type: String, default: null },
    session_id: { type: String, required: true, index: true },
    click_time_ms: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

searchClickSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
searchClickSchema.index({ search_event_id: 1, result_position: 1 });

export const SearchClick = mongoose.model<ISearchClick>('SearchClick', searchClickSchema);
