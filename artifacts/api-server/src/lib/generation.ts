import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { eq } from "drizzle-orm";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { analyzePhoto, generateStoryText, generateImage } from "./grok";
import { logger } from "./logger";

const uploadsDir = path.resolve(process.cwd(), "uploads");

async function saveImage(buf: Buffer, subdir: string): Promise<string> {
  const dir = path.join(uploadsDir, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, buf);
  return path.join(subdir, filename); // relative path stored in DB
}

async function updateStory(storyId: string, updates: Partial<typeof storiesTable.$inferSelect>): Promise<void> {
  await db.update(storiesTable).set(updates as Record<string, unknown>).where(eq(storiesTable.id, storyId));
}

/** Build the character illustration prompt using the user's template + vision description */
function buildCharacterPrompt(desc: string, outfit?: string | null): string {
  const outfitLine = outfit
    ? `OUTFIT: The character wears ${outfit}. Preserve this outfit exactly.`
    : "CRITICAL: Maintain their exact clothing, colors, and style from the original photo.";

  return `GENERATE IMAGE: Transform this person into a 3D animated cartoon character in a friendly, animated style.

CHARACTER DESCRIPTION (from photo analysis): ${desc}

${outfitLine}

Keep their hairstyle and hair color accurate.
Preserve all clothing items (shirts, pants, dresses, accessories, etc.).
Maintain the same color palette from their outfit.
Keep any visible accessories (glasses, jewelry, hats, etc.).

Character style:
- Oversized head, small body proportions
- Big expressive cartoon eyes
- Friendly, child-appropriate appearance
- Professional 3D animation quality
- Clean white background
- Full body view, centered in frame

Style: 3D animation, vibrant colors, high-quality rendering.
CRITICAL: The final image must not contain any text, logos, or brand names.
CRITICAL: Generate as a perfect square image with an exact 1:1 aspect ratio.`;
}

/** Build the cover prompt — character prominently in center, title text in the image */
function buildCoverPrompt(
  story: typeof storiesTable.$inferSelect,
  characterDesc: string,
  outfit: string | null | undefined,
  character2Desc?: string,
): string {
  const outfitLine = outfit ? `OUTFIT: The character wears ${outfit}.` : "";
  const char2Line = character2Desc
    ? `\nSECOND CHARACTER: ${story.characterName2} also appears prominently — ${character2Desc}.`
    : "";
  const occasionLine = story.occasion ? `\nOCCASION ELEMENTS: Incorporate ${story.occasion} themed decorative details.` : "";
  const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;

  return `Create a vibrant, professional children's picture book COVER illustration.

CHARACTER (must be prominently centered, full-body): ${story.characterName}
CHARACTER APPEARANCE: ${characterDesc}
${outfitLine}${char2Line}

CHARACTER STYLE:
- Oversized head, small body proportions
- Big expressive cartoon eyes
- Friendly, child-appropriate 3D animated look
- Vibrant colors, soft cel-shading, smooth rounded shapes
- Joyful, expressive pose

SCENE: A magical ${effectiveTheme} adventure background — richly detailed, warm golden-hour lighting.${occasionLine}

TITLE TEXT: Display the title "${story.title}" in large, bold, decorative children's book lettering prominently at the TOP of the image. The title must be clearly readable.

COMPOSITION: Square 1:1 aspect ratio. Edge-to-edge illustration. No blank borders. Professional picture book cover quality. No logos, no brand names, no watermarks.`;
}

