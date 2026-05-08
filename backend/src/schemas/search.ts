import { z } from 'zod';

const VALID_SORT = ['_score', 'newest', 'most_comments', 'most_fire'] as const;
const VALID_POST_TYPES = [
  'top_list', 'this_vs_that', 'who_is_better', 'fact_drop',
  'best_of', 'worst_of', 'hidden_gems', 'counter_list',
] as const;

const VALID_REINDEX_SCOPE = ['all', 'posts', 'comments', 'categories', 'users'] as const;

export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(200, 'Query must be at most 200 characters'),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(VALID_SORT).default('_score'),
  category_slug: z.string().max(100).optional(),
  post_type: z.enum(VALID_POST_TYPES).optional(),
  author: z.string().min(1).max(30).optional(),
});

export const autocompleteQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100, 'Query must be at most 100 characters'),
});

export const adminReindexSchema = z.object({
  scope: z.enum(VALID_REINDEX_SCOPE).default('all'),
});

export const adminPreviewQuerySchema = z.object({
  q: z.string().min(1, 'Query must be at least 1 character').max(200),
});

export const adminDeleteIndexSchema = z.object({
  index: z.enum(['posts', 'comments', 'categories', 'users']),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
export type AdminReindexBody = z.infer<typeof adminReindexSchema>;
export type AdminPreviewQuery = z.infer<typeof adminPreviewQuerySchema>;
export type AdminDeleteIndexBody = z.infer<typeof adminDeleteIndexSchema>;
