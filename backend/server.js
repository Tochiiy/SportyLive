/**
 * Entry point for the SportyLive backend.
 * Imports the HTTP server from app.js, warms up the DB connection,
 * and starts listening.
 */

import { server } from './src/app.js';
import { pingDatabase } from './src/db/index.js';

const PORT = process.env.PORT || 8080;

/**
 * Warm up the Neon database connection before accepting traffic,
 * so the first request doesn't hit a cold-start timeout.
 */
await pingDatabase();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
