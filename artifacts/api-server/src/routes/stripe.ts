import { Router } from "express";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { getUncachableStripeClient } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/stripe/products — list products with prices for the storefront
router.get("/stripe/products", async (_req, res) => {
  try {
    const products = await stripeStorage.listProductsWithPrices();
    res.json({ data: products });
  } catch (err) {
    logger.error({ err }, "Failed to list Stripe products");
    res.status(500).json({ error: "Failed to load products" });
  }
});

// POST /api/stripe/checkout — create a Stripe Checkout Session
// Body: { priceId, storyId, productType: "digital"|"print" }
router.post("/stripe/checkout", async (req: any, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId ?? null;
    const { priceId, storyId, productType } = req.body as {
      priceId: string;
      storyId: string;
      productType: "digital" | "print";
    };

    if (!priceId || !storyId || !productType) {
      return res.status(400).json({ error: "priceId, storyId and productType are required" });
    }

    const stripe = await getUncachableStripeClient();

    // Build return URLs — works for both web and Capacitor (remote-URL WebView)
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
    const base = `${proto}://${host}`;
    const appBase = `${base}/mystorybook`;

    const sessionParams: any = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${appBase}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/checkout/cancel`,
      metadata: { storyId, productType, userId: userId ?? "" },
    };

    // For print orders, let Stripe collect the shipping address
    if (productType === "print") {
      sessionParams.shipping_address_collection = {
        allowed_countries: ["GB", "US", "CA", "AU", "IE", "FR", "DE", "NL", "SE", "NO", "DK"],
      };
      sessionParams.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "gbp" },
            display_name: "Standard delivery",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 10 },
            },
          },
        },
      ];
    }

    // Attach customer if user is signed in
    if (userId) {
      const existingCustomers = await stripe.customers.list({ limit: 1, email: auth.sessionClaims?.email as string ?? undefined });
      if (existingCustomers.data.length > 0) {
        sessionParams.customer = existingCustomers.data[0].id;
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Create a pending order record
    await stripeStorage.createOrder({
      id: randomUUID(),
      userId,
      storyId,
      productType,
      stripeSessionId: session.id,
      stripePaymentIntentId: null,
      status: "pending",
      shippingName: null,
      shippingLine1: null,
      shippingLine2: null,
      shippingCity: null,
      shippingPostcode: null,
      shippingCountry: null,
      amountTotal: null,
      currency: "gbp",
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// GET /api/stripe/checkout/session?session_id=... — verify payment after redirect
router.get("/stripe/checkout/session", async (req, res) => {
  try {
    const { session_id } = req.query as { session_id: string };
    if (!session_id) return res.status(400).json({ error: "session_id required" });

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    if (session.payment_status === "paid") {
      const shipping = session.shipping_details;
      await stripeStorage.updateOrderStatus(session_id, "paid", {
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? undefined,
        shippingName: shipping?.name ?? undefined,
        shippingLine1: shipping?.address?.line1 ?? undefined,
        shippingLine2: shipping?.address?.line2 ?? undefined,
        shippingCity: shipping?.address?.city ?? undefined,
        shippingPostcode: shipping?.address?.postal_code ?? undefined,
        shippingCountry: shipping?.address?.country ?? undefined,
        amountTotal: session.amount_total ?? undefined,
      });
    }

    const order = await stripeStorage.getOrderBySessionId(session_id);
    res.json({
      status: session.payment_status,
      productType: order?.productType ?? session.metadata?.productType,
      storyId: order?.storyId ?? session.metadata?.storyId,
      amountTotal: session.amount_total,
      currency: session.currency,
      shippingName: session.shipping_details?.name,
    });
  } catch (err) {
    logger.error({ err }, "Failed to retrieve checkout session");
    res.status(500).json({ error: "Failed to retrieve session" });
  }
});

// GET /api/orders — list current user's orders
router.get("/orders", async (req: any, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) return res.status(401).json({ error: "Sign in to view orders" });
    const orders = await stripeStorage.listOrdersByUser(auth.userId);
    res.json({ data: orders });
  } catch (err) {
    logger.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Failed to load orders" });
  }
});

export default router;
