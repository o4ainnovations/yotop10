import { z } from 'zod';

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  trust_tier: z.enum(['troll', 'neutral', 'scholar']).optional(),
  status: z.enum(['active', 'restricted']).optional(),
  sort: z.enum(['created_at', 'trust_score', 'post_count']).default('created_at'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
});

export const restrictUserSchema = z.object({
  restricted_until: z.string().datetime().nullable(),
});

export const rateLimitOverrideSchema = z.object({
  posts_per_hour: z.number().int().min(0).max(100).nullable(),
  comments_per_hour: z.number().int().min(0).max(100).nullable(),
});

export const trustAdjustSchema = z.object({
  trust_score: z.number().min(0.1).max(2.0).optional(),
  trust_locked: z.boolean().optional(),
});

export const trustHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const configUpdateSchema = z.object({
  rate_limits: z
    .object({
      base_posts_per_hour: z.number().int().min(1).max(100).optional(),
      base_comments_per_hour: z.number().int().min(1).max(200).optional(),
      tiers: z
        .object({
          troll: z
            .object({
              multiplier: z.number().min(0.1).max(10).optional(),
              min_posts: z.number().int().min(1).max(50).optional(),
            })
            .optional(),
          neutral: z
            .object({
              multiplier: z.number().min(0.1).max(10).optional(),
              min_posts: z.number().int().min(1).max(50).optional(),
            })
            .optional(),
          scholar: z
            .object({
              multiplier: z.number().min(0.1).max(10).optional(),
              min_posts: z.number().int().min(1).max(50).optional(),
            })
            .optional(),
        })
        .optional(),
      counter_lists_unlimited: z.boolean().optional(),
      comment_edit_window_minutes: z.number().int().min(0).max(1440).optional(),
    })
    .optional(),
  trust_tiers: z
    .object({
      troll_max: z.number().min(0).max(2).optional(),
      neutral_min: z.number().min(0).max(2).optional(),
      scholar_min: z.number().min(0).max(2.0).optional(),
      hysteresis_enter: z.number().min(0).max(2).optional(),
      hysteresis_lose: z.number().min(0).max(2).optional(),
      review_window: z.number().int().min(1).max(200).optional(),
      double_blind: z.boolean().optional(),
    })
    .optional(),
});

export const configImpactQuerySchema = z.object({
  changes: z.string().optional(),
});

export const addToHallOfFameSchema = z.object({
  post_id: z.string().min(1),
  editorial_note: z.string().max(500).optional(),
});

export const reorderHallOfFameSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().min(1),
        sort_order: z.number().int().min(0),
      })
    )
    .min(1)
    .max(200),
});

export const updateHallOfFameNoteSchema = z.object({
  editorial_note: z.string().max(500),
});
