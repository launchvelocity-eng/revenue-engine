const API_BASE = 'https://revenue-engine-dc8d.onrender.com/api';

// 1. Request verification code for signup
async function handleSignup(event) {
  event.preventDefault();
  const email = document.getElementById('signupEmail').value;

  try {
    const response = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (data.success) {
      alert('Verification code sent! Check your email.');
      // Show your verification input form here
    } else {
      alert(data.error || 'Signup failed');
    }
  } catch (err) {
    console.error('Network Error:', err);
    alert('Could not connect to the server.');
  }
}

// 2. Verify code and secure tier assignment
async function handleVerify(event) {
  event.preventDefault();
  const email = document.getElementById('signupEmail').value;
  const code = document.getElementById('verifyCode').value;
  const tierLevel = document.getElementById('tierLevel').value; // Links to your dropdown

  try {
    const response = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, tierLevel })
    });

    const data = await response.json();
    if (data.success) {
      alert(`Success! You have been added to the waitlist at Tier ${data.assignedTier}.`);
      // Redirect to dashboard or success view
    } else {
      alert(data.error || 'Verification failed');
    }
  } catch (err) {
    console.error('Network Error:', err);
    alert('Could not connect to the server.');
  }
}
