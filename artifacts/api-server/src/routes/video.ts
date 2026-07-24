import { Router } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { generateWavingVideoKling } from "../lib/kling";
import { buildPagePrompt, saveImage } from "../lib/generation";
import { generateImage } from "../lib/grok";
import { logger } from "../lib/logger";

const router = Router();

/** POST /api/stories/:id/generate-video — manually trigger waving video for a story */
router.post("/stories/:id/generate-video", async (req, res) => {
  const { id } = req.params;
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });
  if (!story) return res.status(404).json({ error: "Story not found" });
  const imagePath = (story as any).characterImagePath || story.coverImagePath;
  if (!imagePath) return res.status(400).json({ error: "Story has no character or cover image" });

  res.json({ ok: true, message: "Video generation started" });

  // Run async after response
  (async () => {
    try {
      const domain = process.env.REPLIT_DEV_DOMAIN;
      const publicUrl = `https://${domain}/api/uploads/${imagePath}`;
      logger.info({ storyId: id, publicUrl }, "Manual waving video trigger");
      const videoPath = await generateWavingVideoKling(publicUrl);
      await db.update(storiesTable).set({ characterVideoPath: videoPath }).where(eq(storiesTable.id, id));
      logger.info({ storyId: id, videoPath }, "Manual waving video saved");
    } catch (e) {
      logger.error({ storyId: id, err: e }, "Manual waving video failed");
    }
  })();
});

/** POST /api/stories/:id/regenerate-missing-pages — regenerate any pages missing an illustration */
router.post("/stories/:id/regenerate-missing-pages", async (req, res) => {
  const { id } = req.params;
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });
  if (!story) return res.status(404).json({ error: "Story not found" });

  const allPages = await db.query.storyPagesTable.findMany({
    where: eq(storyPagesTable.storyId, id),
    orderBy: (t, { asc }) => [asc(t.pageNumber)],
  });

  const missing = allPages.filter((p) => !p.imagePath);
  if (missing.length === 0) return res.json({ ok: true, message: "No missing pages" });

  res.json({ ok: true, message: `Regenerating ${missing.length} missing page(s)`, pages: missing.map((p) => p.pageNumber) });

  // Run async after response
  (async () => {
    const characterDesc = story.characterDescription ?? "";
    const lockedOutfitDesc = story.lockedOutfitDesc ?? null;

    for (const page of missing) {
      try {
        logger.info({ storyId: id, pageNumber: page.pageNumber }, "Regenerating missing page illustration");
        const pageIndex = page.pageNumber - 1;

        // Sanitize image_prompt to remove words known to trigger Aurora content moderation
        const safeImagePrompt = (page.imagePrompt ?? "")
          .replace(/\bwolf\b/gi, "large friendly forest creature")
          .replace(/\bwolves\b/gi, "large friendly forest creatures")
          .replace(/\bwitch\b/gi, "mysterious old woman")
          .replace(/\bgiant\b/gi, "very tall friendly giant");

        const prompt = buildPagePrompt(
          story,
          { text: page.text ?? "", image_prompt: safeImagePrompt },
          characterDesc,
          pageIndex,
          undefined,
          lockedOutfitDesc,
        );

        let imgBuf: Buffer;
        try {
          imgBuf = await generateImage(prompt);
        } catch (moderationErr: any) {
          if (moderationErr?.message?.includes("content-moderated")) {
            // Retry with a fully generic scene description stripped of all fairy-tale context
            logger.warn({ storyId: id, pageNumber: page.pageNumber }, "Content moderated — retrying with minimal prompt");
            const minimalPrompt = buildPagePrompt(
              { ...story, theme: "enchanted forest", customTheme: null } as any,
              { text: "", image_prompt: safeImagePrompt },
              characterDesc,
              pageIndex,
              undefined,
              lockedOutfitDesc,
            );
            imgBuf = await generateImage(minimalPrompt);
          } else {
            throw moderationErr;
          }
        }

        const imagePath = await saveImage(imgBuf, "pages");
        await db.update(storyPagesTable)
          .set({ imagePath })
          .where(eq(storyPagesTable.id, page.id));
        logger.info({ storyId: id, pageNumber: page.pageNumber, imagePath }, "Missing page regenerated");
      } catch (e) {
        logger.error({ storyId: id, pageNumber: page.pageNumber, err: e }, "Failed to regenerate page");
      }
    }
    logger.info({ storyId: id }, "Missing page regeneration complete");
  })();
});

export default router;
