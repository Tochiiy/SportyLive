import { z } from 'zod';

/**
 * Immutable map of valid match status values.
 * Used by the enum column in the DB and by route handlers.
 */
export const MATCH_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
});

/**
 * Validates query params for GET /matches.
 * - limit: optional positive integer ≤ 100
 */
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().positive().int().max(100).optional(),
});

/**
 * Validates the :id route param for single-match endpoints.
 * - id: positive integer
 */
export const matchIdParamSchema = z.object({
  id: z.coerce.number().positive().int(),
});

/**
 * Validates the request body for POST /matches.
 * Requires sport, homeTeam, awayTeam, startTime, endTime.
 * Optionally accepts homeScore / awayScore (default to 0).
 * SuperRefine ensures endTime > startTime.
 */
export const createMatchSchema = z.object({
  sport: z.string().min(1, 'sport is required'),
  homeTeam: z.string().min(1, 'homeTeam is required'),
  awayTeam: z.string().min(1, 'awayTeam is required'),
  startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: 'startTime must be a valid ISO date string',
  }),
  endTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: 'endTime must be a valid ISO date string',
  }),
  homeScore: z.coerce.number().nonnegative().int().optional(),
  awayScore: z.coerce.number().nonnegative().int().optional(),
}).superRefine((data, ctx) => {
  if (new Date(data.endTime) <= new Date(data.startTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endTime must be after startTime',
      path: ['endTime'],
    });
  }
});

/**
 * Validates the request body for PATCH /matches/:id/score.
 * Requires homeScore and awayScore as non-negative integers.
 */
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().nonnegative().int(),
  awayScore: z.coerce.number().nonnegative().int(),
});
