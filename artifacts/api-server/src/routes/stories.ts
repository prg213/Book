import { Router } from "express";
import { eq, desc, and, count, or, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import cookieParser from "cookie-parser";
import { getAuth } from "@clerk/express";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { runStoryGeneration } from "../lib/generation";
import { logger } from "../lib/logger";

const router = Router();
router.use(cookieParser());

const SESSION_COOKIE = "story_session";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

/** Resolve the current user's identifier — Clerk userId when signed in, else null */
function getUserId(req: any): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}

/** Read or mint an anonymous session cookie (for unauthenticated users only) */
function getSessionId(req: any, res: any): string {
  let sessionId = req.cookies?.[SESSION_COOKIE];
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

/**
 * Silently migrate legacy anonymous stories to the signed-in user.
 * Called whenever a userId is resolved alongside a sessionId cookie.
 */
async function migrateLegacyStories(userId: string, sessionId: string) {
  try {
    await db
      .update(storiesTable)
      .set({ userId })
      .where(and(eq(storiesTable.sessionId, sessionId), isNull(storiesTable.userId)));
  } catch (e) {
    logger.warn({ err: e }, "Legacy story migration failed (non-fatal)");
  }
}

/**
 * Resolve a stored path/URL to a client-facing URL.
 * New storage: /api/images/<subdir>/<uuid>.png  → returned as-is
 * Legacy storage: <subdir>/<filename>.png       → prefixed with /api/uploads/
 */
function resolveUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("/api/") || stored.startsWith("http")) return stored;
  return `/api/uploads/${stored}`;
}

function storyToResponse(row: typeof storiesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    characterName: row.characterName,
    characterName2: row.characterName2 ?? null,
    relationship: row.relationship,
    theme: row.theme,
    age: row.age,
    emotion: row.emotion,
    outfit: row.outfit ?? null,
    occasion: row.occasion ?? null,
    pageCount: row.pageCount,
    userPrompt: row.userPrompt ?? null,
    coverImageUrl: resolveUrl(row.coverImagePath),
    characterImageUrl: resolveUrl(row.characterImagePath),
    character2ImageUrl: resolveUrl((row as any).character2ImagePath),
    characterVideoUrl: resolveUrl((row as any).characterVideoPath),
    status: row.status,
    generationProgress: row.generationProgress,
    generationStatusMessage: row.generationStatusMessage ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt,
  };
}

function pageToResponse(row: typeof storyPagesTable.$inferSelect) {
  return {
    id: row.id,
    num: row.pageNumber,
    text: row.text ?? null,
    imageUrl: resolveUrl(row.imagePath),
    imagePrompt: row.imagePrompt ?? null,
  };
}

/** Build a where clause matching stories owned by this user */
function ownerFilter(userId: string | null, sessionId?: string) {
  if (userId) return eq(storiesTable.userId, userId);
  if (sessionId) return eq(storiesTable.sessionId, sessionId);
  return eq(storiesTable.sessionId, "__no_match__");
}

// GET /api/stories
router.get("/stories", async (req: any, res: any): Promise<void> => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req, res);
  if (userId) await migrateLegacyStories(userId, sessionId);
  const rows = await db
    .select()
    .from(storiesTable)
    .where(ownerFilter(userId, sessionId))
    .orderBy(desc(storiesTable.createdAt));
  res.json(rows.map(storyToResponse));
});

// POST /api/stories
router.post("/stories", async (req: any, res: any): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to create stories" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  if (!body.title || !body.characterName || !body.relationship || !body.theme || !body.age || !body.emotion || !body.originalPhotoPath) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const id = randomUUID();
  const newStory: typeof storiesTable.$inferInsert = {
    id,
    userId,
    sessionId: userId, // keep sessionId non-null (schema constraint)
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
    characterImagePath: body.characterImagePath ? String(body.characterImagePath) : null,
    characterDescription: body.characterDescription ? String(body.characterDescription) : null,
    character2ImagePath: body.character2ImagePath ? String(body.character2ImagePath) : null,
    character2Description: body.character2Description ? String(body.character2Description) : null,
    status: "pending",
    generationProgress: body.characterImagePath ? 30 : 0,
    generationStatusMessage: body.characterImagePath ? "Character ready! Writing your story..." : null,
  };

  await db.insert(storiesTable).values(newStory);
  const inserted = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });
  res.status(201).json(storyToResponse(inserted!));
});

// GET /api/stories/stats
router.get("/stories/stats", async (req: any, res: any): Promise<void> => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req, res);
  if (userId) await migrateLegacyStories(userId, sessionId);
  const filter = ownerFilter(userId, sessionId);

  const [totals] = await db.select({ total: count() }).from(storiesTable).where(filter);
  const [completed] = await db.select({ total: count() }).from(storiesTable).where(and(filter, eq(storiesTable.status, "complete")));
  const [inProgress] = await db.select({ total: count() }).from(storiesTable).where(and(filter, eq(storiesTable.status, "generating")));
  const recent = await db.select().from(storiesTable).where(filter).orderBy(desc(storiesTable.createdAt)).limit(3);

  res.json({
    totalStories: totals.total,
    completedStories: completed.total,
    inProgressStories: inProgress.total,
    recentStories: recent.map(storyToResponse),
  });
});

// DELETE /api/stories/:id
router.delete("/stories/:id", async (req: any, res: any): Promise<void> => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req, res);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = await db.query.storiesTable.findFirst({
    where: and(eq(storiesTable.id, id), ownerFilter(userId, sessionId)),
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
router.get("/stories/:id/status", async (req: any, res: any): Promise<void> => {
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
    characterImageUrl: story.characterImagePath ? resolveUrl(story.characterImagePath) : null,
    coverImageUrl: story.coverImagePath ? resolveUrl(story.coverImagePath) : null,
    characterVideoUrl: (story as any).characterVideoPath ? resolveUrl((story as any).characterVideoPath) : null,
  });
});

// POST /api/stories/:id/generate
router.post("/stories/:id/generate", async (req: any, res: any): Promise<void> => {
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

  runStoryGeneration(id).catch((err) => {
    logger.error({ storyId: id, err }, "Background generation crashed");
  });

  res.json({ ok: true, message: "Generation started" });
});

// GET /api/stories/:id/reading
router.get("/stories/:id/reading", async (req: any, res: any): Promise<void> => {
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
