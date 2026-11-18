import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE
};

// MUST come BEFORE app.use(express.json()) so Stripe signature verification gets raw bytes
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook Signature Error]:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
      const session = event.data.object;
      const tenantId = session.client_reference_id || session.metadata?.tenantId || 'enterprise-default';
      const tier = session.metadata?.tier || 'enterprise';

      if (typeof pool !== 'undefined') {
        await pool.query(
          `INSERT INTO subscriptions (tenant_id, tier, status, stripe_customer_id, updated_at)
           VALUES ($1, $2, 'ACTIVE', $3, NOW())
           ON CONFLICT (tenant_id) DO UPDATE
           SET tier = EXCLUDED.tier, status = 'ACTIVE', stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()`,
          [tenantId, tier, session.customer || null]
        );
      }
      console.log(`[Launch Velocity] Subscription ACTIVE for tenant=${tenantId} tier=${tier}`);
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
      const sub = event.data.object;
      const customerId = sub.customer;
      if (typeof pool !== 'undefined' && customerId) {
        await pool.query(
          `UPDATE subscriptions SET status = 'LOCKED', updated_at = NOW() WHERE stripe_customer_id = $1`,
          [customerId]
        );
      }
      console.warn(`[Launch Velocity] Vault LOCKED due to payment failure/cancellation for customer=${customerId}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Stripe Lifecycle DB Error]:', err);
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
  }
});
