import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface ISearchEvent extends Document {
  query: string;
  normalized_query: string;
  query_length: number;
  fingerprint: string | null;
  session_id: string;
  filters_applied: {
    category_slug?: string;
    post_type?: string;
    author?: string;
  };
  sort_used: string;
  total_results: { posts: number; comments: number };
  had_suggestion: boolean;
  suggestion_text: string | null;
  suggestion_accepted: boolean;
  zero_results: boolean;
  page: number;
  response_time_ms: number;
  country: string | null;
  referer: string;
  timestamp: Date;
}

const searchEventSchema = new Schema<ISearchEvent>(
  {
    query: { type: String, required: true },
    normalized_query: { type: String, required: true, index: true },
    query_length: { type: Number, required: true },
    fingerprint: { type: String, default: null },
    session_id: { type: String, required: true, index: true },
    filters_applied: { type: Schema.Types.Mixed, default: {} },
    sort_used: { type: String, default: '_score' },
    total_results: { type: Schema.Types.Mixed, required: true },
    had_suggestion: { type: Boolean, default: false },
    suggestion_text: { type: String, default: null },
    suggestion_accepted: { type: Boolean, default: false },
    zero_results: { type: Boolean, default: false },
    page: { type: Number, default: 1 },
    response_time_ms: { type: Number, required: true },
    country: { type: String, default: null },
    referer: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

searchEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
searchEventSchema.index({ normalized_query: 1, timestamp: -1 });
searchEventSchema.index({ zero_results: 1, timestamp: -1 });

export const SearchEvent = registerModel<ISearchEvent>('SearchEvent', searchEventSchema);
