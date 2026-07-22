import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storyPagesTable = pgTable("story_pages", {
  id: text("id").primaryKey(),
  storyId: text("story_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  text: text("text"),
  imagePrompt: text("image_prompt"),
  imagePath: text("image_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoryPageSchema = createInsertSchema(storyPagesTable).omit({ createdAt: true });
export type InsertStoryPage = z.infer<typeof insertStoryPageSchema>;
export type StoryPageRow = typeof storyPagesTable.$inferSelect;