/** Build a page illustration prompt — character MUST appear in every scene */
function buildPagePrompt(
  story: typeof storiesTable.$inferSelect,
  page: { text: string; image_prompt: string },
  characterDesc: string,
  outfit: string | null | undefined,
  character2Desc?: string,
): string {
  const outfitLine = outfit
    ? `OUTFIT (keep identical on every page): The character wears ${outfit}.`
    : "Maintain the character's exact clothing from their character sheet.";
  const char2Line = character2Desc
    ? `\nSECOND CHARACTER (also in this scene): ${story.characterName2} — ${character2Desc}.`
    : "";
  const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;

  return `Create a children's picture book page illustration.

SCENE TO ILLUSTRATE: ${page.image_prompt}
SCENE CONTEXT: "${page.text}"

CHARACTER (MUST APPEAR IN THIS SCENE — do not omit): ${story.characterName}
CHARACTER APPEARANCE: ${characterDesc}
${outfitLine}${char2Line}

CHARACTER STYLE (keep consistent across ALL pages):
- Oversized head, small body proportions
- Big expressive cartoon eyes
- Friendly, child-appropriate 3D animated look
- Vibrant colors, soft cel-shading, smooth rounded shapes

STORY THEME: ${effectiveTheme} adventure setting

COMPOSITION: Square 1:1 aspect ratio. Richly detailed background. Edge-to-edge illustration. NO text, NO letters, NO watermarks, NO title. Professional children's picture book quality.`;
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

    // Step 1: Analyze photo(s) to get character descriptions
    await updateStory(storyId, { generationProgress: 10, generationStatusMessage: "Analysing your character from the photo..." });

    let characterDesc = "a friendly, expressive animated character with warm eyes and a cheerful smile";
    let character2Desc: string | undefined;

    if (story.originalPhotoPath) {
      const photoPath = path.join(uploadsDir, story.originalPhotoPath);
      try {
        characterDesc = await analyzePhoto(photoPath);
        logger.info({ storyId }, "Character 1 analysis complete");
      } catch (e) {
        logger.warn({ storyId, err: e }, "Photo analysis failed, using default description");
      }
    }

    if (story.originalPhotoPath2) {
      const photoPath2 = path.join(uploadsDir, story.originalPhotoPath2);
      try {
        character2Desc = await analyzePhoto(photoPath2);
        logger.info({ storyId }, "Character 2 analysis complete");
      } catch (e) {
        logger.warn({ storyId, err: e }, "Photo 2 analysis failed");
      }
    }

    await updateStory(storyId, {
      characterDescription: characterDesc,
      generationProgress: 20,
      generationStatusMessage: "Creating your character illustration...",
    });

    // Step 2: Generate character illustration using user's exact prompt template
    const charPrompt = buildCharacterPrompt(characterDesc, story.outfit);

    let characterImagePath: string | undefined;
    try {
      const charBuf = await generateImage(charPrompt);
      characterImagePath = await saveImage(charBuf, "characters");
      await updateStory(storyId, {
        characterImagePath,
        generationProgress: 30,
        generationStatusMessage: "Character created! Writing your story...",
      });
      logger.info({ storyId }, "Character image generated");
    } catch (e) {
      logger.warn({ storyId, err: e }, "Character image generation failed, continuing without it");
      await updateStory(storyId, {
        generationProgress: 30,
        generationStatusMessage: "Writing your story with Grok...",
      });
    }

    // Step 3: Generate story text with Grok-3
    const pageCount = story.pageCount ?? 8;
    const petInfo = story.relationship === "pet" && story.petType
      ? `${story.characterName} is a ${story.petType}.`
      : "";
    const char2Info = story.characterName2
      ? `The story also features ${story.characterName2}, who is the storyteller's ${story.relationship2 ?? "friend"}.`
      : "";
    const occasionInfo = story.occasion ? `The story incorporates ${story.occasion} themes.` : "";
    const userIdeas = story.userPrompt ? `User's ideas to incorporate: "${story.userPrompt}"` : "";
    const effectiveTheme = story.theme === "custom" && story.customTheme ? story.customTheme : story.theme;

    await updateStory(storyId, { generationProgress: 35, generationStatusMessage: "Writing your story with Grok..." });

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
- Each page should have approximately 40-60 words of engaging, age-appropriate text
- Each page needs a vivid image_prompt describing the scene (actions, setting, mood) — describe WHAT IS HAPPENING in the scene, not the character's appearance
- The main character ${story.characterName} should actively appear and participate in every scene
- The story should have a clear arc: beginning, middle, satisfying end
- Language must be appropriate for age ${story.age}

Respond ONLY with a JSON object with this exact structure:
{
  "pages": [
    { "page_number": 1, "text": "story text for page 1...", "image_prompt": "visual scene description with ${story.characterName} actively doing something..." },
    ...
  ]
}`;

    const storyResult = await generateStoryText(storyPrompt);
    const pages = storyResult.pages;

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      throw new Error("Grok returned invalid story content");
    }

    await updateStory(storyId, { generationProgress: 50, generationStatusMessage: `Story written! Creating cover art...` });

    // Step 4: Generate cover image (character + title in the same image)
    const coverPrompt = buildCoverPrompt(story, characterDesc, story.outfit, character2Desc);
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

    // Step 5: Generate page illustrations sequentially (character appears in every one)
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
        const pagePrompt = buildPagePrompt(story, page, characterDesc, story.outfit, character2Desc);
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

    // Step 6: Save all pages to DB
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
