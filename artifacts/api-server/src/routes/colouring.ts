import { Router } from "express";
import path from "path";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import { createHash } from "crypto";
import sharp from "sharp";
import { generateColouringPage } from "../lib/grok";
import { logger } from "../lib/logger";

// A5 at 150 dpi — good quality, fast to render
const A5_W = 1240;
const A5_H = 1754; // 1240 × (210/148)

/**
 * Letterbox a square (or any) image onto a white A5 canvas.
 * Image is scaled to fill the full width and centred vertically,
 * leaving white margins top and bottom.
 */
async function toA5(inputBuf: Buffer): Promise<Buffer> {
  const meta = await sharp(inputBuf).metadata();
  const srcW = meta.width ?? 1024;
  const srcH = meta.height ?? 1024;

  // Scale to fit full width of A5 canvas
  const scale = A5_W / srcW;
  const scaledW = A5_W;
  const scaledH = Math.round(srcH * scale);

  const resized = await sharp(inputBuf)
    .resize(scaledW, scaledH, { fit: "fill" })
    .toBuffer();

  const top = Math.max(0, Math.round((A5_H - scaledH) / 2));

  return sharp({
    create: {
      width: A5_W,
      height: A5_H,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, top, left: 0 }])
    .png({ compressionLevel: 8 })
    .toBuffer();
}

const router = Router();
const uploadsDir = path.resolve(process.cwd(), "uploads");

/**
 * POST /api/colouring-page
 * Body: { imageUrl: string }   e.g. "/api/uploads/covers/12345.png"
 * Returns: { colouringUrl: string }
 *
 * Results are cached on disk under uploads/colouring/ keyed by a hash of
 * the source path, so repeated requests are instant.
 */
router.post("/colouring-page", async (req, res) => {
  try {
    const { imageUrl } = req.body as { imageUrl?: string };
    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({ error: "imageUrl is required" });
      return;
    }

    // Strip the leading /api/uploads/ prefix to get the relative file path
    const prefix = "/api/uploads/";
    if (!imageUrl.startsWith(prefix)) {
      res.status(400).json({ error: "imageUrl must start with /api/uploads/" });
      return;
    }
    const relPath = imageUrl.slice(prefix.length);
    const absPath = path.join(uploadsDir, relPath);

    // ── Cache check ────────────────────────────────────────────────────────
    const hash = createHash("sha1").update(relPath).digest("hex").slice(0, 16);
    const cacheDir = path.join(uploadsDir, "colouring");
    const cacheFile = path.join(cacheDir, `${hash}.png`);
    const cacheRelPath = `colouring/${hash}.png`;

    try {
      await access(cacheFile);
      // Cache hit
      logger.info({ cacheFile }, "Coloring page cache hit");
      res.json({ colouringUrl: `/api/uploads/${cacheRelPath}` });
      return;
    } catch {
      // Cache miss — generate
    }

    // ── Read source image ─────────────────────────────────────────────────
    let sourceBuf: Buffer;
    try {
      sourceBuf = await readFile(absPath);
    } catch {
      res.status(404).json({ error: `Source image not found: ${relPath}` });
      return;
    }

    // ── Generate via xAI ──────────────────────────────────────────────────
    logger.info({ relPath }, "Generating coloring page");
    const colouringBuf = await generateColouringPage(sourceBuf);

    // ── Letterbox to A5 portrait ───────────────────────────────────────────
    const a5Buf = await toA5(colouringBuf);

    // ── Save to cache ──────────────────────────────────────────────────────
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, a5Buf);

    res.json({ colouringUrl: `/api/uploads/${cacheRelPath}` });
  } catch (err) {
    logger.error({ err }, "Coloring page generation failed");
    res.status(500).json({ error: "Failed to generate coloring page" });
  }
});

export default router;
