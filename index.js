app.post('/api/some-endpoint', async (req, res) => {
  try {
    const response = await fetch('YOUR_API_URL');
    const text = await response.text(); 
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Expected JSON, but received HTML/Text:', text);
      return res.status(500).json({ error: 'External service returned an invalid response' });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('Route Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
