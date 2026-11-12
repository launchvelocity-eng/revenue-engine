async function handleEnterpriseCheckout(tierId, months, customerEmail) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/billing/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tierId, months, customerEmail })
    });

    const data = await response.json();
    if (data.checkoutUrl) {
      // Redirect corporate client straight to Stripe's secure checkout page
      window.location.href = data.checkoutUrl;
    } else {
      alert('Failed to initiate checkout session: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Checkout network error:', err);
    alert('Payment gateway communication error.');
  }
}
