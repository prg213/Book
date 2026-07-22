import { logger } from "./logger";

const XAI_BASE = "https://api.x.ai/v1";

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY environment variable is not set. Please add your xAI API key.");
  return key;
}

/** Convert a local file path to a base64 data URL for vision APIs */
export async function fileToBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
  const { readFile } = await import("fs/promises");
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const buf = await readFile(filePath);
  return { base64: buf.toString("base64"), mimeType };
}

/** Analyze a photo using Grok vision and return a character description */
export async function analyzePhoto(filePath: string): Promise<string> {
  const { base64, mimeType } = await fileToBase64(filePath);

  const resp = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-2-vision-1212",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
            },
            {
              type: "text",
              text: `Analyze this photo and write a vivid, precise description for an AI image generator to recreate this subject as a 3D animated children's book character. Include: hair color, hair style, eye color, skin tone, approximate age appearance (toddler/child/adult), notable facial features, and any distinctive characteristics. If this is an animal or pet, describe species, fur/coat color and pattern, size, and any distinctive markings. Be specific — this description will be used to maintain character consistency across many illustrations.`,
            },
          ],
        },
      ],
      max_tokens: 400,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Grok vision error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

/** Generate story text using Grok-3 */
export async function generateStoryText(prompt: string): Promise<{
  pages: Array<{ page_number: number; text: string; image_prompt: string }>;
}> {
  const resp = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-3",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Grok-3 text error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0].message.content;
  try {
    return JSON.parse(content) as {
      pages: Array<{ page_number: number; text: string; image_prompt: string }>;
    };
  } catch {
    throw new Error(`Failed to parse story JSON: ${content.slice(0, 200)}`);
  }
}

/** Generate an image using xAI Aurora (grok-2-image) and return the image bytes */
export async function generateImage(prompt: string): Promise<Buffer> {
  logger.info({ promptLength: prompt.length }, "Generating image with Aurora");

  const resp = await fetch(`${XAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-2-image-1212",
      prompt,
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Aurora image error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as { data: Array<{ b64_json?: string; url?: string }> };
  const item = data.data[0];

  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item.url) {
    const imgResp = await fetch(item.url);
    const buf = await imgResp.arrayBuffer();
    return Buffer.from(buf);
  }

  throw new Error("No image data in Aurora response");
}
