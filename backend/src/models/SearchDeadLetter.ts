import mongoose, { Schema, Document } from 'mongoose';

export interface ISearchDeadLetter extends Document {
  index_name: string;
  docId: string;
  operation: 'index' | 'delete';
  error: string;
  attempts: number;
  last_attempt_at: Date;
  created_at: Date;
}

const searchDeadLetterSchema = new Schema<ISearchDeadLetter>(
  {
    index_name: { type: String, required: true, index: true },
    docId: { type: String, required: true, index: true },
    operation: { type: String, required: true, enum: ['index', 'delete'] },
    error: { type: String, required: true },
    attempts: { type: Number, required: true, default: 1 },
    last_attempt_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

searchDeadLetterSchema.index({ index_name: 1, docId: 1 }, { unique: true });

export const SearchDeadLetter = mongoose.model<ISearchDeadLetter>(
  'SearchDeadLetter',
  searchDeadLetterSchema
);
