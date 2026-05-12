import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IAlertHistory extends Document {
  metric: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  operator: 'gt' | 'lt';
  triggered_at: Date;
  resolved_at: Date | null;
}

const alertHistorySchema = new Schema<IAlertHistory>(
  {
    metric: { type: String, required: true, index: true },
    severity: { type: String, required: true, enum: ['warning', 'critical'] },
    value: { type: Number, required: true },
    threshold: { type: Number, required: true },
    operator: { type: String, required: true, enum: ['gt', 'lt'] },
    triggered_at: { type: Date, required: true },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: false }
);

alertHistorySchema.index({ triggered_at: -1 });
alertHistorySchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AlertHistory = registerModel<IAlertHistory>('AlertHistory', alertHistorySchema);
