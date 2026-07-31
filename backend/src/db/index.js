import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool using Neon's direct endpoint.
 * - max: keep connections low for Neon free-tier limits
 * - idleTimeoutMillis: 30s — Neon kills idle connections aggressively server-side
 * - connectionTimeoutMillis: 30s — generous timeout for Neon cold starts
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  allowExitOnIdle: true,
});

/**
 * Log pool-level errors (e.g. idle client termination) without crashing.
 */
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

/**
 * Drizzle ORM client wrapping the pg pool.
 * Exported for use in route handlers and the health check.
 */
const db = drizzle(pool, { schema });

/**
 * Walk an error chain looking for the deepest cause.
 * Drizzle wraps the underlying pg error in `err.cause`, so inspecting
 * only `err.message` hides whether the connection was actually dropped.
 */
function deepestCause(err) {
  let current = err;
  while (current?.cause) {
    current = current.cause;
  }
  return current;
}

/**
 * Retry a DB operation if the connection was dropped mid-query.
 * Neon free tier can terminate idle connections (and cold-starts after
 * inactivity), leaving stale pooled clients that fail on next use.
 * This transparently retries with exponential backoff while the pool
 * evicts dead connections and the server wakes up.
 *
 * @param {() => Promise<T>} queryFn - callback that runs the DB query
 * @param {number} [attempts=4] - max number of tries
 * @returns {Promise<T>}
 */
async function withRetry(queryFn, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      lastError = err;
      const message = deepestCause(err)?.message || String(err);
      const connectionDropped =
        message.includes('Connection terminated') ||
        message.includes('ECONNRESET') ||
        message.includes('ECONNREFUSED') ||
        message.includes('terminated by') ||
        message.includes('timeout');
      if (!connectionDropped || attempt === attempts - 1) {
        throw err;
      }
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Warm-up ping executed once at server startup so the pool has a
 * live connection ready and Neon is not in a cold-start state.
 */
async function pingDatabase() {
  try {
    await withRetry(() => db.execute(sql`SELECT 1`), 2);
  } catch (err) {
    console.error('Startup DB ping failed:', err.message);
  }
}

export { db, withRetry, pingDatabase };
