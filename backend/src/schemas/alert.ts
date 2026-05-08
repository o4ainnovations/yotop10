import { z } from 'zod';

const VALID_METRICS = [
  'pending_queue_depth', 'approval_rate_drop', 'zero_review_hours',
  'comment_brigade', 'es_index_gap_pct', 'restricted_user_surge',
  'new_user_spam_wave', 'scholar_ratio_collapse', 'flagged_comment_backlog',
  'hidden_comment_surge', 'post_quality_drop', 'snapshot_staleness',
] as const;

export const createThresholdSchema = z.object({
  metric: z.enum(VALID_METRICS),
  threshold: z.number().min(0),
  operator: z.enum(['gt', 'lt']),
  severity: z.enum(['warning', 'critical']),
  cooldown_minutes: z.number().int().min(1).max(1440).default(30),
});

export const updateThresholdSchema = z.object({
  threshold: z.number().min(0).optional(),
  operator: z.enum(['gt', 'lt']).optional(),
  severity: z.enum(['warning', 'critical']).optional(),
  cooldown_minutes: z.number().int().min(1).max(1440).optional(),
});

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: z.enum(['warning', 'critical']).optional(),
  read: z.enum(['true', 'false']).optional(),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  metric: z.string().optional(),
  severity: z.enum(['warning', 'critical']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export type CreateThreshold = z.infer<typeof createThresholdSchema>;
export type UpdateThreshold = z.infer<typeof updateThresholdSchema>;
