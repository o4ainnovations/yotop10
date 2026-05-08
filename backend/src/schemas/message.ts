import { z } from 'zod';

export const sendMessageSchema = z.object({
  type: z.enum(['individual', 'broadcast']),
  recipient_id: z.string().min(1).max(50).nullable().optional(),
  title: z.string().min(1, 'Title is required').max(100, 'Title max 100 characters'),
  body: z.string().min(1, 'Message body is required').max(2000, 'Body max 2000 characters'),
  priority: z.enum(['info', 'important', 'urgent']).default('info'),
  expires_in_days: z.number().int().min(1).max(365).default(30),
}).refine(
  (data) => data.type === 'broadcast' || (data.type === 'individual' && !!data.recipient_id),
  { message: 'recipient_id is required for individual messages', path: ['recipient_id'] }
);

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['individual', 'broadcast']).optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1).max(50),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  priority: z.enum(['info', 'important', 'urgent']).default('info'),
});

export const userMessageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SendMessage = z.infer<typeof sendMessageSchema>;
export type TemplateBody = z.infer<typeof templateSchema>;
