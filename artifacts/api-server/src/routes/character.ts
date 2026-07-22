import { Router } from "express";
import { analyzePhoto, generateImage } from "../lib/grok";
import { logger } from "../lib/logger";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

const uploadsDir = path.resolve(process.cwd(), "uploads");

async function saveImage(buf: Buffer, subdir: string): Promise<string> {
  const dir = path.join(uploadsDir, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, buf);
  return path.join(subdir, filename);
}

const router = Router();

/**
 * POST /api/generate-character
 * Analyzes an uploaded photo and generates a 3D cartoon character.
 * Called during the story creation wizard (Step 1) so the user can preview
 * the character before filling in story details.
 */
router.post("/generate-character", async (req, res): Promise<void> => {
  const { photoPath } = req.body as { photoPath?: string };

  if (!photoPath) {
    res.status(400).json({ error: "photoPath is required" });
    return;
  }

  const fullPhotoPath = path.join(uploadsDir, photoPath);
  logger.info({ photoPath }, "Starting character generation");

  try {
    // Step 1: Analyse the photo with Grok vision
    const characterDescription = await analyzePhoto(fullPhotoPath);
    logger.info({ photoPath }, "Photo analysis complete");

    // Step 2: Generate the 3D character illustration
    const charPrompt = buildCharacterPrompt(characterDescription);
    const imgBuf = await generateImage(charPrompt);
    const characterImagePath = await saveImage(imgBuf, "characters");

    logger.info({ photoPath, characterImagePath }, "Character generation complete");

    res.json({
      characterImagePath,
      characterImageUrl: `/api/uploads/${characterImagePath}`,
      characterDescription,
    });
  } catch (err) {
    logger.error({ photoPath, err }, "Character generation failed");
    const msg = err instanceof Error ? err.message : "Character generation failed";
    res.status(500).json({ error: msg });
  }
});

function buildCharacterPrompt(description: string): string {
  return `GENERATE IMAGE: A single 3D animated cartoon character in a Pixar / Disney animated movie style, standing on a clean white background.

CHARACTER APPEARANCE — reproduce ALL of the following EXACTLY:
${description}

FAITHFULNESS RULES:
- Hair: match exact color, length, texture, and style (pigtails, braids, bangs, length — reproduce precisely)
- Eyes: match exact eye color
- Skin tone: match as described
- Outfit: reproduce EVERY clothing item with exact colors and patterns (shirt, trousers/skirt, shoes, outerwear, accessories) — do NOT simplify or omit anything
- Accessories: include every accessory exactly as described

CARTOON STYLE:
- Chibi / Pixar proportions: large expressive head, compact rounded body
- Big round sparkly cartoon eyes
- Smooth, soft, rounded facial features with a warm friendly expression
- High-quality 3D render, vibrant saturated colors, soft cel-shading
- Slight friendly smile

FRAMING:
- Full body visible from head to toe
- Standing upright, arms relaxed at sides
- Perfectly centered in frame
- Pure white background only — no shadows, no scenery, no gradients

CRITICAL: No text, no logos, no brand names, no watermarks.
CRITICAL: Square 1:1 aspect ratio.`;
}

export { buildCharacterPrompt };
export default router;
