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

function buildCoverPrompt(story: typeof storiesTable.$inferSelect, characterDesc: string, character2Desc?: string): string {
  const char2 = character2Desc
    ? `A second character is ${story.characterName2}, described as: ${character2Desc}.`
    : "";
  const occasion = story.occasion ? `Include ${story.occasion} themed decorative elements.` : "";
  const outfit = story.outfit ? `The main character wears: ${story.outfit}.` : "";

  return `Create a vibrant, professional children's picture book cover illustration.
  
STYLE: 3D animated style, warm vibrant colors, soft cel-shading, smooth rounded shapes, bold outlines, child-friendly and magical.

MAIN CHARACTER: ${story.characterName} — ${characterDesc}. ${outfit} The character should appear joyful and expressive, shown in a full-body pose in the center of the image.

${char2}

SCENE: A whimsical ${story.theme} adventure setting, richly detailed background, golden-hour lighting.

TITLE TEXT: Display the title "${story.title}" in large, bold, decorative lettering prominently at the top of the image.

${occasion}

COMPOSITION: Square 1:1 aspect ratio. No borders. Edge-to-edge illustration. Professional children's book quality.`;
}

function buildPagePrompt(
  story: typeof storiesTable.$inferSelect,
  page: { text: string; image_prompt: string },
  characterDesc: string,
  character2Desc?: string,
  outfit?: string
): string {
  const char2 = character2Desc
    ? `A second character named ${story.characterName2} also appears, described as: ${character2Desc}.`
    : "";
  const outfitLock = outfit
    ? `The main character wears exactly: ${outfit}. Keep this outfit identical across all pages.`
    : "";

  return `Create a children's picture book illustration for this scene: ${page.image_prompt}

STYLE: 3D animated illustration, warm vibrant colors, soft cel-shading, smooth rounded shapes, bold outlines — MUST match a consistent children's book art style throughout.

MAIN CHARACTER: ${story.characterName} — ${characterDesc}. ${outfitLock} Pose the character naturally for the scene while preserving their exact appearance.

${char2}

SCENE CONTEXT: "${page.text}"

COMPOSITION: Square 1:1 aspect ratio. No text, no letters, no watermarks. Edge-to-edge illustration, richly detailed background, professional children's book quality.`;
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
    await updateStory(storyId, { generationProgress: 10, generationStatusMessage: "Analysing your character..." });

    let characterDesc = "a friendly, expressive animated character";
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

    await db.update(storiesTable).set({ characterDescription: characterDesc }).where(eq(storiesTable.id, storyId));

    // Step 2: Generate character illustration
    await updateStory(storyId, { generationProgress: 20, generationStatusMessage: "Creating your character illustration..." });

    const charPrompt = `Create a 3D animated children's book character illustration on a clean white background.

CHARACTER: ${story.characterName} — ${characterDesc}

STYLE: Friendly 3D animated style, vibrant colors, oversized expressive head, smooth rounded shapes, soft cel-shading, child-appropriate.
${story.outfit ? `OUTFIT: ${story.outfit}` : ""}

Show the character in a friendly full-body pose, centered, on a plain white background. No text, no backgrounds, no watermarks. Square 1:1 format.`;

    let characterImagePath: string | undefined;
    try {
      const charBuf = await generateImage(charPrompt);
      characterImagePath = await saveImage(charBuf, "characters");
      await updateStory(storyId, { characterImagePath });
      logger.info({ storyId }, "Character image generated");
    } catch (e) {
      logger.warn({ storyId, err: e }, "Character image generation failed, continuing without it");
    }

    // Step 3: Generate story text with Grok-3
    await updateStory(storyId, { generationProgress: 35, generationStatusMessage: "Writing your story with Grok..." });

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
- Each page needs a vivid image_prompt describing the scene (what to illustrate, actions, setting) — do NOT mention the character's physical appearance in image_prompts
- The story should have a clear arc: beginning, middle, satisfying end
- Language must be appropriate for age ${story.age}

Respond ONLY with a JSON object with this exact structure:
{
  "pages": [
    { "page_number": 1, "text": "story text for page 1...", "image_prompt": "visual scene description..." },
    ...
  ]
}`;

    const storyResult = await generateStoryText(storyPrompt);
    const pages = storyResult.pages;

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      throw new Error("Grok returned invalid story content");
    }

    await updateStory(storyId, { generationProgress: 50, generationStatusMessage: `Story written! Creating ${pages.length} illustrations...` });

    // Step 4: Generate cover image
    const coverPrompt = buildCoverPrompt(story, characterDesc, character2Desc);
    let coverImagePath: string | undefined;

    try {
      const coverBuf = await generateImage(coverPrompt);
      coverImagePath = await saveImage(coverBuf, "covers");
      await updateStory(storyId, { coverImagePath });
      logger.info({ storyId }, "Cover image generated");
    } catch (e) {
      logger.error({ storyId, err: e }, "Cover generation failed");
    }

    await updateStory(storyId, { generationProgress: 55, generationStatusMessage: "Cover created! Illustrating each page..." });

    // Step 5: Generate page illustrations sequentially (to respect rate limits)
    const savedPages: typeof storyPagesTable.$inferInsert[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const progress = 55 + Math.round(((i + 1) / pages.length) * 38);
      await updateStory(storyId, {
        generationProgress: progress,
        generationStatusMessage: `Illustrating page ${i + 1} of ${pages.length}...`,
      });

      let imagePath: string | undefined;
      try {
        const pagePrompt = buildPagePrompt(story, page, characterDesc, character2Desc, story.outfit ?? undefined);
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
