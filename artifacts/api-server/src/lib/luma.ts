import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { logger } from "./logger";

const uploadsDir = path.resolve(process.cwd(), "uploads");
const LUMA_BASE = "https://api.lumalabs.ai/dream-machine/v1";

function lumaHeaders() {
  const key = process.env.LUMALABS_API_KEY;
  if (!key) throw new Error("LUMALABS_API_KEY not set");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

/**
 * Takes a publicly-accessible character image URL and generates a short
 * looping video of the character waving at the camera via Luma Dream Machine.
 * Returns the saved relative path (e.g. "videos/xxx.mp4").
 */
export async function generateWavingVideo(publicCharacterImageUrl: string): Promise<string> {
  // 1. Submit generation request
  const submitRes = await fetch(`${LUMA_BASE}/generations/video`, {
    method: "POST",
    headers: lumaHeaders(),
    body: JSON.stringify({
      prompt:
        "The cute 3D cartoon character raises one arm and waves cheerfully at the camera with a big warm friendly smile, smooth looping wave motion, white background",
      keyframes: { frame0: { type: "image", url: publicCharacterImageUrl } },
      duration: "short", // ~3 seconds
      loop: true,
      aspect_ratio: "1:1",
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`Luma submit failed ${submitRes.status}: ${body}`);
  }

  const gen = (await submitRes.json()) as { id: string };
  logger.info({ id: gen.id }, "Luma waving video submitted");

  // 2. Poll until complete (up to ~4 minutes, 4-second intervals)
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));

    const pollRes = await fetch(`${LUMA_BASE}/generations/${gen.id}`, {
      headers: lumaHeaders(),
    });
    if (!pollRes.ok) continue;

    const status = (await pollRes.json()) as {
      state: string;
      assets?: { video?: string };
      failure_reason?: string;
    };

    logger.info({ id: gen.id, state: status.state, attempt }, "Luma poll");

    if (status.state === "completed" && status.assets?.video) {
      // 3. Download the video
      const videoRes = await fetch(status.assets.video);
      if (!videoRes.ok) throw new Error("Failed to download Luma video");
      const buf = Buffer.from(await videoRes.arrayBuffer());

      const dir = path.join(uploadsDir, "videos");
      await mkdir(dir, { recursive: true });
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      await writeFile(path.join(dir, filename), buf);

      const relativePath = `videos/${filename}`;
      logger.info({ relativePath }, "Luma waving video saved");
      return relativePath;
    }

    if (status.state === "failed") {
      throw new Error(`Luma generation failed: ${status.failure_reason ?? "unknown"}`);
    }
  }

  throw new Error("Luma video generation timed out after 4 minutes");
}
