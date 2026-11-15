async function startCheckout(tier) {
  const emailInput = document.querySelector('input[type="email"]');
  const email = emailInput ? emailInput.value.trim() : '';

  try {
    const res = await fetch('https://revenue-engine-dx5d.onrender.com/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, email })
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to secure Stripe checkout
    } else {
      alert(data.error || 'Failed to start checkout');
    }
  } catch (err) {
    alert('Connection error. Please check Render dashboard.');
  }
}
