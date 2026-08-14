async function joinWaitlist() {
    const email = document.getElementById('waitlistEmailInput').value.trim();
    if (!email) return showStatus('Please enter a valid email address.', true);

    try {
        const res = await fetch(`${API_URL}/api/waitlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to join waitlist');

        showStatus('You have been added to the waitlist successfully!');
        document.getElementById('waitlistEmailInput').value = '';
    } catch (err) {
        showStatus(err.message, true);
    }
}
