fetch('https://revenue-engine-dc8d.onrender.com/api/tiers')
  .then(response => response.json())
  .then(data => {
    console.log('Available Storage Tiers:', data.tiers);
  })
  .catch(error => {
    console.error('Error fetching storage tiers:', error);
  });
