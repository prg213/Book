import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { pool } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

// ── Create application tables if they don't exist ────────────────────────────
async function runAppMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id                      TEXT PRIMARY KEY,
      user_id                 TEXT,
      story_id                TEXT,
      product_type            TEXT NOT NULL,
      stripe_session_id       TEXT,
      stripe_payment_intent_id TEXT,
      status                  TEXT NOT NULL DEFAULT 'pending',
      shipping_name           TEXT,
      shipping_line1          TEXT,
      shipping_line2          TEXT,
      shipping_city           TEXT,
      shipping_postcode       TEXT,
      shipping_country        TEXT,
      amount_total            INTEGER,
      currency                TEXT DEFAULT 'gbp',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info("App migrations complete");
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }

  try {
    logger.info("Running Stripe schema migrations...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.warn({ err }, "Stripe backfill error (non-fatal)"));
  } catch (err) {
    logger.error({ err }, "Stripe init failed (non-fatal — app continues without payments)");
  }
}

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

await runAppMigrations();
await initStripe();

app.listen(port, (err) => {
  if (err) { logger.error({ err }, "Error listening"); process.exit(1); }
  logger.info({ port }, "Server listening");
});
