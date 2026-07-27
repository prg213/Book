import { sql, eq, desc } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import type { OrderRow } from "@workspace/db";

export class StripeStorage {
  // ── Stripe catalogue (queried from stripe schema synced by stripe-replit-sync) ──

  async listProductsWithPrices() {
    const result = await db.execute(sql`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active, images
        FROM stripe.products
        WHERE active = true
        ORDER BY name
      )
      SELECT
        p.id            AS product_id,
        p.name          AS product_name,
        p.description   AS product_description,
        p.metadata      AS product_metadata,
        p.images        AS product_images,
        pr.id           AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.active       AS price_active
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.name, pr.unit_amount
    `);

    // Group prices by product
    const map = new Map<string, any>();
    for (const row of result.rows as any[]) {
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata ?? {},
          images: row.product_images ?? [],
          prices: [],
        });
      }
      if (row.price_id) {
        map.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          active: row.price_active,
        });
      }
    }
    return Array.from(map.values());
  }

  // ── Orders (application table) ────────────────────────────────────────────

  async createOrder(data: Omit<OrderRow, "createdAt" | "updatedAt">) {
    const [order] = await db.insert(ordersTable).values(data).returning();
    return order;
  }

  async getOrderBySessionId(sessionId: string) {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.stripeSessionId, sessionId));
    return order ?? null;
  }

  async getOrderById(id: string) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    return order ?? null;
  }

  async listOrdersByUser(userId: string) {
    return db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.userId, userId))
      .orderBy(desc(ordersTable.createdAt));
  }

  async updateOrderStatus(
    sessionId: string,
    status: string,
    extra?: {
      stripePaymentIntentId?: string;
      shippingName?: string;
      shippingLine1?: string;
      shippingLine2?: string;
      shippingCity?: string;
      shippingPostcode?: string;
      shippingCountry?: string;
      amountTotal?: number;
    },
  ) {
    await db
      .update(ordersTable)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(ordersTable.stripeSessionId, sessionId));
  }
}

export const stripeStorage = new StripeStorage();
