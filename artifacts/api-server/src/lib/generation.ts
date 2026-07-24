import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { analyzePhoto, extractOutfitFromDescription, generateStoryText, generateImage } from "./grok";
import { buildCharacterPrompt } from "../routes/character";
import { logger } from "./logger";

const uploadsDir = path.resolve(process.cwd(), "uploads");
const execFileAsync = promisify(execFile);

/**
 * Process an Aurora-generated image:
 * 1. Trim near-white borders (-fuzz 10%).
 * 2. For covers: crop to a 1:1 square (gravity North) so the image fills any
 *    cover container without gaps.
 * 3. For other images (characters, pages): trim only, preserve natural ratio.
 */
async function processImage(buf: Buffer, toSquare: boolean): Promise<Buffer> {
  try {
    const tmp = `/tmp/img-in-${Date.now()}.png`;
    const out = `/tmp/img-out-${Date.now()}.png`;
    await writeFile(tmp, buf);

    const args = [tmp, "-fuzz", "10%", "-trim", "+repage"];

    if (toSquare) {
      args.push(
        "-gravity", "North",
        "-extent", "%[fx:min(w,h)]x%[fx:min(w,h)]",
      );
    }

    args.push(out);
    await execFileAsync("magick", args);

    const { readFile, unlink } = await import("fs/promises");
    const result = await readFile(out);
    await Promise.all([unlink(tmp).catch(() => {}), unlink(out).catch(() => {})]);
    return result;
  } catch (err) {
    logger.warn({ err }, "processImage failed — using original buffer");
    return buf;
  }
}

