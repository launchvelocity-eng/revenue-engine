const response = await fetch('YOUR_API_URL');
const text = await response.text(); // Get raw text first

let data;
try {
  data = JSON.parse(text);
} catch (e) {
  console.error('Expected JSON, but received HTML/Text:', text);
  return res.status(500).json({ error: 'External service returned an invalid response' });
}
