/**
 * Integration tests for all REST API routes.
 * Hits the running server at localhost:8080 to validate real DB interactions.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';

const api = request('http://localhost:8080');

describe('GET /', () => {
  it('responds with SportyLive backend', async () => {
    const res = await api.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('SportyLive backend');
  });
});

describe('GET /health', () => {
  it('returns ok with db connected', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });
});

describe('GET /matches', () => {
  it('returns array of matches', async () => {
    const res = await api.get('/matches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('respects limit query param', async () => {
    const res = await api.get('/matches?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(2);
  });

  it('rejects limit > 100', async () => {
    const res = await api.get('/matches?limit=200');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects negative limit', async () => {
    const res = await api.get('/matches?limit=-1');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /matches', () => {
  const newMatch = {
    sport: 'football',
    homeTeam: 'Test Team',
    awayTeam: 'Test Opponent',
    startTime: '2026-09-01T10:00:00.000Z',
    endTime: '2026-09-01T12:00:00.000Z',
  };

  it('creates a match and returns it', async () => {
    const res = await api.post('/matches').send(newMatch);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.sport).toBe('football');
    expect(res.body.data.homeScore).toBe(0);
    expect(res.body.data.awayScore).toBe(0);
  });

  it('rejects missing required fields', async () => {
    const res = await api.post('/matches').send({ sport: 'football' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects invalid date', async () => {
    const res = await api.post('/matches').send({ ...newMatch, startTime: 'bad-date' });
    expect(res.status).toBe(400);
  });

  it('rejects endTime before startTime', async () => {
    const res = await api
      .post('/matches')
      .send({
        ...newMatch,
        startTime: '2026-09-01T14:00:00.000Z',
        endTime: '2026-09-01T12:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /matches/:id/score', () => {
  let matchId;

  beforeAll(async () => {
    const matches = await api.get('/matches?limit=1');
    if (matches.body.length > 0) {
      matchId = matches.body[0].id;
    } else {
      const res = await api
        .post('/matches')
        .send({
          sport: 'basketball',
          homeTeam: 'Score Test',
          awayTeam: 'Score Opponent',
          startTime: '2026-10-01T10:00:00.000Z',
          endTime: '2026-10-01T12:00:00.000Z',
        });
      matchId = res.body.data?.id;
    }
  });

  it('updates the score', async () => {
    expect(matchId).toBeDefined();
    const res = await api
      .patch(`/matches/${matchId}/score`)
      .send({ homeScore: 7, awayScore: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.homeScore).toBe(7);
    expect(res.body.data.awayScore).toBe(3);
  });

  it('rejects invalid match ID', async () => {
    const res = await api
      .patch('/matches/abc/score')
      .send({ homeScore: 1, awayScore: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent match', async () => {
    const res = await api
      .patch('/matches/999999/score')
      .send({ homeScore: 1, awayScore: 0 });
    expect(res.status).toBe(404);
  });

  it('rejects missing scores', async () => {
    expect(matchId).toBeDefined();
    const res = await api
      .patch(`/matches/${matchId}/score`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects negative scores', async () => {
    expect(matchId).toBeDefined();
    const res = await api
      .patch(`/matches/${matchId}/score`)
      .send({ homeScore: -1, awayScore: 0 });
    expect(res.status).toBe(400);
  });
});

describe('Commentary on /matches/:id/commentary', () => {
  let matchId;

  beforeAll(async () => {
    const matches = await api.get('/matches?limit=1');
    if (matches.body.length > 0) {
      matchId = matches.body[0].id;
    } else {
      const res = await api
        .post('/matches')
        .send({
          sport: 'tennis',
          homeTeam: 'Commentary Test',
          awayTeam: 'Commentary Opponent',
          startTime: '2026-11-01T10:00:00.000Z',
          endTime: '2026-11-01T12:00:00.000Z',
        });
      matchId = res.body.data?.id;
    }
  });

  it('returns commentary list (may be empty)', async () => {
    expect(matchId).toBeDefined();
    const res = await api.get(`/matches/${matchId}/commentary`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a commentary entry', async () => {
    expect(matchId).toBeDefined();
    const res = await api
      .post(`/matches/${matchId}/commentary`)
      .send({ minute: 15, sequence: 1, period: 'firstHalf', eventType: 'goal', message: 'Great goal!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.matchId).toBe(matchId);
  });

  it('lists the created commentary', async () => {
    expect(matchId).toBeDefined();
    const res = await api.get(`/matches/${matchId}/commentary`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid match ID', async () => {
    const res = await api.post('/matches/abc/commentary').send({
      minute: 1, sequence: 1, period: 'firstHalf', eventType: 'goal', message: 'fail',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing required commentary fields', async () => {
    expect(matchId).toBeDefined();
    const res = await api
      .post(`/matches/${matchId}/commentary`)
      .send({ minute: 5 });
    expect(res.status).toBe(400);
  });
});
