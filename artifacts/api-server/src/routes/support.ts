import { Router } from "express";
import { desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, ticketsTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router = Router();

// POST /api/support/tickets — submit a support ticket (open to all)
router.post("/support/tickets", async (req: any, res: any): Promise<void> => {
  const { email, subject, message } = req.body ?? {};
  if (
    typeof email !== "string" || !email.includes("@") ||
    typeof subject !== "string" || subject.trim().length < 3 ||
    typeof message !== "string" || message.trim().length < 10
  ) {
    res.status(400).json({ error: "Invalid request — email, subject and message are required." });
    return;
  }

  const auth = getAuth(req);

  await db.insert(ticketsTable).values({
    id: randomUUID(),
    userId: auth?.userId ?? null,
    email,
    subject,
    message,
    status: "open",
  });

  res.status(201).json({ ok: true });
});

// GET /api/support/tickets — admin only
router.get("/support/tickets", async (req: any, res: any): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorised" }); return; }

  // Simple admin check via env var
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

  let isAdmin = adminIds.includes(auth.userId);
  if (!isAdmin && adminEmails.length > 0) {
    // We can't easily check email here without clerk client import so we'll rely on IDs only for this endpoint
    // The full admin check is done via the isAdmin helper in admin.ts
    // For simplicity, import clerkClient here:
    try {
      const { clerkClient } = await import("@clerk/express");
      const user = await clerkClient.users.getUser(auth.userId);
      const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
      if (primary && adminEmails.includes(primary.emailAddress.toLowerCase())) isAdmin = true;
    } catch { /* non-fatal */ }
  }

  if (!isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .orderBy(desc(ticketsTable.createdAt));

  res.json({ tickets });
});

// PATCH /api/support/tickets/:id — update status (admin only)
router.patch("/support/tickets/:id", async (req: any, res: any): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorised" }); return; }

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  let isAdmin = adminIds.includes(auth.userId);
  if (!isAdmin && adminEmails.length > 0) {
    try {
      const { clerkClient } = await import("@clerk/express");
      const user = await clerkClient.users.getUser(auth.userId);
      const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
      if (primary && adminEmails.includes(primary.emailAddress.toLowerCase())) isAdmin = true;
    } catch { /* non-fatal */ }
  }
  if (!isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const { status } = req.body as { status?: string };
  if (!status || !["open", "resolved", "closed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }

  const { eq } = await import("drizzle-orm");
  await db.update(ticketsTable).set({ status }).where(eq(ticketsTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
