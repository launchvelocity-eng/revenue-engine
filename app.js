    const sig = req.headers['stripe-signature'];
    const event = process.env.STRIPE_WEBHOOK_SECRET ? stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET) : JSON.parse(req.body.toString());
