fetch('https://revenue-engine-ds6d.onrender.com/api/telemetry')
  .then(res => res.json())
  .then(data => console.log('TELEMETRY STATUS:', data))
  .catch(err => console.error('Connection check failed:', err));
