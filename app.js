let selectedPlan = 'starter';

function selectPlan(plan) {
  selectedPlan = plan;
  // Visual feedback: highlight selected card, switch tab to step 2
  document.querySelectorAll('.card').forEach(c => c.style.borderColor = '#1f2937');
  event.currentTarget.style.borderColor = '#38bdf8';
}

async function confirmAndProvision() {
  const banner = document.getElementById('status-banner');
  banner.style.display = 'block';
  banner.className = 'status-info';
  banner.textContent = '⏳ Waking up Render engine & creating secure Stripe session...';

  try {
    const response = await fetch('https://revenue-engine-dx5d.onrender.com/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan })
    });

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url; // Straight to Stripe Checkout!
    } else {
      throw new Error(data.error || 'Checkout failed');
    }
  } catch (err) {
    banner.className = 'status-error';
    banner.textContent = `❌ Error: ${err.message}`;
  }
}
