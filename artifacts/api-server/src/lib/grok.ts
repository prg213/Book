import { logger } from "./logger";

const XAI_BASE = "https://api.x.ai/v1";

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY environment variable is not set. Please add your xAI API key.");
  return key;
}

export async function fileToBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
  const { readFile } = await import("fs/promises");
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const buf = await readFile(filePath);
  return { base64: buf.toString("base64"), mimeType };
}

/**
 * Analyse a photo using Grok vision.
 * Returns a very detailed, structured description capturing exact hair, outfit,
 * accessories and features — enough to recreate the person as a cartoon character.
 */
export async function analyzePhoto(filePath: string): Promise<string> {
  const { base64, mimeType } = await fileToBase64(filePath);

  const resp = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
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
              text: `Analyse this photo to capture ONLY this person's physical appearance — so an AI image generator can recreate them as a 3D cartoon character across many different scenes and poses.

IMPORTANT: Do NOT describe body pose, posture, stance, arm position, hand position, or what the person is doing. Do NOT mention age, how old someone looks, or use words like "child", "kid", "boy", "girl", "young", "adult". Only describe physical appearance features.

Write a single dense paragraph covering ALL of the following in this order:

BUILD: Body build (slender, stocky, petite, tall, compact, etc.) and approximate height relative to surroundings if visible.

HAIR: Exact color (e.g. "golden blonde", "dark chestnut brown", not just "blonde"), exact length (e.g. "falls just below the shoulders", "mid-back length"), texture (straight, wavy, curly, coily), and precise style (e.g. "worn in two low pigtails secured with small pink hair ties and wispy face-framing pieces", "loose with blunt cut bangs", "short pixie cut"). Note any highlights or color variations.

EYES: Exact color (e.g. "bright cornflower blue", "warm hazel with green flecks", "deep brown"). Note if they are large or small relative to face.

SKIN: Exact tone (e.g. "fair skin with rosy cheeks and light freckles across the nose", "warm medium tan", "rich deep brown").

FACE: Distinctive features (dimples, prominent cheeks, etc.), face shape.

OUTFIT — list EVERY visible item:
- Top: exact color(s), pattern, type (e.g. "sleeveless light pink tank top with small ruffle trim at the neckline")
- Bottom: exact color(s), pattern, type (e.g. "a floral mini skirt in navy, white and coral with small flower print")
- Outerwear: (e.g. "open white long-sleeve cardigan/blazer", or "none")
- Shoes: exact type and color (e.g. "white croc-style sandals with chunky sole")
- ALL accessories: hair ties, clips, bows, glasses, necklaces, bracelets, bags, hats — describe color and position

Begin the description with build, then flow through hair, eyes, skin, face, outfit, and accessories in that order. Be precise, not general. Write as a single paragraph. Do NOT mention age, gender words, or what the person is doing.`,
            },
          ],
        },
      ],
      max_tokens: 600,
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
      model: "grok-4.5",
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

const COLOURING_PROMPT =
  "Transform this image into a kid-friendly black and white coloring page. " +
  "Create bold, smooth, and clear black outlines only. Remove every color, shadow, and fill. " +
  "Make the background completely white. Keep the same scene, characters, poses, and details " +
  "from the original image, but simplify it into simple, thick line art perfect for children to color.";

/**
 * Transform an existing image into a children's coloring-page (black & white line art)
 * using xAI Aurora's image-edit endpoint.
 */
export async function generateColouringPage(imageBuffer: Buffer): Promise<Buffer> {
  logger.info({ bytes: imageBuffer.length }, "Generating coloring page with Aurora image edit");

  const resp = await fetch(`${XAI_BASE}/images/edits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image",
      prompt: COLOURING_PROMPT,
      n: 1,
      response_format: "b64_json",
      image: { url: `data:image/png;base64,${imageBuffer.toString("base64")}` },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Aurora image edit error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as { data: Array<{ b64_json?: string; url?: string }> };
  const item = data.data[0];

  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const r = await fetch(item.url);
    return Buffer.from(await r.arrayBuffer());
  }

  throw new Error("No image data in Aurora coloring-page response");
}

/** Generate an image using xAI Aurora and return the image bytes */
export async function generateImage(prompt: string): Promise<Buffer> {
  logger.info({ promptLength: prompt.length }, "Generating image with Aurora");

  const resp = await fetch(`${XAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image",
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