export async function saveImage(buf: Buffer, subdir: string): Promise<string> {
  const dir = path.join(uploadsDir, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const fullPath = path.join(dir, filename);
  const processed = (subdir === "covers" || subdir === "characters" || subdir === "pages")
    ? await processImage(buf, subdir === "covers")
    : buf;
  await writeFile(fullPath, processed);
  return path.join(subdir, filename);
}

async function updateStory(storyId: string, updates: Partial<typeof storiesTable.$inferSelect>): Promise<void> {
  await db.update(storiesTable).set(updates as Record<string, unknown>).where(eq(storiesTable.id, storyId));
}

const ANATOMY_RULE = `CRITICAL ANATOMY — STRICTLY ENFORCE:
- The character has EXACTLY TWO (2) arms and EXACTLY TWO (2) hands — no more, no less
- Never draw a third hand, extra arm, or duplicate limb under any circumstances
- If the pose has both arms spread wide, raised, or extended, hands must be EMPTY — do not add a hand holding a phone or any object
- If one hand holds an object, the other arm must hang at the side, rest on a hip, or be clearly positioned elsewhere — never floating free or hidden
- Count limbs before finalising: two arms, two hands, two legs, two feet`;

/** Derive a natural, scene-specific pose from the image prompt text */
function derivePoseFromScene(imagePrompt: string, pageIndex: number): string {
  const p = imagePrompt.toLowerCase();

  if (p.match(/run|sprint|dash|chase|race/))
    return "running pose — body leaning forward, one leg lifted mid-stride, both arms bent and swinging naturally (one forward, one back), hair streaming behind";
  if (p.match(/jump|leap|bounce|spring/))
    return "mid-jump pose — both legs bent below, arms raised joyfully above head, mouth open in delight, airborne";
  if (p.match(/sit|seated|sat down|cross-legged/))
    return "seated on the ground, legs crossed comfortably, hands resting on knees, relaxed upright posture";
  if (p.match(/crouch|kneel|bend down|pick up|look at the ground/))
    return "crouching down on one knee, one hand touching or reaching toward the ground, other hand on the raised knee for balance";
  if (p.match(/wave|greet|hello|bye/))
    return "standing upright, one arm raised high and waving with open hand, other arm relaxed at side, big smile";
  if (p.match(/look up|gaze up|stare at the sky|look at the stars/))
    return "standing with head tilted back, both arms hanging at sides, eyes wide and mouth open in wonder, looking upward";
  if (p.match(/hold|carry|hug.*object|cradle/))
    return "standing, holding the object in both arms cradled against the chest, cheek tilted toward it affectionately";
  if (p.match(/hug.*friend|embrace|cuddle.*character/))
    return "standing, both arms wrapped around the other character in a warm hug, leaning slightly toward them";
  if (p.match(/point|discover|spot|notice|exclaim/))
    return "leaning forward excitedly, one arm outstretched with index finger pointing, other hand at chest in surprise, weight on front foot";
  if (p.match(/sleep|asleep|rest|nap|curl up/))
    return "curled on their side, eyes gently closed, both hands tucked together under cheek, knees slightly drawn up";
  if (p.match(/eat|drink|taste|bite|sip/))
    return "sitting at a slight angle, one hand bringing food or cup to mouth, other hand resting on lap or table";
  if (p.match(/swim|float|splash|underwater/))
    return "horizontal swimming pose — body streamlined, arms stretched ahead, legs kicked behind, head slightly lifted";
  if (p.match(/climb|scramble|scale/))
    return "mid-climb pose — one hand gripping high, one foot planted, body stretched upward, looking toward the top";
  if (p.match(/dance|spin|twirl/))
    return "mid-twirl, one foot on tiptoe, arms gracefully extended at shoulder height on each side, skirt or outfit flaring out";
  if (p.match(/sneak|tiptoe|creep|quietly/))
    return "tiptoeing — body slightly hunched, both arms out for balance, one leg raised on tiptoe, exaggerated sneaky expression";
  if (p.match(/celebrate|cheer|victory|hooray|yay/))
    return "arms punched straight up in the air in celebration, both fists raised, feet slightly apart, huge grin, body language of triumph";
  if (p.match(/read|book|scroll|study/))
    return "seated, holding an open book with both hands, head tilted slightly down, absorbed in reading";
  if (p.match(/look.*around|explore|wander|search/))
    return "standing sideways, one hand raised to shade eyes as if scanning the horizon, other hand on hip, looking into the distance";

  // Fallback — cycle through 6 distinct natural poses based on page index
  const fallbacks = [
    "standing in a relaxed three-quarter pose, weight on one leg, opposite hand on hip, cheerful expression",
    "walking forward, one foot ahead of the other, arms swinging naturally in opposite rhythm, looking slightly to the side with a smile",
    "kneeling on one knee, one hand planted on the ground, looking up with curiosity",
    "sitting cross-legged, both hands in lap, head tilted slightly to one side with a thoughtful expression",
    "standing on tiptoe, arms slightly outstretched for balance, looking ahead with excitement",
    "turned three-quarters away then glancing back over shoulder with a playful grin, one arm relaxed at side",
  ];
  return fallbacks[pageIndex % fallbacks.length];
}

/** Cover prompt — character prominently in center with title text */
function buildCoverPrompt(
  story: typeof storiesTable.$inferSelect,
  characterDesc: string,
  character2Desc?: string,
  lockedOutfitDesc?: string | null,
): string {
  const char2Line = character2Desc
    ? `\nSECOND CHARACTER: ${story.characterName2} also appears prominently — ${character2Desc}.`
    : "";
  const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;

  // When an outfit is chosen, make it the first thing Aurora reads and explicitly
  // instruct it to ignore any clothing mentioned in the character description.
  const effectiveOutfit = story.outfit ?? lockedOutfitDesc;
  const outfitBlock = effectiveOutfit
    ? `OUTFIT LOCK (MANDATORY on every page — identical colour, style, and items every time — takes absolute priority):
The character wears EXACTLY THIS and nothing else: ${effectiveOutfit}
CRITICAL: IGNORE any clothing mentioned in the character description below. Use only hair, eyes, skin tone, and face shape from it.`
    : "";
  const descLabel = effectiveOutfit
    ? `CHARACTER PHYSICAL FEATURES ONLY — hair, eyes, skin, face (ignore any clothing mentioned):`
    : `CHARACTER APPEARANCE — reproduce faithfully (hair, eyes, skin, outfit, accessories):`;

  return `Create a vibrant, professional children's picture book COVER illustration in a 3D animated Pixar / Disney movie style — high-quality 3D render, soft cel-shading, vibrant saturated colors. The style must exactly match a 3D animated movie still, NOT a 2D hand-drawn illustration.

MAIN CHARACTER (must be prominently centered, full body visible): ${story.characterName}
${outfitBlock}
${descLabel}
${characterDesc}
${char2Line}

CHARACTER STYLE (MUST match the pre-generated character exactly — 3D animated, NOT 2D):
- 3D animated Pixar / Disney movie style — high-quality 3D render, soft cel-shading
- Oversized head, small body proportions (chibi / Pixar-style)
- Big, round, expressive cartoon eyes matching the character's eye color
- Same hair color, length, and style as described above
- Friendly, joyful expression
- Vibrant saturated colors, smooth rounded surfaces

CHARACTER POSE: Standing confidently, slight weight shift to one side, arms relaxed, big smile.

${ANATOMY_RULE}

SCENE: Magical ${effectiveTheme} adventure background — richly detailed, warm golden-hour lighting, vibrant colors.

TITLE: The story title "${story.title}" appears centered at the very top of the image. STRICT SIZE RULE — the font must be tiny: no taller than 4% of the image height, and the entire title must fit comfortably within the central 50% of the image width (25% blank margin on every left and right side). Use neat, rounded children's book lettering in a single line. If the title is long, reduce the font size further until it fits on one line within that 50% width limit. Render NO other text anywhere in the image.

COMPOSITION: Square 1:1 aspect ratio. The illustration MUST fill the canvas completely edge-to-edge — no white margins, no blank borders, no padding of any kind on any side. The background scene bleeds all the way to all four edges. Professional picture book cover quality. No logos, no brand names, no watermarks — only the story title text described above.`;
}

/** Page illustration prompt — character MUST appear in every scene with a scene-specific pose */
export function buildPagePrompt(
  story: typeof storiesTable.$inferSelect,
  page: { text: string; image_prompt: string },
  characterDesc: string,
  pageIndex: number,
  character2Desc?: string,
  lockedOutfitDesc?: string | null,
): string {
  const char2Line = character2Desc
    ? `\nSECOND CHARACTER (also in this scene): ${story.characterName2} — ${character2Desc}.`
    : "";
  // Some fairy-tale theme names trigger Aurora content moderation when used verbatim.
  // Map them to safe descriptive equivalents for image prompts.
  const THEME_SAFE_LABELS: Record<string, string> = {
    "little red riding hood": "enchanted forest path with a cosy woodland cottage",
    "goldilocks":             "cosy woodland cottage with three friendly bears",
    "hansel and gretel":      "magical forest with a candy-decorated gingerbread cottage",
    "three little pigs":      "sunny countryside with colourful brick and straw houses",
    "sleeping beauty":        "enchanted royal castle surrounded by rose gardens",
    "jack and the beanstalk": "magical giant beanstalk reaching into the clouds",
    "cinderella":             "magical ballroom with sparkling fairy-tale castle",
  };
  const rawTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;
  const effectiveTheme = THEME_SAFE_LABELS[rawTheme] ?? rawTheme;
  const poseInstruction = derivePoseFromScene(page.image_prompt, pageIndex);

  const effectiveOutfit = story.outfit ?? lockedOutfitDesc;
  const outfitBlock = effectiveOutfit
    ? `OUTFIT LOCK (MANDATORY on every page — identical colour, style, and items every time — takes absolute priority):
The character wears EXACTLY THIS and nothing else: ${effectiveOutfit}
CRITICAL: IGNORE any clothing mentioned in the character description below. Use only hair, eyes, skin tone, and face shape from it.`
    : "";
  const descLabel = effectiveOutfit
    ? `CHARACTER PHYSICAL FEATURES ONLY — hair, eyes, skin, face (ignore any clothing mentioned):`
    : `CHARACTER APPEARANCE (hair, eyes, skin, outfit, accessories — consistent across all pages):`;

  return `Create a children's picture book page illustration in a 3D animated Pixar / Disney movie style — high-quality 3D render, soft cel-shading, vibrant saturated colors. The style must exactly match a 3D animated movie still, NOT a 2D hand-drawn illustration.

SCENE: ${page.image_prompt}

MAIN CHARACTER — MUST APPEAR IN THIS SCENE: ${story.characterName}
${outfitBlock}
${descLabel}
${characterDesc}
${char2Line}

CHARACTER STYLE (identical across every page — 3D animated, NOT 2D):
- 3D animated Pixar / Disney movie style — high-quality 3D render, soft cel-shading
- Oversized head, small body (chibi / Pixar-style)
- Big round expressive cartoon eyes — same eye color as character description
- Same hair color, length, and exact style every time
- Vibrant saturated colors, smooth rounded surfaces

CHARACTER POSE FOR THIS PAGE (match the scene action — this pose is unique to this page):
${poseInstruction}

${ANATOMY_RULE}

SETTING: ${effectiveTheme} adventure scene, richly detailed, vibrant colors, soft warm lighting.

CRITICAL — NO TEXT WHATSOEVER: Do NOT render any letters, words, numbers, speech bubbles, signs with text, book pages with text, or any written characters anywhere in the image. The image must be a purely visual scene — zero text of any kind.

COMPOSITION: Square 1:1 aspect ratio. The illustration MUST fill the canvas completely edge-to-edge — no white margins, no blank borders, no padding of any kind. The background scene bleeds all the way to all four edges of the canvas. Richly detailed background. Professional 3D animated children's picture book quality.`;
}

export async function runStoryGeneration(storyId: string): Promise<void> {
  try {
    await updateStory(storyId, {
      status: "generating",
      generationProgress: 5,
      generationStatusMessage: "Starting story creation...",
    });

    const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
    if (!story) throw new Error("Story not found");

    let characterDesc = story.characterDescription ?? "a friendly, expressive animated character with warm eyes and a cheerful smile";
    let character2Desc: string | undefined;

    // Skip character generation if it was already done in the create wizard
    if (story.characterImagePath && story.characterDescription) {
      logger.info({ storyId }, "Character already generated — skipping to story writing");
      await updateStory(storyId, {
        generationProgress: 30,
        generationStatusMessage: "Character ready! Writing your story...",
      });
    } else {
      // Step 1: Analyse photo
      await updateStory(storyId, { generationProgress: 10, generationStatusMessage: "Analysing your character from the photo..." });

      if (story.originalPhotoPath) {
        const photoPath = path.join(uploadsDir, story.originalPhotoPath);
        try {
          characterDesc = await analyzePhoto(photoPath);
          logger.info({ storyId }, "Character analysis complete");
        } catch (e) {
          logger.warn({ storyId, err: e }, "Photo analysis failed, using default description");
        }
      }

      await updateStory(storyId, {
        characterDescription: characterDesc,
        generationProgress: 20,
        generationStatusMessage: "Creating your character illustration...",
      });

      // Step 2: Generate character illustration
      const charPrompt = buildCharacterPrompt(characterDesc);
      try {
        const charBuf = await generateImage(charPrompt);
        const characterImagePath = await saveImage(charBuf, "characters");
        await updateStory(storyId, {
          characterImagePath,
          generationProgress: 30,
          generationStatusMessage: "Character created! Writing your story...",
        });
        logger.info({ storyId }, "Character image generated");
      } catch (e) {
        logger.warn({ storyId, err: e }, "Character image generation failed, continuing");
        await updateStory(storyId, { generationProgress: 30, generationStatusMessage: "Writing your story..." });
      }
    }

    // Use pre-generated character2 description if available, otherwise analyse photo
    if (story.character2Description) {
      character2Desc = story.character2Description;
      logger.info({ storyId }, "Character 2 description pre-generated — skipping photo analysis");
    } else if (story.originalPhotoPath2) {
      try {
        character2Desc = await analyzePhoto(path.join(uploadsDir, story.originalPhotoPath2));
      } catch (e) {
        logger.warn({ storyId, err: e }, "Second photo analysis failed");
      }
    }

    // Re-read story to get latest characterDescription after possible update
    const updatedStory = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
    if (updatedStory?.characterDescription) characterDesc = updatedStory.characterDescription;

    // Extract and lock the outfit from the character description (skip if user chose an explicit outfit)
    let lockedOutfitDesc: string | null = updatedStory?.lockedOutfitDesc ?? null;
    if (!story.outfit && !lockedOutfitDesc && characterDesc) {
      try {
        lockedOutfitDesc = await extractOutfitFromDescription(characterDesc);
        await updateStory(storyId, { lockedOutfitDesc });
        logger.info({ storyId, lockedOutfitDesc }, "Outfit locked for consistency");
      } catch (e) {
        logger.warn({ storyId, err: e }, "Outfit extraction failed — illustrations may vary");
      }
    }

    // Step 3: Generate story text with Grok-3
    await updateStory(storyId, { generationProgress: 35, generationStatusMessage: "Writing your story with Grok..." });

    const pageCount = story.pageCount ?? 8;
    const petInfo = story.relationship === "pet" && story.petType
      ? `${story.characterName} is a ${story.petType}.` : "";
    const char2Info = story.characterName2
      ? `The story also features ${story.characterName2}, who is the storyteller's ${story.relationship2 ?? "friend"}.` : "";
    const userIdeas = story.userPrompt ? `User's ideas to incorporate: "${story.userPrompt}"` : "";
    const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;
    const outfitInfo = story.outfit ? `The character wears: ${story.outfit}.` : "";

    const storyPrompt = `You are a creative children's book author. Write a ${pageCount}-page illustrated children's story.

Story details:
- Title: "${story.title}" (use exactly as written)
- Main character: ${story.characterName}, who is the storyteller's ${story.relationship} and feels ${story.emotion}. ${petInfo} ${outfitInfo}
- ${char2Info}
- Theme: A ${effectiveTheme} adventure
- Audience age: ${story.age} years old
- ${userIdeas}

Requirements:
- Each page: approximately 40-60 words of engaging, age-appropriate text
- Each page needs an image_prompt describing the scene (actions, setting, mood) — the main character ${story.characterName} must appear and actively DO something in every scene
- Clear story arc: beginning, middle, satisfying end
- Language appropriate for age ${story.age}

Respond ONLY with a JSON object:
{
  "pages": [
    { "page_number": 1, "text": "story text...", "image_prompt": "scene description with ${story.characterName} doing something specific..." },
    ...
  ]
}`;

    const storyResult = await generateStoryText(storyPrompt);
    const pages = storyResult.pages;
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      throw new Error("Grok returned invalid story content");
    }

    await updateStory(storyId, { generationProgress: 50, generationStatusMessage: "Story written! Creating cover art..." });

    // Step 4: Generate cover image
    const coverPrompt = buildCoverPrompt(story, characterDesc, character2Desc, lockedOutfitDesc);
    let coverImagePath: string | undefined;
    try {
      const coverBuf = await generateImage(coverPrompt);
      coverImagePath = await saveImage(coverBuf, "covers");
      await updateStory(storyId, { coverImagePath });
      logger.info({ storyId }, "Cover image generated");
    } catch (e) {
      logger.error({ storyId, err: e }, "Cover generation failed");
    }

    await updateStory(storyId, { generationProgress: 55, generationStatusMessage: `Cover created! Illustrating ${pages.length} pages...` });

    // Step 5: Generate page illustrations
    const savedPages: typeof storyPagesTable.$inferInsert[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const progress = 55 + Math.round(((i + 1) / pages.length) * 40);
      await updateStory(storyId, {
        generationProgress: progress,
        generationStatusMessage: `Illustrating page ${i + 1} of ${pages.length}...`,
      });

      let imagePath: string | undefined;
      try {
        const pagePrompt = buildPagePrompt(story, page, characterDesc, i, character2Desc, lockedOutfitDesc);
        const imgBuf = await generateImage(pagePrompt);
        imagePath = await saveImage(imgBuf, "pages");
        logger.info({ storyId, pageNumber: page.page_number }, "Page image generated");
      } catch (e) {
        logger.warn({ storyId, pageNumber: page.page_number, err: e }, "Page image failed");
      }

      savedPages.push({
        id: `${storyId}-p${page.page_number}`,
        storyId,
        pageNumber: page.page_number,
        text: page.text,
        imagePrompt: page.image_prompt,
        imagePath,
      });
    }

    await db.insert(storyPagesTable).values(savedPages);

    // Step 6: Mark complete
    await updateStory(storyId, {
      status: "complete",
      generationProgress: 100,
      generationStatusMessage: `Your story is ready! ${savedPages.length} pages illustrated.`,
    });

    logger.info({ storyId }, "Story generation complete");
  } catch (e) {
    logger.error({ storyId, err: e }, "Story generation failed");
    const msg = e instanceof Error ? e.message : "An unexpected error occurred";
    await updateStory(storyId, {
      status: "error",
      errorMessage: msg,
      generationStatusMessage: "Something went wrong during generation.",
    }).catch(() => {});
  }
}
