/**
 * GET /api/images/:subdir/:filename
 * Streams a GCS-stored story image (cover, page, character, coloring, video…)
 * back to the client.  Images are immutably cached: the filename embeds a UUID
 * so the content never changes, and Cache-Control is set accordingly.
 */
import { Router } from "express";
import { streamImage } from "../lib/imageStorage";
import { logger } from "../lib/logger";

const router = Router();

router.get("/images/:subdir/:filename", async (req, res): Promise<void> => {
  try {
    await streamImage(req.params.subdir, req.params.filename, res);
  } catch (err) {
    logger.error({ err, params: req.params }, "images route: unexpected error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
