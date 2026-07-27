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

/** Returns true only when the Stripe integration credentials are reachable. */
async function canReachStripe(): Promise<boolean> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return false;

  try {
    const resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
      {
        headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    return !!data.items?.[0]?.settings?.secret_key;
  } catch {
    return false;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.info("Stripe: DATABASE_URL not set — skipping");
    return;
  }

  // Only proceed if credentials are actually available — this prevents
  // stripe-replit-sync from touching the DB schema when not configured,
  // which would block Replit's publishing flow with an unreviewed schema diff.
  if (!(await canReachStripe())) {
    logger.info("Stripe: integration not configured — skipping (payments inactive)");
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
