/**
 * Unit tests for Zod validation schemas.
 * No DB or network dependency — pure schema logic only.
 */

import { describe, it, expect } from 'vitest';
import {
  listMatchesQuerySchema,
  matchIdParamSchema,
  createMatchSchema,
  updateScoreSchema,
} from '../validation/matches.js';
import {
  listCommentaryQuerySchema,
  createCommentarySchema,
} from '../validation/commentary.js';

describe('listMatchesQuerySchema', () => {
  it('accepts empty query', () => {
    expect(listMatchesQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid limit', () => {
    expect(listMatchesQuerySchema.safeParse({ limit: '25' }).success).toBe(true);
  });

  it('rejects limit > 100', () => {
    const r = listMatchesQuerySchema.safeParse({ limit: '101' });
    expect(r.success).toBe(false);
  });

  it('rejects negative limit', () => {
    const r = listMatchesQuerySchema.safeParse({ limit: '-1' });
    expect(r.success).toBe(false);
  });

  it('rejects zero limit', () => {
    const r = listMatchesQuerySchema.safeParse({ limit: '0' });
    expect(r.success).toBe(false);
  });
});

describe('matchIdParamSchema', () => {
  it('accepts numeric id', () => {
    expect(matchIdParamSchema.safeParse({ id: '1' }).success).toBe(true);
  });

  it('rejects zero id', () => {
    expect(matchIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });

  it('rejects negative id', () => {
    expect(matchIdParamSchema.safeParse({ id: '-5' }).success).toBe(false);
  });

  it('rejects non-numeric id', () => {
    expect(matchIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
  });
});

describe('createMatchSchema', () => {
  const validBody = {
    sport: 'football',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    startTime: '2026-08-01T10:00:00.000Z',
    endTime: '2026-08-01T12:00:00.000Z',
  };

  it('accepts valid match', () => {
    expect(createMatchSchema.safeParse(validBody).success).toBe(true);
  });

  it('accepts optional scores', () => {
    const r = createMatchSchema.safeParse({ ...validBody, homeScore: 1, awayScore: 2 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.homeScore).toBe(1);
      expect(r.data.awayScore).toBe(2);
    }
  });

  it('rejects missing sport', () => {
    const { sport, ...noSport } = validBody;
    expect(createMatchSchema.safeParse(noSport).success).toBe(false);
  });

  it('rejects empty homeTeam', () => {
    expect(createMatchSchema.safeParse({ ...validBody, homeTeam: '' }).success).toBe(false);
  });

  it('rejects invalid startTime', () => {
    expect(createMatchSchema.safeParse({ ...validBody, startTime: 'not-a-date' }).success).toBe(false);
  });

  it('rejects endTime before startTime', () => {
    const r = createMatchSchema.safeParse({
      ...validBody,
      startTime: '2026-08-01T12:00:00.000Z',
      endTime: '2026-08-01T10:00:00.000Z',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('endTime');
    }
  });

  it('rejects endTime equal to startTime', () => {
    const t = '2026-08-01T10:00:00.000Z';
    expect(createMatchSchema.safeParse({ ...validBody, startTime: t, endTime: t }).success).toBe(false);
  });

  it('rejects negative homeScore', () => {
    expect(createMatchSchema.safeParse({ ...validBody, homeScore: -1 }).success).toBe(false);
  });

  it('rejects non-integer awayScore', () => {
    expect(createMatchSchema.safeParse({ ...validBody, awayScore: 2.5 }).success).toBe(false);
  });
});

describe('updateScoreSchema', () => {
  it('accepts valid scores', () => {
    expect(updateScoreSchema.safeParse({ homeScore: 3, awayScore: 1 }).success).toBe(true);
  });

  it('accepts zero scores', () => {
    expect(updateScoreSchema.safeParse({ homeScore: 0, awayScore: 0 }).success).toBe(true);
  });

  it('rejects missing homeScore', () => {
    expect(updateScoreSchema.safeParse({ awayScore: 1 }).success).toBe(false);
  });

  it('rejects negative scores', () => {
    expect(updateScoreSchema.safeParse({ homeScore: -1, awayScore: 0 }).success).toBe(false);
  });

  it('rejects non-integer scores', () => {
    expect(updateScoreSchema.safeParse({ homeScore: 1.5, awayScore: 2 }).success).toBe(false);
  });
});

describe('listCommentaryQuerySchema', () => {
  it('accepts empty', () => {
    expect(listCommentaryQuerySchema.safeParse({}).success).toBe(true);
  });

  it('rejects limit > 100', () => {
    expect(listCommentaryQuerySchema.safeParse({ limit: '200' }).success).toBe(false);
  });
});

describe('createCommentarySchema', () => {
  const valid = {
    minute: 10,
    sequence: 1,
    period: 'firstHalf',
    eventType: 'goal',
    message: 'Goal scored!',
  };

  it('accepts valid commentary', () => {
    expect(createCommentarySchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional fields', () => {
    const r = createCommentarySchema.safeParse({ ...valid, actor: 'Player A', team: 'home', tags: ['goal'] });
    expect(r.success).toBe(true);
  });

  it('rejects missing minute', () => {
    const { minute, ...noMinute } = valid;
    expect(createCommentarySchema.safeParse(noMinute).success).toBe(false);
  });

  it('rejects empty message', () => {
    expect(createCommentarySchema.safeParse({ ...valid, message: '' }).success).toBe(false);
  });

  it('rejects non-integer minute', () => {
    expect(createCommentarySchema.safeParse({ ...valid, minute: 1.5 }).success).toBe(false);
  });

  it('rejects negative minute', () => {
    expect(createCommentarySchema.safeParse({ ...valid, minute: -1 }).success).toBe(false);
  });
});
