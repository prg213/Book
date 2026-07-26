import { logger } from "./logger";
import { uploadImage } from "./imageStorage";
const KLING_BASE = "https://api.klingai.com";

function klingHeaders() {
  const key = process.env.KLING_API_KEY;
  if (!key) throw new Error("KLING_API_KEY not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/**
 * Generates a short waving video using Kling AI image-to-video.
 * Returns the saved relative path (e.g. "videos/xxx.mp4").
 */
export async function generateWavingVideoKling(
  publicImageUrl: string
): Promise<string> {
  // 1. Submit
  const submitRes = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
    method: "POST",
    headers: klingHeaders(),
    body: JSON.stringify({
      model_name: "kling-v1-6",
      image: publicImageUrl,
      prompt:
        "The cartoon character gently waves one arm slowly at the camera. The character has a warm closed-lip smile throughout the entire video. The mouth is completely sealed shut — no speaking, no lip movement, no jaw drop, no talking at all. Eyes stay open and forward-facing. Only the waving arm and hand move gently. Everything else — face expression, body, background — stays perfectly still.",
      negative_prompt:
        "talking, speaking, open mouth, lip movement, lip sync, mouth opening, jaw movement, dialogue, blinking excessively, facial animation, expression change",
      cfg_scale: 0.5,
      mode: "std",
      duration: "5",
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`Kling submit failed ${submitRes.status}: ${body}`);
  }

  const submitData = (await submitRes.json()) as {
    code: number;
    message: string;
    data?: { task_id: string; task_status: string };
  };

  if (submitData.code !== 0) {
    throw new Error(`Kling submit error: ${submitData.message}`);
  }

  const taskId = submitData.data!.task_id;
  logger.info({ taskId }, "Kling waving video submitted");

  // 2. Poll until complete (up to 6 minutes, 5s intervals)
  for (let attempt = 0; attempt < 72; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollRes = await fetch(
      `${KLING_BASE}/v1/videos/image2video/${taskId}`,
      { headers: klingHeaders() }
    );

    if (!pollRes.ok) continue;

    const status = (await pollRes.json()) as {
      code: number;
      data?: {
        task_id: string;
        task_status: string; // "submitted" | "processing" | "succeed" | "failed"
        task_result?: {
          videos?: Array<{ id: string; url: string; duration: string }>;
        };
        task_status_msg?: string;
      };
    };

    logger.info(
      { taskId, status: status.data?.task_status, attempt },
      "Kling poll"
    );

    if (
      status.code === 0 &&
      status.data?.task_status === "succeed" &&
      status.data.task_result?.videos?.[0]?.url
    ) {
      const videoUrl = status.data.task_result.videos[0].url;

      // 3. Download and upload to GCS
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) throw new Error("Failed to download Kling video");
      const buf = Buffer.from(await videoRes.arrayBuffer());

      const servingUrl = await uploadImage(buf, "videos", "mp4");
      logger.info({ servingUrl }, "Kling waving video saved to GCS");
      return servingUrl;
    }

    if (status.data?.task_status === "failed") {
      throw new Error(
        `Kling generation failed: ${status.data.task_status_msg ?? "unknown"}`
      );
    }
  }

  throw new Error("Kling video generation timed out after 6 minutes");
}
