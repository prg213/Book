import { Router } from "express";
import { createHash } from "crypto";
import sharp from "sharp";
import { generateColouringPage } from "../lib/grok";
import { logger } from "../lib/logger";
import { uploadImage, fetchImageBuffer } from "../lib/imageStorage";
import { objectStorageClient } from "../lib/objectStorage";

// A5 at ~213 dpi (1240 px ÷ 148 mm × 25.4 = 212.7 dpi)
const A5_W = 1240;
const A5_H = 1754; // 1240 × (210/148)

/**
 * Place the source image (any aspect ratio, typically 1:1 square) onto an
 * A5 portrait canvas WITHOUT cropping.
 *
 * Strategy: scale-to-fit (contain) so the complete artwork is always visible,
 * then pad the remaining space with solid white.  For a square input this
 * produces white bands at the top and bottom — the image occupies the full
 * 1240 px width and is centred vertically.
 *
 * NEVER use fit:"cover" here — that would centre-crop the sides off a square
 * image and destroy the character/scene composition.
 */
async function toA5(inputBuf: Buffer): Promise<Buffer> {
  return sharp(inputBuf)
    // Flatten any alpha channel to white before resizing so transparent pixels
    // don't appear as black in the final PNG.
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(A5_W, A5_H, {
      fit: "contain",           // scale down to fit — never crop
      position: "centre",       // centre within the canvas
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // white padding
    })
    .png({ compressionLevel: 8 })
    .toBuffer();
}

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
    const a5Buf = await toA5(colouringBuf);

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
