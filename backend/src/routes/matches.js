import { Router } from "express";
import {
  listMatchesQuerySchema,
  createMatchSchema,
  updateScoreSchema,
  matchIdParamSchema,
} from "../validation/matches.js";
import { desc, eq } from "drizzle-orm";
import { matches } from "../db/schema.js";
import { db, withRetry } from "../db/index.js";

const router = Router();
const MAX_LIMIT = 100;

/**
 * GET /matches — fetch matches with optional limit query param.
 * Returns matches ordered by createdAt descending, limited to a max of 100.
 */
router.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query",
      details: parsed.error.issues,
    });
  }

  try {
    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);
    const allMatches = await withRetry(() =>
      db
        .select()
        .from(matches)
        .orderBy(desc(matches.createdAt))
        .limit(limit)
    );
    res.status(200).json(allMatches);
  } catch (e) {
    console.error("Failed to fetch matches:", e);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

/**
 * POST /matches — create a new match.
 * Validates the body, inserts into the DB, broadcasts via WebSocket, returns the row.
 */
router.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid Payload",
      details: parsed.error.issues,
    });
  }

  try {
    const { startTime, endTime, homeScore, awayScore } = parsed.data;
    const [match] = await withRetry(() =>
      db
        .insert(matches)
        .values({
          ...parsed.data,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          homeScore: homeScore ?? 0,
          awayScore: awayScore ?? 0,
        })
        .returning()
    );

    if (res.app.locals.broadCastMatch) {
      res.app.locals.broadCastMatch(match);
    }

    res.status(201).json({ success: "data added", data: match });
  } catch (e) {
    console.error("Failed to create match:", e);
    res.status(500).json({ error: "Failed to create match" });
  }
});

/**
 * PATCH /matches/:id/score — update the live score of a match.
 * Validates the param and body, updates the DB, broadcasts to subscribers.
 * Returns 404 if the match ID does not exist.
 */
router.patch("/:id/score", async (req, res) => {
  const params = matchIdParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: "Invalid match ID", details: params.error.issues });
  }

  const body = updateScoreSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid score", details: body.error.issues });
  }

  try {
    const [match] = await withRetry(() =>
      db
        .update(matches)
        .set({ homeScore: body.data.homeScore, awayScore: body.data.awayScore })
        .where(eq(matches.id, params.data.id))
        .returning()
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    if (res.app.locals.broadCastScoreUpdate) {
      res.app.locals.broadCastScoreUpdate(params.data.id, match);
    }

    res.status(200).json({ data: match });
  } catch (e) {
    console.error("Failed to update score:", e);
    res.status(500).json({ error: "Failed to update score" });
  }
});

export default router;
