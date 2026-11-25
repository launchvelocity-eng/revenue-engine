app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Launch Velocity Revenue Engine',
    timestamp: new Date().toISOString()
  });
});
