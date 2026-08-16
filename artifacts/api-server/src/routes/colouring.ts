import { Router } from "express";
import { createHash } from "crypto";
import sharp from "sharp";
import { generateColouringPage } from "../lib/grok";
import { logger } from "../lib/logger";
import { uploadImage, fetchImageBuffer } from "../lib/imageStorage";
import { objectStorageClient } from "../lib/objectStorage";

// 300 DPI A5 portrait: 148 mm × (300 / 25.4) ≈ 1748 px wide
//                      210 mm × (300 / 25.4) ≈ 2480 px tall
const A5_W   = 1748;
const A5_H   = 2480;
const A5_DPI = 300;

/**
 * Sample the mean brightness (0–255) of the full image.
 * A very high value (>220) means the image is predominantly white/near-white —
 * typical of coloring-page line art.
 */
async function meanBrightness(buf: Buffer): Promise<number> {
  const { channels } = await sharp(buf).stats();
  return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
}

/**
 * Convert a source image (typically ~1024×1024 square AI output) into a
 * professional A5 portrait master at 300 DPI (1748 × 2480 px).
 *
 * Rules:
 *  - NEVER stretch, squash, or distort the artwork.
 *  - NEVER crop any part of the character, head, feet, hands, or key elements.
 *  - Preserve the complete original artwork at its natural aspect ratio.
 *
 * Extension strategy (chosen automatically):
 *
 *  WHITE / near-white background (coloring pages, character sheets):
 *    → Scale to fit full A5 width (1748 px), centre vertically, fill gaps with
 *      solid white.  Perfect and lossless for line-art on white.
 *
 *  COMPLEX / scene background (colour illustrations):
 *    → Scale artwork to fill the full A5 width (1748 px), preserving aspect ratio.
 *    → Mirror-extend the top and bottom edges to fill the remaining canvas height.
 *      This seamlessly continues sky/ground/scene elements without AI calls and
 *      without touching the artwork itself.
 *
 * For a 1024×1024 square input the geometry is:
 *   • Scaled artwork  : 1748 × 1748 px  (fills full width)
 *   • Top/bottom pad  :  366 px each     (2480 − 1748 = 732 ÷ 2)
 *   • No side padding :  0 px            (artwork uses full 1748 px width)
 */
async function toA5Master(inputBuf: Buffer): Promise<Buffer> {
  // ── 1. Flatten alpha channel to white ────────────────────────────────────
  const flat = await sharp(inputBuf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  // ── 2. Detect background type ─────────────────────────────────────────────
  const brightness = await meanBrightness(flat);
  const isLightBg  = brightness > 220; // near-white → simple fill

  // ── 3a. White/light background — contain + white fill (simple path) ───────
  if (isLightBg) {
    return sharp(flat)
      .resize(A5_W, A5_H, {
        fit:        "contain",
        position:   "centre",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .withMetadata({ density: A5_DPI })
      .png({ compressionLevel: 8 })
      .toBuffer();
  }

  // ── 3b. Complex background — scale to full width, mirror-extend top/bottom ─
  const { width: srcW, height: srcH } = await sharp(flat).metadata();
  const scaledH = Math.round(A5_W * (srcH ?? A5_W) / (srcW ?? A5_W));

  // Safety: if the artwork is already taller than A5 at full width, fall back
  // to contain so we never crop.
  if (scaledH >= A5_H) {
    return sharp(flat)
      .resize(A5_W, A5_H, {
        fit:        "contain",
        position:   "centre",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .withMetadata({ density: A5_DPI })
      .png({ compressionLevel: 8 })
      .toBuffer();
  }

  const topPad    = Math.floor((A5_H - scaledH) / 2);
  const bottomPad = A5_H - scaledH - topPad;

  // Scale artwork to exactly A5 width, maintaining natural height
  const scaled = await sharp(flat)
    .resize(A5_W, scaledH, { fit: "fill" }) // exact pixel resize — no crop
    .png()
    .toBuffer();

  // Mirror-extend top and bottom to fill the remaining A5 canvas height.
  // libvips mirrors edge pixels outward, continuing the scene content naturally.
  return sharp(scaled)
    .extend({
      top:        topPad,
      bottom:     bottomPad,
      left:       0,
      right:      0,
      extendWith: "mirror",
    })
    .withMetadata({ density: A5_DPI })
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
