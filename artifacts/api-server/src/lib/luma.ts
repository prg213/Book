import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { logger } from "./logger";

const uploadsDir = path.resolve(process.cwd(), "uploads");
const LUMA_BASE = "https://agents.lumalabs.ai/v1";

function lumaHeaders() {
  const key = process.env.LUMALABS_API_KEY;
  if (!key) throw new Error("LUMALABS_API_KEY not set");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

/**
 * Takes a publicly-accessible character image URL and generates a short
 * video of the character waving via Luma Ray 3.2 (Agents API).
 * Returns the saved relative path (e.g. "videos/xxx.mp4").
 */
export async function generateWavingVideo(publicCharacterImageUrl: string): Promise<string> {
  // 1. Submit generation request
  const submitRes = await fetch(`${LUMA_BASE}/generations`, {
    method: "POST",
    headers: lumaHeaders(),
    body: JSON.stringify({
      model: "ray-3.2",
      type: "video",
      prompt:
        "MOUTH COMPLETELY CLOSED the entire video — frozen in a gentle smile, zero lip movement, zero jaw movement, no speaking, no talking, no mouthing words. The face is completely still except for the smile expression which does not change at all. The character raises one arm and waves slowly at the camera. The background, text, and all other elements are completely static. ONLY the waving arm moves. Mouth stays sealed shut for every single frame.",
      aspect_ratio: "1:1",
      video: {
        resolution: "540p",
        duration: "5s",
        start_frame: { url: publicCharacterImageUrl },
      },
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`Luma submit failed ${submitRes.status}: ${body}`);
  }

  const gen = (await submitRes.json()) as { id: string };
  logger.info({ id: gen.id }, "Luma waving video submitted");

  // 2. Poll until complete (up to ~5 minutes, 5-second intervals)
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollRes = await fetch(`${LUMA_BASE}/generations/${gen.id}`, {
      headers: lumaHeaders(),
    });
    if (!pollRes.ok) continue;

    const status = (await pollRes.json()) as {
      state: string;
      output?: Array<{ url: string }>;
      failure_reason?: string;
      failure_code?: string;
    };

    logger.info({ id: gen.id, state: status.state, attempt }, "Luma poll");

    if (status.state === "completed" && status.output?.[0]?.url) {
      // 3. Download the video
      const videoRes = await fetch(status.output[0].url);
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
      throw new Error(
        `Luma generation failed: ${status.failure_reason ?? status.failure_code ?? "unknown"}`
      );
    }
  }

  throw new Error("Luma video generation timed out after 5 minutes");
}
