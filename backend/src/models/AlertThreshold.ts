import mongoose, { Schema, Document } from 'mongoose';

export interface IAlertThreshold extends Document {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt';
  severity: 'warning' | 'critical';
  cooldown_minutes: number;
  enabled: boolean;
  last_triggered_at: Date | null;
  notification_sent: boolean;
}

const alertThresholdSchema = new Schema<IAlertThreshold>(
  {
    metric: { type: String, required: true, unique: true },
    threshold: { type: Number, required: true },
    operator: { type: String, required: true, enum: ['gt', 'lt'] },
    severity: { type: String, required: true, enum: ['warning', 'critical'] },
    cooldown_minutes: { type: Number, default: 30 },
    enabled: { type: Boolean, default: true },
    last_triggered_at: { type: Date, default: null },
    notification_sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AlertThreshold = mongoose.model<IAlertThreshold>('AlertThreshold', alertThresholdSchema);
