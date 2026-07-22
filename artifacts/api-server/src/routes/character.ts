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
  return `GENERATE IMAGE: Transform this person into a 3D animated cartoon character in a friendly, child-appropriate animated style.

PERSON TO RECREATE — match these features EXACTLY:
${description}

CRITICAL RULES — REPRODUCE FAITHFULLY:
- Hair: match the exact color, length, and style described above (same pigtails, braids, length, bangs, etc.)
- Eyes: match the exact eye color described
- Outfit: reproduce EVERY clothing item with exact colors and patterns as described (shirt, pants/skirt, shoes, outerwear, accessories)
- Skin tone: match as described
- Do NOT change, simplify, or omit any clothing or accessory

CHARACTER STYLE:
- Oversized head, small body proportions (chibi / Pixar-style)
- Big, round, expressive cartoon eyes
- Smooth, rounded, friendly facial features
- Professional 3D animation quality
- Vibrant, saturated colors with soft cel-shading

POSE & FRAMING:
- Full body visible, standing upright
- Slight friendly smile, arms relaxed at sides
- Centered perfectly in frame
- Clean white background ONLY — no gradients, no shadows, no scenery

CRITICAL: No text, no logos, no brand names, no watermarks anywhere in the image.
CRITICAL: Perfect square 1:1 aspect ratio.`;
}

export { buildCharacterPrompt };
export default router;
