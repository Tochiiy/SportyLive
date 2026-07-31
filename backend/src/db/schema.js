import { pgEnum, pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Enum for match lifecycle: scheduled → live → finished.
 */
export const matchStatus = pgEnum('match_status', ['scheduled', 'live', 'finished']);

/**
 * Core matches table — stores all sport match records.
 * Each row represents a single match with its teams, status, scores, and time window.
 */
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  sport: text('sport').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  status: matchStatus('status').default('scheduled').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  homeScore: integer('home_score').default(0).notNull(),
  awayScore: integer('away_score').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
});

/**
 * Commentary table — event-by-event timeline for each match.
 * Stores play-by-play entries keyed to a specific match via FK.
 */
export const commentary = pgTable('commentary', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  minute: integer('minute').notNull(),
  sequence: integer('sequence').notNull(),
  period: text('period').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor'),
  team: text('team'),
  message: text('message').notNull(),
  metadata: jsonb('metadata').default({}),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
});
