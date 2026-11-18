app.post('/api/v1/create-checkout-session', async (req, res) => {
  try {
    const tier = (req.body.tier || 'enterprise').toLowerCase();
    const tenantId = req.headers['x-tenant-id'] || 'enterprise-default';
    const priceId = PRICE_MAP[tier];

    if (!priceId) {
      return res.status(400).json({ error: `Missing Stripe Price ID for tier: ${tier}` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: tenantId,
      metadata: { tenantId, tier },
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?status=active',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?status=cancelled'
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[Stripe Checkout Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});
