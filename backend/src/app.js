import "dotenv/config";
import express from "express";
import http from "http";
import { sql } from "drizzle-orm";
import { db, withRetry } from "./db/index.js";
import matchesRouter from "./routes/matches.js";
import commentaryRouter from "./routes/commentary.js";
import { attachSocketServer } from "./websocket/server.js";

const app = express();
app.use(express.json());

/**
 * Create an HTTP server and attach the WebSocket server to it.
 * WebSocket handlers are stored on app.locals for access in route handlers.
 */
const server = http.createServer(app);
const { broadCastMatch, broadCastScoreUpdate } = attachSocketServer(server);
app.locals.broadCastMatch = broadCastMatch;
app.locals.broadCastScoreUpdate = broadCastScoreUpdate;

/**
 * Mount route modules.
 * Commentary routes use mergeParams to inherit the :id from the parent path.
 */
app.use("/matches", matchesRouter);
app.use("/matches/:id/commentary", commentaryRouter);

/**
 * Root health/status endpoints.
 */
app.get("/", (req, res) => {
  res.send("SportyLive backend");
});

app.get("/health", async (req, res) => {
  try {
    await withRetry(() => db.execute(sql`SELECT 1`));
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

export { app, server };
