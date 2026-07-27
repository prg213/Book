import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id"),                       // Clerk user ID (null = anonymous)
  storyId: text("story_id"),                     // which story this relates to
  productType: text("product_type").notNull(),   // "digital" | "print"
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"), // pending | paid | fulfilled | cancelled
  // Shipping details (print orders only — Stripe collects these at checkout)
  shippingName: text("shipping_name"),
  shippingLine1: text("shipping_line1"),
  shippingLine2: text("shipping_line2"),
  shippingCity: text("shipping_city"),
  shippingPostcode: text("shipping_postcode"),
  shippingCountry: text("shipping_country"),
  amountTotal: integer("amount_total"),          // pence/cents
  currency: text("currency").default("gbp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderRow = typeof ordersTable.$inferSelect;
