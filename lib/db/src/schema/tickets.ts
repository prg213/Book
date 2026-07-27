import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ticketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // open | resolved | closed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TicketRow = typeof ticketsTable.$inferSelect;
