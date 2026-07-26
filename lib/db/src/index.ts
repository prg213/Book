import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Idle clients can be terminated by the server (e.g. Neon scale-to-zero or
// admin restarts). Without this handler, pg emits an unhandled 'error' event
// that crashes the whole process and causes a production crash loop.
pool.on("error", (err) => {
  console.error("Postgres pool error (idle client):", err.message);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
