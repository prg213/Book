import { Router } from "express";
import { desc, count } from "drizzle-orm";
import { getAuth, clerkClient } from "@clerk/express";
import { db, storiesTable } from "@workspace/db";

const router = Router();

/** Check if the requesting user is an admin.
 *  Admin user IDs are stored in the ADMIN_USER_IDS env var (comma-separated Clerk user IDs).
 *  Falls back to checking ADMIN_EMAILS against the user's primary email. */
async function isAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return false;

  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminIds.includes(userId)) return true;

  // Also check by email if ADMIN_EMAILS is set
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const primary = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      );
      if (primary && adminEmails.includes(primary.emailAddress.toLowerCase())) {
        return true;
      }
    } catch {
      // ignore — don't leak errors
    }
  }

  return false;
}

function resolveUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("/api/") || stored.startsWith("http")) return stored;
  return `/api/uploads/${stored}`;
}

// GET /api/admin/stories — all stories across all users
router.get("/admin/stories", async (req: any, res: any): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rows = await db
    .select()
    .from(storiesTable)
    .orderBy(desc(storiesTable.createdAt));

  // Collect unique userIds so we can batch-fetch from Clerk
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];

  const userMap: Record<string, { email: string; name: string }> = {};
  if (userIds.length > 0) {
    try {
      const { data: users } = await clerkClient.users.getUserList({
        userId: userIds,
        limit: 500,
      });
      for (const u of users) {
        const primary = u.emailAddresses.find(
          (e) => e.id === u.primaryEmailAddressId
        );
        userMap[u.id] = {
          email: primary?.emailAddress ?? "",
          name: [u.firstName, u.lastName].filter(Boolean).join(" ") || primary?.emailAddress || "Unknown",
        };
      }
    } catch {
      // non-fatal — stories still returned without user info
    }
  }

  // Count stats
  const [{ total }] = await db.select({ total: count() }).from(storiesTable);

  const stories = rows.map((row) => ({
    id: row.id,
    title: row.title,
    characterName: row.characterName,
    status: row.status,
    coverImageUrl: resolveUrl(row.coverImagePath),
    createdAt: row.createdAt,
    userId: row.userId,
    userEmail: row.userId ? (userMap[row.userId]?.email ?? "") : "",
    userName: row.userId ? (userMap[row.userId]?.name ?? "") : "Anonymous",
  }));

  res.json({ total, stories });
});

// GET /api/admin/me — returns the current user's Clerk ID (handy for setting up ADMIN_USER_IDS)
router.get("/admin/me", async (req: any, res: any): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Not signed in" }); return; }
  res.json({ userId, isAdmin: await isAdmin(req) });
});

export default router;
