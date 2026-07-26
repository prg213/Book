import { logger } from "./logger";
import { uploadImage } from "./imageStorage";
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
        "A still cartoon illustration gently animates. The image is like a painting coming to life — the only thing that moves is one arm waving slowly and gently side to side. The character's face is completely frozen like a painted mask: eyes stay wide open looking directly forward the entire time, no blinking at any point, eyelids do not move. The mouth is sealed shut in a gentle closed-lip smile and does not move a single pixel — no lip movement, no jaw drop, no talking, no mouthing. The expression on the face does not change at all from the first frame to the last. Think of it as animating only the arm of a flat 2D cartoon drawing. Everything else — face, background, text, body — is perfectly still.",
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
      // 3. Download and upload to GCS
      const videoRes = await fetch(status.output[0].url);
      if (!videoRes.ok) throw new Error("Failed to download Luma video");
      const buf = Buffer.from(await videoRes.arrayBuffer());

      const servingUrl = await uploadImage(buf, "videos", "mp4");
      logger.info({ servingUrl }, "Luma waving video saved to GCS");
      return servingUrl;
    }

    if (status.state === "failed") {
      throw new Error(
        `Luma generation failed: ${status.failure_reason ?? status.failure_code ?? "unknown"}`
      );
    }
  }

  throw new Error("Luma video generation timed out after 5 minutes");
}
