const response = await fetch('https://revenue-engine-dx5d.onrender.com/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan: selectedPlan })
});
