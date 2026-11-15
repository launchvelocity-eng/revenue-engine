// Server Listen with Full Error Trapping
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Launch Velocity API live on port ' + PORT);
  });
} catch (err) {
  console.error('CRITICAL STARTUP ERROR:', err);
  process.exit(1);
}
