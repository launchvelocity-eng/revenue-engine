async processSecureTransfer() {
  const tierId = document.getElementById('storage-tier-select').value; // e.g., 'base_10tb'
  const months = document.getElementById('rent-prepay-select').value;
  const email = sessionStorage.getItem('lv_user_email') || 'client@enterprise.com';

  this.printBanner('billing-status', '⚡ Generating encrypted Stripe checkout tunnel...');

  try {
    const response = await fetch('https://onrender.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId, months, customerEmail: email })
    });

    const data = await response.json();
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl; // Redirects safely to Stripe
    } else {
      throw new Error('Failed to generate secure checkout session');
    }
  } catch (err) {
    this.printBanner('billing-status', '❌ [ERROR] Could not initialize secure payment tunnel.');
  }
}
