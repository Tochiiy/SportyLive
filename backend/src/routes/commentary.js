import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { matchIdParamSchema } from "../validation/matches.js";
import { listCommentaryQuerySchema, createCommentarySchema } from "../validation/commentary.js";
import { commentary } from "../db/schema.js";
import { db, withRetry } from "../db/index.js";

const router = Router({ mergeParams: true });
const MAX_LIMIT = 100;

/**
 * GET /matches/:id/commentary — fetch commentary for a match.
 * Filters by matchId, ordered by createdAt descending, limited to 100.
 */
router.get("/", async (req, res) => {
  const params = matchIdParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: "Invalid match ID", details: params.error.issues });
  }

  const query = listCommentaryQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: "Invalid query", details: query.error.issues });
  }

  try {
    const limit = Math.min(query.data.limit ?? 100, MAX_LIMIT);
    const rows = await withRetry(() =>
      db
        .select()
        .from(commentary)
        .where(eq(commentary.matchId, params.data.id))
        .orderBy(desc(commentary.createdAt))
        .limit(limit)
    );
    res.status(200).json(rows);
  } catch (e) {
    console.error("Failed to fetch commentary:", e);
    res.status(500).json({ error: "Failed to fetch commentary" });
  }
});

/**
 * POST /matches/:id/commentary — add a commentary entry to a match.
 * Validates both the match ID param and the commentary body.
 */
router.post("/", async (req, res) => {
  const params = matchIdParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: "Invalid match ID", details: params.error.issues });
  }

  const body = createCommentarySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid payload", details: body.error.issues });
  }

  try {
    const [row] = await withRetry(() =>
      db
        .insert(commentary)
        .values({ ...body.data, matchId: params.data.id })
        .returning()
    );
    res.status(201).json(row);
  } catch (e) {
    console.error("Failed to create commentary:", e);
    res.status(500).json({ error: "Failed to create commentary" });
  }
});

export default router;
