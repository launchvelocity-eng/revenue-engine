async function fetchWaitlist() {
    try {
        const res = await fetch(`${API_URL}/api/admin/waitlist`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch waitlist');
        console.table(data.waitlist);
        showStatus(`Loaded ${data.waitlist.length} waitlist subscribers (check console).`);
    } catch (err) {
        showStatus(err.message, true);
    }
}
