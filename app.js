const TIERS = {
  starter: { name: 'Starter Engine', priceCents: 19900, priceId: process.env.STRIPE_PRICE_STARTER },
  growth: { name: 'Growth Suite', priceCents: 49900, priceId: process.env.STRIPE_PRICE_GROWTH },
  enterprise: { name: 'Enterprise Core', priceCents: 99900, priceId: process.env.STRIPE_PRICE_ENTERPRISE }
};
