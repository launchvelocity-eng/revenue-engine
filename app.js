import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());

// Webhook route
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email;
    const planName = session.metadata?.planName || 'Launch Velocity Plan';
    const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00';

    try {
      if (customerEmail) {
        await resend.emails.send({
          from: 'Launch Velocity <onboarding@resend.dev>',
          to: customerEmail,
          subject: `Provisioning Confirmed: ${planName}`,
          html: `<h2>Welcome!</h2><p>Your subscription for <strong>${planName}</strong> ($${amountTotal}/mo) is active.</p>`
        });
      }

      await resend.emails.send({
        from: 'Launch Velocity Alerts <onboarding@resend.dev>',
        to: 'launchvelocityadmin2026@gmail.com',
        subject: `New Subscriber: ${planName} ($${amountTotal})`,
        html: `<p>Customer: ${customerEmail}</p><p>Plan: ${planName} ($${amountTotal}/mo)</p>`
      });
    } catch (e) {
      console.error('Email dispatch error:', e);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Launch Velocity Revenue Engine is live.');
});

const PLAN_PRICES = {
  starter: { name: 'Starter Engine', amount: 4900 },
  growth: { name: 'Growth Suite', amount: 14900 },
  enterprise: { name: 'Zero-Trust Enterprise', amount: 39900 }
};

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { plan, email } = req.body;
    const selected = PLAN_PRICES[plan] || PLAN_PRICES.starter;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: selected.name },
            unit_amount: selected.amount,
            recurring: { interval: 'month' }
          },
          quantity: 1
        }
      ],
      metadata: { planName: selected.name },
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?success=true',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?canceled=true'
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
