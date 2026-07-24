import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storiesTable = pgTable("stories", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull(),
  characterName: text("character_name").notNull(),
  characterName2: text("character_name_2"),
  relationship: text("relationship").notNull(),
  relationship2: text("relationship_2"),
  petType: text("pet_type"),
  petType2: text("pet_type_2"),
  theme: text("theme").notNull(),
  customTheme: text("custom_theme"),
  age: text("age").notNull(),
  emotion: text("emotion").notNull(),
  outfit: text("outfit"),
  occasion: text("occasion"),
  pageCount: integer("page_count").notNull().default(8),
  userPrompt: text("user_prompt"),
  originalPhotoPath: text("original_photo_path"),
  originalPhotoPath2: text("original_photo_path_2"),
  characterImagePath: text("character_image_path"),
  userId: text("user_id"),
  characterDescription: text("character_description"),
  lockedOutfitDesc: text("locked_outfit_desc"),
  character2ImagePath: text("character_2_image_path"),
  character2Description: text("character_2_description"),
  characterVideoPath: text("character_video_path"),
  coverImagePath: text("cover_image_path"),
  status: text("status").notNull().default("pending"),
  generationProgress: integer("generation_progress").notNull().default(0),
  generationStatusMessage: text("generation_status_message"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStorySchema = createInsertSchema(storiesTable).omit({ createdAt: true });
export type InsertStory = z.infer<typeof insertStorySchema>;
export type StoryRow = typeof storiesTable.$inferSelect;
