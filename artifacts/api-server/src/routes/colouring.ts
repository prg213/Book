import { Router } from "express";
import path from "path";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import { createHash } from "crypto";
import { generateColouringPage } from "../lib/grok";
import { logger } from "../lib/logger";

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

    // ── Save to cache ──────────────────────────────────────────────────────
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, colouringBuf);

    res.json({ colouringUrl: `/api/uploads/${cacheRelPath}` });
  } catch (err) {
    logger.error({ err }, "Coloring page generation failed");
    res.status(500).json({ error: "Failed to generate coloring page" });
  }
});

export default router;
