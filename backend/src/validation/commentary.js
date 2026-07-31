import { z } from 'zod';

/**
 * Validates query params for GET /matches/:id/commentary.
 * - limit: optional positive integer ≤ 100
 */
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().positive().int().max(100).optional(),
});

/**
 * Validates the request body for POST /matches/:id/commentary.
 * Requires minute, sequence, period, eventType, message.
 * Optional fields: actor, team, metadata (JSON object), tags (string[]).
 */
export const createCommentarySchema = z.object({
  minute: z.coerce.number().nonnegative().int(),
  sequence: z.coerce.number().int(),
  period: z.string().min(1),
  eventType: z.string().min(1),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});
