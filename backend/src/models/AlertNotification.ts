import mongoose, { Schema, Document } from 'mongoose';

export const ALERT_METRICS = [
  'pending_queue_depth',
  'approval_rate_drop',
  'zero_review_hours',
  'comment_brigade',
  'es_index_gap_pct',
  'restricted_user_surge',
  'new_user_spam_wave',
  'scholar_ratio_collapse',
  'flagged_comment_backlog',
  'hidden_comment_surge',
  'post_quality_drop',
  'snapshot_staleness',
] as const;

export type AlertMetric = (typeof ALERT_METRICS)[number];

export interface IAlertNotification extends Document {
  alert_type: AlertMetric;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  read: boolean;
  dismissed: boolean;
  created_at: Date;
}

const alertNotificationSchema = new Schema<IAlertNotification>(
  {
    alert_type: { type: String, required: true, enum: ALERT_METRICS, index: true },
    severity: { type: String, required: true, enum: ['warning', 'critical'] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    value: { type: Number, required: true },
    threshold: { type: Number, required: true },
    read: { type: Boolean, default: false, index: true },
    dismissed: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

alertNotificationSchema.index({ read: 1, dismissed: 1, created_at: -1 });
alertNotificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const AlertNotificationModel = mongoose.model<IAlertNotification>(
  'AlertNotification',
  alertNotificationSchema
);
