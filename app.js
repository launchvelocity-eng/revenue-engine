import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Server-side price lookup table (Prevents client-side price tampering)
const PRICING_TIERS = {
  base_10tb: { name: 'Launch Velocity 10 TB Enterprise Vault', unit_amount: 250000 }, // $2,500.00 in cents
  plus_5tb:  { name: 'Launch Velocity 15 TB Enterprise Vault', unit_amount: 375000 }, // $3,750.00 in cents
  plus_10tb: { name: 'Launch Velocity 20 TB Enterprise Vault', unit_amount: 500000 }  // $5,000.00 in cents
};

// Secure Payment Session Generator
app.post('/api/billing/create-checkout', async (req, res) => {
  const { tierId, months, customerEmail } = req.body;
  const selectedTier = PRICING_TIERS[tierId];

  if (!selectedTier || ![1, 3, 6, 12].includes(Number(months))) {
    return res.status(400).json({ error: 'INVALID_BILLING_PARAMETERS' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'], // Supports Corporate Cards & ACH Bank Transfers
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${selectedTier.name} (${months} Month Pre-Pay)` },
          unit_amount: selectedTier.unit_amount * Number(months),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://github.io',
      cancel_url: 'https://github.io',
    });

    res.status(200).json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('[BILLING ERROR]:', error.message);
    res.status(500).json({ error: 'PAYMENT_GATEWAY_FAILURE' });
  }
});
