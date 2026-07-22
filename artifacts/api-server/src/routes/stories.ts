import { Router } from "express";
import { eq, desc, and, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import cookieParser from "cookie-parser";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { runStoryGeneration } from "../lib/generation";
import { logger } from "../lib/logger";

const router = Router();
router.use(cookieParser());

const SESSION_COOKIE = "story_session";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

function getSessionId(req: Parameters<Parameters<typeof router.use>[0]>[0], res: Parameters<Parameters<typeof router.use>[0]>[1]): string {
  let sessionId = (req as { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    sessionId = randomUUID();
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
  return sessionId;
}

function storyToResponse(row: typeof storiesTable.$inferSelect) {
  const base = `/api/uploads/`;
  return {
    id: row.id,
    title: row.title,
    characterName: row.characterName,
    characterName2: row.characterName2 ?? null,
    relationship: row.relationship,
    relationship2: row.relationship2 ?? null,
    theme: row.theme,
    age: row.age,
    emotion: row.emotion,
    outfit: row.outfit ?? null,
    pageCount: row.pageCount,
    userPrompt: row.userPrompt ?? null,
    originalPhotoUrl: row.originalPhotoPath ? `${base}${row.originalPhotoPath}` : null,
    characterImageUrl: row.characterImagePath ? `${base}${row.characterImagePath}` : null,
    coverImageUrl: row.coverImagePath ? `${base}${row.coverImagePath}` : null,
    status: row.status,
    generationProgress: row.generationProgress,
    generationStatusMessage: row.generationStatusMessage ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function pageToResponse(row: typeof storyPagesTable.$inferSelect) {
  return {
    id: row.id,
    storyId: row.storyId,
    pageNumber: row.pageNumber,
    text: row.text ?? null,
    imageUrl: row.imagePath ? `/api/uploads/${row.imagePath}` : null,
    imagePrompt: row.imagePrompt ?? null,
  };
}

// GET /api/stories
router.get("/stories", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req, res);
  const rows = await db
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.sessionId, sessionId))
    .orderBy(desc(storiesTable.createdAt));
  res.json(rows.map(storyToResponse));
});

// POST /api/stories
router.post("/stories", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req, res);
  const body = req.body as Record<string, unknown>;

  if (!body.title || !body.characterName || !body.relationship || !body.theme || !body.age || !body.emotion || !body.originalPhotoPath) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const id = randomUUID();
  const newStory: typeof storiesTable.$inferInsert = {
    id,
    sessionId,
    title: String(body.title),
    characterName: String(body.characterName),
    characterName2: body.characterName2 ? String(body.characterName2) : null,
    relationship: String(body.relationship),
    relationship2: body.relationship2 ? String(body.relationship2) : null,
    petType: body.petType ? String(body.petType) : null,
    petType2: body.petType2 ? String(body.petType2) : null,
    theme: String(body.theme),
    customTheme: body.customTheme ? String(body.customTheme) : null,
    age: String(body.age),
    emotion: String(body.emotion),
    outfit: body.outfit ? String(body.outfit) : null,
    occasion: body.occasion ? String(body.occasion) : null,
    pageCount: Number(body.pageCount) || 8,
    userPrompt: body.userPrompt ? String(body.userPrompt) : null,
    originalPhotoPath: String(body.originalPhotoPath),
    originalPhotoPath2: body.originalPhotoPath2 ? String(body.originalPhotoPath2) : null,
    status: "pending",
    generationProgress: 0,
  };

  await db.insert(storiesTable).values(newStory);
  const inserted = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });
  res.status(201).json(storyToResponse(inserted!));
});

// GET /api/stories/stats
router.get("/stories/stats", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req, res);

  const [totals] = await db
    .select({ total: count() })
    .from(storiesTable)
    .where(eq(storiesTable.sessionId, sessionId));

  const [completed] = await db
    .select({ total: count() })
    .from(storiesTable)
    .where(and(eq(storiesTable.sessionId, sessionId), eq(storiesTable.status, "complete")));

  const [inProgress] = await db
    .select({ total: count() })
    .from(storiesTable)
    .where(and(eq(storiesTable.sessionId, sessionId), eq(storiesTable.status, "generating")));

  const recent = await db
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.sessionId, sessionId))
    .orderBy(desc(storiesTable.createdAt))
    .limit(3);

  res.json({
    totalStories: totals.total,
    completedStories: completed.total,
    inProgressStories: inProgress.total,
    recentStories: recent.map(storyToResponse),
  });
});

// DELETE /api/stories/:id
router.delete("/stories/:id", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req, res);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = await db.query.storiesTable.findFirst({
    where: and(eq(storiesTable.id, id), eq(storiesTable.sessionId, sessionId)),
  });

  if (!existing) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  await db.delete(storyPagesTable).where(eq(storyPagesTable.storyId, id));
  await db.delete(storiesTable).where(eq(storiesTable.id, id));
  res.json({ ok: true });
});

// GET /api/stories/:id/status
router.get("/stories/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });

  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  res.json({
    id: story.id,
    status: story.status,
    generationProgress: story.generationProgress,
    generationStatusMessage: story.generationStatusMessage ?? null,
    errorMessage: story.errorMessage ?? null,
    characterImageUrl: story.characterImagePath ? `/api/uploads/${story.characterImagePath}` : null,
    coverImageUrl: story.coverImagePath ? `/api/uploads/${story.coverImagePath}` : null,
  });
});

// POST /api/stories/:id/generate
router.post("/stories/:id/generate", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });

  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  if (story.status !== "pending" && story.status !== "error") {
    res.json({ ok: true, message: "Generation already in progress or complete" });
    return;
  }

  // Fire-and-forget: run generation in background
  runStoryGeneration(id).catch((err) => {
    logger.error({ storyId: id, err }, "Background generation crashed");
  });

  res.json({ ok: true, message: "Generation started" });
});

// GET /api/stories/:id/reading
router.get("/stories/:id/reading", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });
  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  const pages = await db
    .select()
    .from(storyPagesTable)
    .where(eq(storyPagesTable.storyId, id))
    .orderBy(storyPagesTable.pageNumber);

  res.json({
    story: storyToResponse(story),
    pages: pages.map(pageToResponse),
  });
});

export default router;
