import { Router } from "express";
import { createHash } from "crypto";
import { generateColouringPage } from "../lib/grok";
import { logger } from "../lib/logger";
import { uploadImage, fetchImageBuffer } from "../lib/imageStorage";
import { objectStorageClient } from "../lib/objectStorage";
import { toA5Master } from "../lib/a5";

/** Check whether a coloring-page result is already cached in GCS. */
async function getCachedColouringUrl(hash: string): Promise<string | null> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return null;
  const objectPath = `story-images/colouring/${hash}.png`;
  const bucket = objectStorageClient.bucket(bucketId);
  const [exists] = await bucket.file(objectPath).exists();
  return exists ? `/api/images/colouring/${hash}.png` : null;
}

const router = Router();

/**
 * POST /api/colouring-page
 * Body: { imageUrl: string }   — any /api/images/... or /api/uploads/... URL
 * Returns: { colouringUrl: string }
 *
 * Results are cached in GCS keyed by a hash of the source URL, so repeated
 * requests are instant.
 */
router.post("/colouring-page", async (req, res) => {
  try {
    const { imageUrl } = req.body as { imageUrl?: string };
    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({ error: "imageUrl is required" });
      return;
    }

    // Cache key: hash of the normalised source URL
    const hash = createHash("sha1").update(imageUrl).digest("hex").slice(0, 16);

    // ── GCS cache check ────────────────────────────────────────────────────
    const cached = await getCachedColouringUrl(hash);
    if (cached) {
      logger.info({ hash }, "Coloring page GCS cache hit");
      res.json({ colouringUrl: cached });
      return;
    }

    // ── Fetch source image via HTTP ────────────────────────────────────────
    let sourceBuf: Buffer;
    try {
      sourceBuf = await fetchImageBuffer(imageUrl);
    } catch (err) {
      logger.error({ imageUrl, err }, "Failed to fetch source image for coloring");
      res.status(404).json({ error: "Source image not accessible" });
      return;
    }

    // ── Generate via xAI ──────────────────────────────────────────────────
    logger.info({ imageUrl, hash }, "Generating coloring page");
    const colouringBuf = await generateColouringPage(sourceBuf);
    const a5Buf = await toA5Master(colouringBuf);

    // ── Upload to GCS using the stable hash as the filename ────────────────
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
    const objectPath = `story-images/colouring/${hash}.png`;
    await objectStorageClient.bucket(bucketId).file(objectPath).save(a5Buf, {
      contentType: "image/png",
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
    const colouringUrl = `/api/images/colouring/${hash}.png`;

    res.json({ colouringUrl });
  } catch (err) {
    logger.error({ err }, "Coloring page generation failed");
    res.status(500).json({ error: "Failed to generate coloring page" });
  }
});

export default router;
