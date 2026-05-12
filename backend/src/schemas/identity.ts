import { z } from 'zod';

export const generateKeySchema = z.object({
  authority_id: z.string().length(64).regex(/^[0-9a-f]+$/),
});

export const claimChallengeSchema = z.object({
  authority_id: z.string().length(64).regex(/^[0-9a-f]+$/),
  device_fingerprint: z.string().length(32).regex(/^[0-9a-f]+$/),
});

export const claimVerifySchema = z.object({
  authority_id: z.string().length(64).regex(/^[0-9a-f]+$/),
  challenge: z.string().length(64).regex(/^[0-9a-f]+$/),
  signature: z.string().min(128),
  device_fingerprint: z.string().length(32).regex(/^[0-9a-f]+$/),
});

export const linkDeviceSchema = z.object({
  device_fingerprint: z.string().length(32).regex(/^[0-9a-f]+$/).optional(),
});
