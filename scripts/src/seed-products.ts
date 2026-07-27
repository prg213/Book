/**
 * Creates the two MyStoryBook products in Stripe (idempotent).
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
import { getUncachableStripeClient } from "./stripeClient";

async function seed() {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding Stripe products for MyStoryBook...\n");

  // ── Digital story (£4.99) ─────────────────────────────────────────────────
  const digitalSearch = await stripe.products.search({
    query: "name:'Story Generation' AND active:'true'",
  });

  if (digitalSearch.data.length > 0) {
    console.log("✓ 'Story Generation' product already exists:", digitalSearch.data[0].id);
  } else {
    const digital = await stripe.products.create({
      name: "Story Generation",
      description: "Generate one personalised AI storybook featuring your child as the hero.",
      metadata: { productType: "digital" },
    });
    const digitalPrice = await stripe.prices.create({
      product: digital.id,
      unit_amount: 499, // £4.99
      currency: "gbp",
    });
    console.log(`✓ Created 'Story Generation': ${digital.id}  price: ${digitalPrice.id} (£4.99)`);
  }

  // ── Printed storybook (£14.99) ────────────────────────────────────────────
  const printSearch = await stripe.products.search({
    query: "name:'Printed Storybook' AND active:'true'",
  });

  if (printSearch.data.length > 0) {
    console.log("✓ 'Printed Storybook' product already exists:", printSearch.data[0].id);
  } else {
    const print = await stripe.products.create({
      name: "Printed Storybook",
      description:
        "Your personalised AI story professionally printed and delivered to your door. 5–10 business days.",
      metadata: { productType: "print" },
    });
    const printPrice = await stripe.prices.create({
      product: print.id,
      unit_amount: 1499, // £14.99
      currency: "gbp",
    });
    console.log(`✓ Created 'Printed Storybook': ${print.id}  price: ${printPrice.id} (£14.99)`);
  }

  console.log("\nDone. Webhooks will sync data to your database automatically.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
