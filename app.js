import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = 'launchvelocityadmin2026@gmail.com';
const FRONTEND_URL = 'https://launchvelocity-eng.github.io';

// 1. STRIPE WEBHOOK (Must come BEFORE express.json() so raw body signature verification works)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name || 'Valued Client';
    const planName = session.metadata?.planName || 'Launch Velocity Plan';
    const amountTotal = (session.amount_total / 100).toFixed(2);

    try {
      // A. Send Branded Confirmation Email to Customer
      if (customerEmail) {
        await resend.emails.send({
          from: 'Launch Velocity <onboarding@resend.dev>', // Update once custom domain is verified in Resend
          to: customerEmail,
          subject: `Welcome to Launch Velocity — ${planName} Confirmed`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
              <div style="display: inline-block; background: #eef2ff; color: #4f46e5; font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 999px; margin-bottom: 16px;">PAYMENT CONFIRMED</div>
              <h1 style="font-size: 22px; margin: 0 0 12px;">You're officially onboarded, ${customerName}.</h1>
              <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">Thank you for choosing <strong>Launch Velocity</strong>. Your subscription for <strong>${planName}</strong> is active and your infrastructure provisioning is underway.</p>
              <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Selected Tier</td>
                    <td style="text-align: right; font-weight: 600;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Amount Paid</td>
                    <td style="text-align: right; font-weight: 600;">$${amountTotal} USD</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Session Reference</td>
                    <td style="text-align: right; font-family: monospace; font-size: 12px;">${session.id.slice(-12)}</td>
                  </tr>
                </table>
              </div>
              <a href="${FRONTEND_URL}" style="display: inline-block; background: #635bff; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px;">Access Launch Velocity Portal</a>
            </div>
          `
        });
      }

      // B. Send Instant Revenue Alert Email to Launch Velocity Admin
      await resend.emails.send({
        from: 'Launch Velocity Alerts <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `🚀 New Checkout: $${amountTotal} — ${planName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; padding: 24px; border-left: 4px solid #10b981; background: #f8fafc;">
            <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">New Subscription Activated</h2>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Customer:</strong> ${customerName} (${customerEmail || 'No email provided'})</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Plan:</strong> ${planName}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Amount:</strong> $${amountTotal} USD</p>
            <p style="margin: 4px 0; font-size: 12px; color: #64748b;"><strong>Stripe Session ID:</strong> ${session.id}</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Resend dispatch error:', emailErr);
    }
  }

  res.json({ received: true });
});

// Standard middleware for all other routes
app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:5500'] }));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ status: 'Launch Velocity Revenue Engine Online' });
});

// 2. CREATE STRIPE CHECKOUT SESSION
const PLANS = {
  starter: { name: 'Velocity Starter Engine', amount: 4900, interval: 'month' },
  growth: { name: 'Velocity Growth Suite', amount: 14900, interval: 'month' },
  enterprise: { name: 'Zero-Trust Enterprise Scale', amount: 39900, interval: 'month' }
};

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { planId, customerEmail } = req.body;
    const selectedPlan = PLANS[planId];

    if (!selectedPlan) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: customerEmail || undefined,
      metadata: { planId, planName: selectedPlan.name },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: selectedPlan.name },
            unit_amount: selectedPlan.amount,
            recurring: { interval: selectedPlan.interval },
          },
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/?checkout=success&plan=${encodeURIComponent(selectedPlan.name)}`,
      cancel_url: `${FRONTEND_URL}/?checkout=canceled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Unable to initialize Stripe Checkout session.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
