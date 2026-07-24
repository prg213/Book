import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, storiesTable } from "@workspace/db";
import { generateWavingVideoKling } from "../lib/kling";
import { logger } from "../lib/logger";

const router = Router();

/** POST /api/stories/:id/generate-video — manually trigger waving video for a story */
router.post("/stories/:id/generate-video", async (req, res) => {
  const { id } = req.params;
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, id) });
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (!story.coverImagePath) return res.status(400).json({ error: "Story has no cover image" });

  res.json({ ok: true, message: "Video generation started" });

  // Run async after response
  (async () => {
    try {
      const domain = process.env.REPLIT_DEV_DOMAIN;
      const publicUrl = `https://${domain}/api/uploads/${story.coverImagePath}`;
      logger.info({ storyId: id, publicUrl }, "Manual waving video trigger");
      const videoPath = await generateWavingVideoKling(publicUrl);
      await db.update(storiesTable).set({ characterVideoPath: videoPath }).where(eq(storiesTable.id, id));
      logger.info({ storyId: id, videoPath }, "Manual waving video saved");
    } catch (e) {
      logger.error({ storyId: id, err: e }, "Manual waving video failed");
    }
  })();
});

export default router;
