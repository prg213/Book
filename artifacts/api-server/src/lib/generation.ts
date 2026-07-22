import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { eq } from "drizzle-orm";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { analyzePhoto, generateStoryText, generateImage } from "./grok";
import { buildCharacterPrompt } from "../routes/character";
import { logger } from "./logger";

const uploadsDir = path.resolve(process.cwd(), "uploads");

async function saveImage(buf: Buffer, subdir: string): Promise<string> {
  const dir = path.join(uploadsDir, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, buf);
  return path.join(subdir, filename);
}

async function updateStory(storyId: string, updates: Partial<typeof storiesTable.$inferSelect>): Promise<void> {
  await db.update(storiesTable).set(updates as Record<string, unknown>).where(eq(storiesTable.id, storyId));
}

const ANATOMY_RULE = `CRITICAL ANATOMY — STRICTLY ENFORCE:
- The character has EXACTLY TWO (2) arms and EXACTLY TWO (2) hands — no more, no less
- Never draw a third hand, extra arm, or duplicate limb under any circumstances
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
): string {
  const char2Line = character2Desc
    ? `\nSECOND CHARACTER: ${story.characterName2} also appears prominently — ${character2Desc}.`
    : "";
  const occasionLine = story.occasion && story.occasion !== "none"
    ? `\nOCCASION: Incorporate ${story.occasion} themed decorative details into the scene.`
    : "";
  const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;

  return `Create a vibrant, professional children's picture book COVER illustration.

MAIN CHARACTER (must be prominently centered, full body visible): ${story.characterName}
CHARACTER APPEARANCE — reproduce faithfully from this description (appearance only — hair, eyes, skin, outfit, accessories): ${characterDesc}
${char2Line}

CHARACTER STYLE (MUST match the pre-generated character exactly):
- Oversized head, small body proportions (chibi / Pixar-style)
- Big, round, expressive cartoon eyes matching the character's eye color
- Same hair color, length, and style as described
- Same outfit with exact colors and patterns as described
- Friendly, joyful expression

CHARACTER POSE: Standing confidently, slight weight shift to one side, arms relaxed, big smile.

${ANATOMY_RULE}

SCENE: Magical ${effectiveTheme} adventure background — richly detailed, warm golden-hour lighting, vibrant colors.${occasionLine}

TITLE TEXT: The book title "${story.title}" must appear prominently at the TOP of the image in large, bold, decorative children's book lettering that is clearly readable. The title must be centered horizontally with at least 15% blank margin on BOTH the left and right sides — do not let the text touch the edges of the image.

COMPOSITION: Square 1:1 aspect ratio. Edge-to-edge illustration — no blank borders. Professional picture book cover quality. No logos, no brand names, no watermarks other than the story title.`;
}

/** Page illustration prompt — character MUST appear in every scene with a scene-specific pose */
function buildPagePrompt(
  story: typeof storiesTable.$inferSelect,
  page: { text: string; image_prompt: string },
  characterDesc: string,
  pageIndex: number,
  character2Desc?: string,
): string {
  const char2Line = character2Desc
    ? `\nSECOND CHARACTER (also in this scene): ${story.characterName2} — ${character2Desc}.`
    : "";
  const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;
  const poseInstruction = derivePoseFromScene(page.image_prompt, pageIndex);

  return `Create a children's picture book page illustration.

SCENE: ${page.image_prompt}
STORY TEXT FOR THIS PAGE: "${page.text}"

MAIN CHARACTER — MUST APPEAR IN THIS SCENE: ${story.characterName}
CHARACTER APPEARANCE (appearance only — hair, eyes, skin, outfit, accessories — keep 100% consistent across all pages): ${characterDesc}
${char2Line}

CHARACTER STYLE (identical across every page):
- Oversized head, small body (chibi / Pixar-style)
- Big round expressive cartoon eyes — same eye color as character description
- Same hair color, length, and exact style every time
- Same outfit with exact colors and patterns on every page

CHARACTER POSE FOR THIS PAGE (match the scene action — this pose is unique to this page):
${poseInstruction}

${ANATOMY_RULE}

SETTING: ${effectiveTheme} adventure scene, richly detailed, vibrant colors, soft warm lighting.

COMPOSITION: Square 1:1 aspect ratio. Edge-to-edge illustration. Richly detailed background. NO text, NO letters, NO numbers, NO watermarks anywhere. Professional children's picture book quality.`;
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

    // Analyse second photo if present
    if (story.originalPhotoPath2) {
      try {
        character2Desc = await analyzePhoto(path.join(uploadsDir, story.originalPhotoPath2));
      } catch (e) {
        logger.warn({ storyId, err: e }, "Second photo analysis failed");
      }
    }

    // Re-read story to get latest characterDescription after possible update
    const updatedStory = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
    if (updatedStory?.characterDescription) characterDesc = updatedStory.characterDescription;

    // Step 3: Generate story text with Grok-3
    await updateStory(storyId, { generationProgress: 35, generationStatusMessage: "Writing your story with Grok..." });

    const pageCount = story.pageCount ?? 8;
    const petInfo = story.relationship === "pet" && story.petType
      ? `${story.characterName} is a ${story.petType}.` : "";
    const char2Info = story.characterName2
      ? `The story also features ${story.characterName2}, who is the storyteller's ${story.relationship2 ?? "friend"}.` : "";
    const occasionInfo = story.occasion && story.occasion !== "none"
      ? `The story incorporates ${story.occasion} themes.` : "";
    const userIdeas = story.userPrompt ? `User's ideas to incorporate: "${story.userPrompt}"` : "";
    const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;

    const storyPrompt = `You are a creative children's book author. Write a ${pageCount}-page illustrated children's story.

Story details:
- Title: "${story.title}" (use exactly as written)
- Main character: ${story.characterName}, who is the storyteller's ${story.relationship} and feels ${story.emotion}. ${petInfo}
- ${char2Info}
- Theme: A ${effectiveTheme} adventure
- Audience age: ${story.age} years old
- ${occasionInfo}
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

    // Step 4: Generate cover image (character + title in same image)
    const coverPrompt = buildCoverPrompt(story, characterDesc, character2Desc);
    try {
      const coverBuf = await generateImage(coverPrompt);
      const coverImagePath = await saveImage(coverBuf, "covers");
      await updateStory(storyId, { coverImagePath });
      logger.info({ storyId }, "Cover image generated");
    } catch (e) {
      logger.error({ storyId, err: e }, "Cover generation failed");
    }

    await updateStory(storyId, { generationProgress: 55, generationStatusMessage: `Cover created! Illustrating ${pages.length} pages...` });

    // Step 5: Generate page illustrations — character appears in every one
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
        const pagePrompt = buildPagePrompt(story, page, characterDesc, i, character2Desc);
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
