import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface ISearchDailyStats extends Document {
  date: string;
  total_searches: number;
  unique_searchers: number;
  zero_result_searches: number;
  zero_result_pct: number;
  top_queries: Array<{ query: string; count: number }>;
  top_zero_queries: Array<{ query: string; count: number }>;
  query_length_avg: number;
  avg_response_time_ms: number;
  p99_response_time_ms: number;
  suggestion_rate: number;
  suggestion_accept_rate: number;
  ctr_by_position: number[];
  avg_click_time_ms: number;
  facet_usage: { category: number; post_type: number; author: number };
  sort_usage: { relevance: number; newest: number; most_comments: number; most_fire: number };
  index_gap_pct: number;
  dead_letter_count: number;
}

const searchDailyStatsSchema = new Schema<ISearchDailyStats>(
  {
    date: { type: String, required: true, unique: true, index: true },
    total_searches: { type: Number, required: true },
    unique_searchers: { type: Number, required: true },
    zero_result_searches: { type: Number, required: true },
    zero_result_pct: { type: Number, required: true },
    top_queries: [{ query: String, count: Number }],
    top_zero_queries: [{ query: String, count: Number }],
    query_length_avg: { type: Number, required: true },
    avg_response_time_ms: { type: Number, required: true },
    p99_response_time_ms: { type: Number, required: true },
    suggestion_rate: { type: Number, required: true },
    suggestion_accept_rate: { type: Number, required: true },
    ctr_by_position: [{ type: Number }],
    avg_click_time_ms: { type: Number, required: true },
    facet_usage: {
      category: { type: Number, default: 0 },
      post_type: { type: Number, default: 0 },
      author: { type: Number, default: 0 },
    },
    sort_usage: {
      relevance: { type: Number, default: 0 },
      newest: { type: Number, default: 0 },
      most_comments: { type: Number, default: 0 },
      most_fire: { type: Number, default: 0 },
    },
    index_gap_pct: { type: Number, default: 0 },
    dead_letter_count: { type: Number, default: 0 },
  },
  { timestamps: false }
);

export const SearchDailyStats = registerModel<ISearchDailyStats>('SearchDailyStats', searchDailyStatsSchema);
