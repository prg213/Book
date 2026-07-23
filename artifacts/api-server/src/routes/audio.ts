import { Router } from "express";
import express from "express";
import path from "path";
import { mkdir, writeFile, readFile, unlink, access } from "fs/promises";
import { logger } from "../lib/logger";

const router = Router();
const uploadsDir = path.resolve(process.cwd(), "uploads");

function audioDir(storyId: string) {
  return path.join(uploadsDir, "audio", storyId);
}

function audioPath(storyId: string, key: string) {
  return path.join(audioDir(storyId), key);
}

function mimePath(storyId: string, key: string) {
  return path.join(audioDir(storyId), `${key}.mime`);
}

function safeKey(k: string) {
  return /^[a-z0-9-]{1,40}$/.test(k);
}

/** HEAD /api/audio/:storyId/:key — check existence */
router.head("/audio/:storyId/:key", async (req, res) => {
  const { storyId, key } = req.params;
  if (!safeKey(key)) { res.sendStatus(400); return; }
  try {
    await access(audioPath(storyId, key));
    res.sendStatus(200);
  } catch {
    res.sendStatus(404);
  }
});

/** GET /api/audio/:storyId/:key — serve audio */
router.get("/audio/:storyId/:key", async (req, res) => {
  const { storyId, key } = req.params;
  if (!safeKey(key)) { res.sendStatus(400); return; }
  const aPath = audioPath(storyId, key);
  try {
    const buf = await readFile(aPath);
    let mimeType = "audio/webm";
    try { mimeType = (await readFile(mimePath(storyId, key), "utf8")).trim(); } catch { /* use default */ }
    res.set("Content-Type", mimeType);
    res.set("Cache-Control", "no-store");
    res.send(buf);
  } catch {
    res.sendStatus(404);
  }
});

/** POST /api/audio/:storyId/:key — save audio blob */
router.post(
  "/audio/:storyId/:key",
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req, res) => {
    const { storyId, key } = req.params;
    if (!safeKey(key)) { res.sendStatus(400); return; }
    const buf = req.body as Buffer;
    if (!buf || !buf.length) { res.status(400).json({ error: "Empty body" }); return; }
    const mimeType = (req.headers["content-type"] || "audio/webm").split(";")[0].trim();
    try {
      await mkdir(audioDir(storyId), { recursive: true });
      await writeFile(audioPath(storyId, key), buf);
      await writeFile(mimePath(storyId, key), mimeType, "utf8");
      logger.info({ storyId, key, bytes: buf.length, mimeType }, "Audio saved");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to save audio");
      res.status(500).json({ error: "Failed to save" });
    }
  },
);

/** DELETE /api/audio/:storyId/:key — remove audio */
router.delete("/audio/:storyId/:key", async (req, res) => {
  const { storyId, key } = req.params;
  if (!safeKey(key)) { res.sendStatus(400); return; }
  await Promise.all([
    unlink(audioPath(storyId, key)).catch(() => {}),
    unlink(mimePath(storyId, key)).catch(() => {}),
  ]);
  res.json({ ok: true });
});

export default router;
